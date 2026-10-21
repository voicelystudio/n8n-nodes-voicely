import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	IHttpRequestOptions,
} from 'n8n-workflow';

type Context = IExecuteFunctions | ILoadOptionsFunctions;
export type ApiResponse = { body: unknown; statusCode: number; headers: Record<string, string> };

export function serviceOrigin(value: unknown): string {
	const url = new URL(String(value));
	if (
		!['http:', 'https:'].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.pathname !== '/' ||
		url.search ||
		url.hash
	) {
		throw new Error(
			'Service URL must be an HTTP(S) origin without credentials, path, query or fragment',
		);
	}
	return url.origin;
}

export function timeoutValue(value: unknown): number {
	const n = Number(value);
	if (typeof value === 'boolean' || value === '' || !Number.isSafeInteger(n) || n < 0)
		throw new Error('Request timeout must be a non-negative integer');
	return n;
}

function record(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function errorBody(value: unknown): Record<string, unknown> {
	if (Buffer.isBuffer(value)) value = value.toString('utf8');
	if (typeof value === 'string') {
		try {
			return record(JSON.parse(value));
		} catch {
			return {};
		}
	}
	return record(value);
}

function publicFailure(error: unknown, secret: string): { status?: number; code: string } {
	// Only this failure's known helper wrappers are inspected, never history or account state.
	const seen = new Set<object>();
	let current = error,
		status: number | undefined,
		code: string | undefined;
	while (current && typeof current === 'object' && !seen.has(current)) {
		seen.add(current);
		const obj = record(current),
			response = record(obj.response);
		const candidateStatus = Number(
			response.statusCode ?? response.status ?? obj.statusCode ?? obj.httpCode,
		);
		if (
			status === undefined &&
			Number.isInteger(candidateStatus) &&
			candidateStatus >= 100 &&
			candidateStatus <= 599
		)
			status = candidateStatus;
		if (code === undefined) {
			for (const value of [response.body, response.data, obj.body, record(obj.context).data, obj]) {
				const body = errorBody(value),
					detail = record(body.detail);
				const candidate = body.code ?? detail.status ?? detail.code;
				if (typeof candidate === 'string' && /^[a-z][a-z0-9_]*$/.test(candidate)) {
					code = candidate;
					break;
				}
			}
		}
		current = obj.cause ?? obj.errorResponse;
	}
	const raw = code ?? 'request_failed';
	const safe = raw.replace(/vly_live_[A-Za-z0-9_-]+/g, '[redacted]');
	return {
		...(status !== undefined ? { status } : {}),
		code: secret ? safe.split(secret).join('[redacted]') : safe,
	};
}

export async function apiRequest(
	context: Context,
	route: string,
	options: Partial<IHttpRequestOptions> = {},
): Promise<ApiResponse> {
	const credentials = await context.getCredentials('voicelyApi');
	let origin: string;
	try {
		origin = serviceOrigin(credentials.serviceUrl);
	} catch {
		throw new NodeOperationError(context.getNode(), 'Set a valid Voicely Service URL');
	}
	try {
		const response = (await context.helpers.httpRequestWithAuthentication.call(
			context,
			'voicelyApi',
			{
				url: origin + route,
				method: 'GET',
				timeout: 0,
				returnFullResponse: true,
				disableFollowRedirect: true,
				...options,
			},
		)) as ApiResponse;
		if (response.statusCode !== 200) throw { response };
		return response;
	} catch (error) {
		const failure = publicFailure(error, String(credentials.apiKey ?? ''));
		throw new NodeApiError(
			context.getNode(),
			{
				message: `Voicely request failed: ${failure.code}`,
				...(failure.status ? { httpCode: String(failure.status) } : {}),
			},
			{
				message: `Voicely request failed: ${failure.code}`,
				description:
					'No automatic retry was made. For an uncertain paid request, reuse the same idempotency key.',
			},
		);
	}
}

export function responseMetadata(headers: Record<string, string>): IDataObject {
	const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
	const out: IDataObject = {};
	const strings: Record<string, string> = {
		requestId: 'x-voicely-request-id',
		model: 'x-voicely-model',
		requestedModel: 'x-voicely-model-requested',
		requestedVoice: 'x-voicely-voice-requested',
		effectiveVoice: 'x-voicely-voice-used',
		language: 'x-voicely-language',
	};
	for (const [name, header] of Object.entries(strings))
		if (h[header] !== undefined) out[name] = h[header];
	for (const [name, header] of Object.entries({
		inputCharacters: 'x-voicely-characters-input',
		chargedCharacters: 'x-voicely-characters-charged',
		characterBalance: 'x-voicely-character-balance',
	})) {
		if (h[header] !== undefined && h[header] !== '' && Number.isFinite(Number(h[header])))
			out[name] = Number(h[header]);
	}
	if (h['x-voicely-replay'] !== undefined) out.replayed = h['x-voicely-replay'] === 'true';
	return out;
}

import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';
import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { serviceOrigin } from './transport';

// Platform timer representation, not a product timeout ceiling. One timer, no polling.
export function wsDeadline(duration: number, expired: () => void): () => void {
	if (duration === 0) return () => {};
	const started = performance.now();
	const controller = new AbortController();
	void (async () => {
		try {
			let remaining = duration - (performance.now() - started);
			while (remaining > 0 && !controller.signal.aborted) {
				await sleep(Math.min(remaining, 2 ** 31 - 1), controller.signal);
				remaining = duration - (performance.now() - started);
			}
			if (!controller.signal.aborted) expired();
		} catch {
			// Cancelling n8n's supported abortable sleep releases its one timer.
			if (!controller.signal.aborted) expired();
		}
	})();
	return () => controller.abort();
}

// Structural types keep HTTP usable on older hosts without importing a WS dependency.
type SocketEvent = { data?: unknown; code?: number };
type Listener = (event: SocketEvent) => void;
type Socket = {
	addEventListener(name: string, listener: Listener): void;
	removeEventListener(name: string, listener: Listener): void;
	send(data: string): void;
	close(): void;
};
type SocketConstructor = new (url: string) => Socket;
declare const WebSocket: SocketConstructor | undefined;

export async function websocketRequest(
	context: IExecuteFunctions,
	input: {
		voice: string;
		text: string;
		format: string;
		model: string;
		language: string;
		timeout: number;
	},
): Promise<{
	body: Buffer;
	headers: Record<string, string>;
	statusCode: number;
	metadata: IDataObject;
}> {
	const NativeWebSocket = typeof WebSocket === 'undefined' ? undefined : WebSocket;
	if (!NativeWebSocket)
		throw new NodeOperationError(
			context.getNode(),
			'WebSocket generation requires a server-side n8n host with native WebSocket support (Node.js 22+). HTTP Generate is unchanged.',
		);
	const credentials = await context.getCredentials('voicelyApi');
	let url: URL;
	try {
		url = new URL(serviceOrigin(credentials.serviceUrl));
	} catch {
		throw new NodeOperationError(context.getNode(), 'Set a valid Voicely Service URL');
	}
	const key = String(credentials.apiKey ?? '');
	if (!key) throw new NodeOperationError(context.getNode(), 'Set a Voicely API key');
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	url.pathname = `/v1/text-to-speech/${encodeURIComponent(input.voice)}/stream-input`;
	url.searchParams.set('output_format', input.format);
	if (input.model) url.searchParams.set('model_id', input.model);
	if (input.language) url.searchParams.set('language_code', input.language);
	const signal = context.getExecutionCancelSignal?.();
	const failure = (code: string) =>
		new NodeApiError(
			context.getNode(),
			{ message: `Voicely WebSocket failed: ${code}` },
			{
				message: `Voicely WebSocket failed: ${code}`,
				description:
					'No retry or HTTP fallback was made. WebSocket has no idempotent replay; completed segments may already be charged. Do not enable Retry On Fail for uncertain sessions.',
			},
		);
	if (signal?.aborted) throw failure('execution_cancelled');
	const started = performance.now();
	return await new Promise((resolve, reject) => {
		let socket: Socket;
		try {
			socket = new NativeWebSocket(url.href);
		} catch {
			reject(failure('connection_failed'));
			return;
		}
		const chunks: Buffer[] = [];
		let bytes = 0,
			frames = 0,
			firstAudioMs: number | undefined;
		let final = false,
			finished = false;
		let cancelDeadline = () => {};
		const finish = (code?: string) => {
			if (finished) return;
			finished = true;
			cancelDeadline();
			signal?.removeEventListener('abort', abort);
			for (const [name, listener] of listeners) socket.removeEventListener(name, listener);
			try {
				socket.close();
			} catch {
				/* A failed handshake may already be closed. */
			}
			if (code) {
				chunks.length = 0;
				reject(failure(code));
				return;
			}
			let body: Buffer;
			try {
				body = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, bytes);
			} catch {
				chunks.length = 0;
				reject(failure('audio_buffer_failed'));
				return;
			}
			chunks.length = 0;
			resolve({
				body,
				statusCode: 200,
				headers: {
					'content-type': input.format.startsWith('mp3_')
						? 'audio/mpeg'
						: input.format === 'ulaw_8000'
							? 'audio/basic'
							: 'audio/pcm',
				},
				metadata: {
					transport: 'websocket',
					audioFrames: frames,
					firstAudioMs,
					totalMs: performance.now() - started,
				},
			});
		};
		const abort = () => finish('execution_cancelled');
		const listeners: Array<[string, Listener]> = [
			[
				'open',
				() => {
					try {
						// The native constructor cannot set headers. The existing server accepts first-frame auth.
						socket.send(JSON.stringify({ text: ' ', xi_api_key: key }));
						socket.send(JSON.stringify({ text: input.text }));
						socket.send(JSON.stringify({ text: '' }));
					} catch {
						finish('send_failed');
					}
				},
			],
			[
				'message',
				(event) => {
					try {
						if (typeof event.data !== 'string' || final) {
							finish('invalid_stream_frame');
							return;
						}
						const value: unknown = JSON.parse(event.data);
						if (!value || typeof value !== 'object' || Array.isArray(value)) {
							finish('invalid_stream_frame');
							return;
						}
						const frame = value as Record<string, unknown>;
						if (frame.error !== undefined) {
							const code =
								typeof frame.error === 'string' &&
								/^[a-z][a-z0-9_]*$/.test(frame.error) &&
								!frame.error.includes(key)
									? frame.error
									: 'provider_error';
							finish(code);
							return;
						}
						if (frame.audio !== null && frame.audio !== undefined) {
							if (
								typeof frame.audio !== 'string' ||
								frame.audio.length % 4 !== 0 ||
								!/^[A-Za-z0-9+/]*={0,2}$/.test(frame.audio)
							) {
								finish('invalid_audio_frame');
								return;
							}
							const chunk = Buffer.from(frame.audio, 'base64');
							if (chunk.length) {
								firstAudioMs ??= performance.now() - started;
								chunks.push(chunk);
								bytes += chunk.length;
								frames++;
							}
						}
						if (frame.isFinal === true) final = true;
					} catch {
						finish('invalid_stream_frame');
					}
				},
			],
			['error', () => finish('connection_failed')],
			[
				'close',
				(event) =>
					finish(event.code === 1000 && final && bytes > 0 ? undefined : 'stream_incomplete'),
			],
		];
		for (const [name, listener] of listeners) socket.addEventListener(name, listener);
		signal?.addEventListener('abort', abort, { once: true });
		if (signal?.aborted) abort();
		if (!finished) cancelDeadline = wsDeadline(input.timeout, () => finish('request_timeout'));
	});
}

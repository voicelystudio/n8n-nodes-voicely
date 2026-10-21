import { createHash } from 'node:crypto';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { apiRequest, responseMetadata, timeoutValue } from './transport';
import { websocketRequest } from './websocket';

export class Voicely implements INodeType {
	description: INodeTypeDescription = {
		usableAsTool: true,
		displayName: 'Voicely',
		name: 'voicely',
		icon: { light: 'file:voicely.svg', dark: 'file:voicely.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Generate speech and discover Voicely voices',
		defaults: { name: 'Voicely' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'voicelyApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'speech',
				options: [
					{ name: 'Speech', value: 'speech' },
					{ name: 'Voice', value: 'voice' },
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'generate',
				displayOptions: { show: { resource: ['speech'] } },
				options: [
					{ name: 'Generate', value: 'generate', action: 'Generate speech' },
					{
						name: 'Generate via WebSocket',
						value: 'generateWebSocket',
						action: 'Generate speech via websocket',
						description: 'Receive WebSocket audio and return one complete binary file',
					},
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'getMany',
				displayOptions: { show: { resource: ['voice'] } },
				options: [{ name: 'Get Many', value: 'getMany', action: 'Get many voices' }],
			},
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				displayOptions: { show: { resource: ['speech'] } },
			},
			{
				displayName: 'Voice Name or ID',
				name: 'voiceId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getVoices' },
				default: '',
				required: true,
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				displayOptions: { show: { resource: ['speech'] } },
			},
			{
				displayName: 'Model Name or ID',
				name: 'modelId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getModels' },
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				displayOptions: { show: { resource: ['speech'] } },
			},
			{
				displayName: 'Language Code',
				name: 'languageCode',
				type: 'string',
				default: '',
				description:
					'ISO language or supported locale. Leave empty for API detection. Roman Urdu requires ur.',
				displayOptions: { show: { resource: ['speech'] } },
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				default: 'mp3_44100_128',
				displayOptions: { show: { resource: ['speech'] } },
				options: [
					{ name: 'MP3', value: 'mp3_44100_128' },
					{ name: 'PCM 16 kHz (Raw)', value: 'pcm_16000' },
					{ name: 'PCM 24 kHz (Raw)', value: 'pcm_24000' },
					{ name: 'Mu-Law 8 kHz (Raw)', value: 'ulaw_8000' },
				],
			},
			{
				displayName: 'Put Output in Field',
				name: 'binaryProperty',
				type: 'string',
				default: 'audio',
				required: true,
				displayOptions: { show: { resource: ['speech'] } },
				description: 'The binary field for the generated audio',
			},
			{
				displayName: 'Item Concurrency',
				name: 'itemConcurrency',
				type: 'number',
				default: 1,
				description:
					'Simultaneous item requests in this execution. Configurable without an upper ceiling; the API remains the capacity authority.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Idempotency Key',
						name: 'idempotencyKey',
						type: 'string',
						default: '',
						description:
							'HTTP Generate only. WebSocket does not support idempotent replay. Stable business job key for HTTP replay across workflow reruns.',
					},
					{
						displayName: 'Request Timeout (Ms)',
						name: 'requestTimeoutMs',
						type: 'number',
						default: 180000,
						description:
							'HTTP request or complete WebSocket session timeout in milliseconds. Zero disables it. No coded upper ceiling.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getVoices(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const r = await apiRequest(this, '/v1/voices');
				const body = r.body as { voices: { name: string; voice_id: string }[] };
				return body.voices.map((voice) => ({ name: voice.name, value: voice.voice_id }));
			},
			async getModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const r = await apiRequest(this, '/v1/models');
				return [
					{ name: 'API Default', value: '' },
					...(r.body as { name: string; model_id: string }[]).map((model) => ({
						name: model.name,
						value: model.model_id,
					})),
				];
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputs = this.getInputData();
		const concurrency = Number(this.getNodeParameter('itemConcurrency', 0, 1));
		if (!Number.isSafeInteger(concurrency) || concurrency < 1)
			throw new NodeOperationError(this.getNode(), 'Item concurrency must be a positive integer');
		const output: INodeExecutionData[][] = new Array(inputs.length);
		let next = 0,
			failure: unknown;
		const executeItem = async (index: number): Promise<INodeExecutionData[]> => {
			const resource = String(this.getNodeParameter('resource', index));
			const operation = String(this.getNodeParameter('operation', index));
			const options = this.getNodeParameter('options', index, {}) as IDataObject;
			let timeout: number;
			try {
				timeout = timeoutValue(options.requestTimeoutMs ?? 180000);
			} catch {
				throw new NodeOperationError(
					this.getNode(),
					'Request timeout must be a non-negative integer',
					{ itemIndex: index },
				);
			}
			if (resource === 'voice' && operation === 'getMany') {
				const r = await apiRequest(this, '/v1/voices', { timeout });
				return (r.body as { voices: IDataObject[] }).voices.map((voice) => ({
					json: voice,
					pairedItem: { item: index },
				}));
			}
			if (resource !== 'speech' || !['generate', 'generateWebSocket'].includes(operation))
				throw new NodeOperationError(this.getNode(), 'Select a supported Voicely operation', {
					itemIndex: index,
				});
			const text = this.getNodeParameter('text', index) as string;
			const voice = this.getNodeParameter('voiceId', index) as string;
			const field = this.getNodeParameter('binaryProperty', index) as string;
			if (
				typeof text !== 'string' ||
				typeof voice !== 'string' ||
				typeof field !== 'string' ||
				!text.trim() ||
				!voice.trim() ||
				!field.trim()
			)
				throw new NodeOperationError(
					this.getNode(),
					'Text, voice and output field must be non-empty strings',
					{ itemIndex: index },
				);
			const format = String(this.getNodeParameter('outputFormat', index));
			const model = this.getNodeParameter('modelId', index, '') as string;
			const language = this.getNodeParameter('languageCode', index, '') as string;
			const isWebSocket = operation === 'generateWebSocket';
			if (isWebSocket && options.idempotencyKey)
				throw new NodeOperationError(
					this.getNode(),
					'Idempotency keys apply only to HTTP Generate. Clear this option for WebSocket.',
					{ itemIndex: index },
				);
			const key = isWebSocket
				? undefined
				: options.idempotencyKey
					? String(options.idempotencyKey)
					: 'n8n_' +
						createHash('sha256')
							.update(
								JSON.stringify([
									this.getExecutionId(),
									this.getNode().id,
									this.evaluateExpression('{{$runIndex}}', index),
									index,
								]),
							)
							.digest('base64url');
			const r = isWebSocket
				? await websocketRequest(this, { voice, text, format, model, language, timeout })
				: await apiRequest(this, `/v1/text-to-speech/${encodeURIComponent(voice)}`, {
						method: 'POST',
						qs: { output_format: format },
						timeout,
						encoding: 'arraybuffer',
						headers: { 'content-type': 'application/json', 'Idempotency-Key': key },
						body: JSON.stringify({
							text,
							...(model ? { model_id: model } : {}),
							...(language ? { language_code: language } : {}),
						}),
					});
			const bytes = Buffer.isBuffer(r.body) ? r.body : Buffer.from(r.body as ArrayBuffer);
			const headers = Object.fromEntries(
				Object.entries(r.headers).map(([k, v]) => [k.toLowerCase(), v]),
			);
			const contentType = headers['content-type'] || '';
			const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();
			// Match the current API's format contract without parsing/copying the audio buffer.
			const expectedType =
				format === 'mp3_44100_128'
					? 'audio/mpeg'
					: format === 'ulaw_8000'
						? 'audio/basic'
						: 'audio/pcm';
			if (!bytes.length || mediaType !== expectedType)
				throw new NodeOperationError(
					this.getNode(),
					'Voicely did not return a complete audio response',
					{ itemIndex: index },
				);
			const extension =
				format === 'mp3_44100_128' ? 'mp3' : format === 'ulaw_8000' ? 'ulaw' : 'pcm';
			const binary = await this.helpers.prepareBinaryData(
				bytes,
				`speech.${extension}`,
				contentType,
			);
			return [
				{
					json: {
						...responseMetadata(headers),
						...('metadata' in r ? (r.metadata as IDataObject) : { idempotencyKey: key }),
						outputFormat: format,
						bytes: bytes.length,
					},
					binary: { [field]: binary },
					pairedItem: { item: index },
				},
			];
		};
		const worker = async (): Promise<void> => {
			while (!failure && next < inputs.length) {
				const index = next++;
				try {
					output[index] = await executeItem(index);
				} catch (error) {
					if (this.continueOnFail())
						output[index] = [
							{
								json: { error: error instanceof Error ? error.message : 'Voicely request failed' },
								pairedItem: { item: index },
							},
						];
					else {
						failure = error;
						return;
					}
				}
			}
		};
		await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker()));
		if (failure) throw failure;
		return [output.flat()];
	}
}

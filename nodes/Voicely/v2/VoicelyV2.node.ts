import { createHash } from 'node:crypto';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { properties } from './properties';
import { automationResourceIds, executeAutomation } from './automation';
import { executionOption } from './options';
import {
	catalogOptions,
	CatalogSelectionError,
	selectionIssue,
	modelRows,
	operationScope,
	speechModel,
	catalogVoiceSelection,
	languageRows,
	languageCatalogModel,
	speechLanguage,
	compactModel,
	customStyle,
} from './discovery';
import { websocketRequest } from './websocket';
import {
	asObject,
	audioMetadata,
	multipart,
	positiveInteger,
	request,
	selectedId,
	sttResponseMessage,
	type BinaryPart,
} from './transport';

function publicVoice(raw: IDataObject): IDataObject {
	return {
		voice_id: raw.voice_id,
		name: raw.name,
		description: raw.description,
		labels: raw.labels,
		category: raw.category,
	};
}
function listPage(body: unknown): {
	voices: IDataObject[];
	stock: IDataObject[];
	next: string | null;
} {
	const page = asObject(body);
	if (
		!Array.isArray(page.voices) ||
		(page.next_cursor !== null && typeof page.next_cursor !== 'string')
	)
		throw Error('voice_page_invalid');
	if (page.stock_voices !== undefined && !Array.isArray(page.stock_voices))
		throw Error('voice_page_invalid');
	return {
		voices: page.voices.map(asObject),
		stock: ((page.stock_voices as unknown[]) ?? []).map(asObject),
		next: page.next_cursor as string | null,
	};
}
function optionsOf(value: unknown): IDataObject {
	if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('options_invalid');
	return value as IDataObject;
}
function jsonField(value: unknown): unknown {
	if (typeof value === 'string') return JSON.parse(value);
	return value;
}
function speechSettings(parameters: IDataObject, operation: string): unknown {
	const supplied =
			parameters.voiceSettings === undefined ? undefined : jsonField(parameters.voiceSettings),
		raw = parameters.styleStrength;
	if (raw === undefined) return supplied;
	if (operation !== 'speechToSpeech') throw Error('custom_style_operation_invalid');
	if (typeof raw === 'string' && !raw.trim()) return supplied;
	if (typeof raw !== 'string' && typeof raw !== 'number') throw Error('custom_style_invalid');
	const strength = Number(raw);
	if (!Number.isFinite(strength) || strength < 0 || strength > 1)
		throw Error('custom_style_invalid');
	const values = supplied === undefined ? {} : optionsOf(supplied);
	if (values.style !== undefined && values.style !== strength) throw Error('custom_style_conflict');
	return { ...values, style: strength };
}

export class VoicelyV2 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Voicely Studio',
		name: 'voicely',
		icon: { light: 'file:voicely.svg', dark: 'file:voicely.svg' },
		group: ['transform'],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		version: 2,
		description: 'Speech, voices, agents and call automation with Voicely',
		defaults: { name: 'Voicely Studio' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'voicelySuiteApi',
				required: true,
				displayOptions: {
					show: { resource: ['language', 'model', 'speech', 'voice'] },
				},
			},
			{
				name: 'voicelyAutomationApi',
				required: true,
				displayOptions: { show: { resource: automationResourceIds } },
			},
		],
		properties,
	};
	methods = {
		listSearch: {
			async getVoices(
				this: ILoadOptionsFunctions,
				filter?: string,
				paginationToken?: string,
			): Promise<INodeListSearchResult> {
				const operation = String(this.getNodeParameter('operation', '') ?? ''),
					resource = String(this.getNodeParameter('resource', 'speech')),
					required = ['textToSpeech', 'speechToSpeech'].includes(operation)
						? operationScope(operation)
						: undefined;
				const catalogSelection =
					resource === 'voice' && operation === 'getAll'
						? catalogVoiceSelection(this.getNodeParameter('catalogOptions', {}))
						: undefined;
				let route = catalogSelection?.route ?? '/v1/voices';
				const query = catalogSelection?.query ?? new URLSearchParams();
				if (paginationToken) query.set('after', paginationToken);
				if (required) {
					query.set('operation', required);
					const options = optionsOf(this.getNodeParameter('additionalOptions', {}) ?? {}),
						selected = speechModel(options),
						model = selected.id;
					if (selected.contract) {
						if (operation !== 'textToSpeech')
							throw new NodeOperationError(this.getNode(), 'API Model is for Text to Speech.');
						route = '/v2/tts/voices';
					}
					if (model) query.set('model_id', model);
					const language = speechLanguage(options);
					if (selected.contract && language) query.set('language_code', language);
				}
				const page = listPage((await request(this, route + (query.size ? '?' + query : ''))).body);
				const needle = filter?.toLocaleLowerCase() ?? '';
				return {
					results: [...page.stock, ...page.voices]
						.filter(
							(v) =>
								String(v.name).toLocaleLowerCase().includes(needle) ||
								String(v.voice_id).includes(needle),
						)
						.map((v) => ({ name: String(v.name), value: String(v.voice_id) })),
					...(page.next ? { paginationToken: page.next } : {}),
				};
			},
			async getLanguages(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const resource = String(this.getNodeParameter('resource', 'speech'));
				const options =
					resource === 'voice'
						? catalogOptions(this.getNodeParameter('catalogOptions', {}))
						: optionsOf(this.getNodeParameter('additionalOptions', {}));
				const selected = speechModel(options);
				if (!selected.contract)
					selectionIssue(
						'Choose Model before loading languages. Legacy workflows can keep Language Code.',
					);
				const model = languageCatalogModel(selected.id);
				const rows = languageRows(
					(await request(this, '/v2/tts/languages?model_id=' + encodeURIComponent(model))).body,
					model,
				);
				return {
					results: rows
						.filter(
							(row) =>
								!filter ||
								String(row.name).toLowerCase().includes(filter.toLowerCase()) ||
								String(row.language_id).toLowerCase().includes(filter.toLowerCase()),
						)
						.map((row) => ({
							name: String(row.name) + (row.preview_in_voicely ? ' (Preview)' : ''),
							value: String(row.language_id),
							description: row.preview_in_voicely
								? 'Preview in Voicely; model-specific availability applies'
								: 'Enabled selection; model-specific availability applies',
						})),
				};
			},
			async getApiModels(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const list = modelRows((await request(this, '/v2/models')).body, 'speech.synthesize');
				return {
					results: list
						.filter(
							(v) =>
								!filter ||
								String(v.name).toLowerCase().includes(filter.toLowerCase()) ||
								String(v.model_id).toLowerCase().includes(filter.toLowerCase()),
						)
						.map((v) => ({
							name: String(v.name),
							value: String(v.model_id),
							description:
								v.can_use_style === true
									? 'Custom style instructions available'
									: 'Custom style instructions unavailable',
						})),
				};
			},
			async getModels(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				const resource = String(this.getNodeParameter('resource', 'speech')),
					operation = String(this.getNodeParameter('operation', '') ?? ''),
					filters = ['model', 'voice'].includes(resource)
						? catalogOptions(this.getNodeParameter('catalogOptions', {}))
						: undefined,
					required = filters
						? operationScope(filters.speechOperation)
						: ['textToSpeech', 'speechToText', 'speechToSpeech'].includes(operation)
							? operationScope(operation)
							: undefined;
				if (resource === 'voice' && required === 'speech.transcribe')
					throw new NodeOperationError(
						this.getNode(),
						'Speech to Text has no voice selection. Choose Text to Speech or Speech to Speech.',
					);
				const list = modelRows((await request(this, '/v1/models')).body, required);
				return {
					results: list
						.filter(
							(v) =>
								!filter ||
								String(v.name).toLowerCase().includes(filter.toLowerCase()) ||
								String(v.model_id).toLowerCase().includes(filter.toLowerCase()),
						)
						.map((v) => ({ name: String(v.name), value: String(v.model_id) })),
				};
			},
		},
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		if (automationResourceIds.includes(String(this.getNodeParameter('resource', 0))))
			return executeAutomation.call(this);
		const input = this.getInputData(),
			output: INodeExecutionData[] = [];
		for (let index = 0; index < input.length; index++) {
			let operationId: string | undefined,
				usingWs = false;
			try {
				const resource = String(this.getNodeParameter('resource', index)),
					operation = String(this.getNodeParameter('operation', index));
				const timeout = Number(executionOption(this, index, 'requestTimeoutMs', 0));
				if (!Number.isSafeInteger(timeout) || timeout < 0) throw Error('timeout_invalid');
				if (resource === 'model' && operation === 'getAll') {
					const filters = catalogOptions(this.getNodeParameter('catalogOptions', index, {})),
						scope = operationScope(filters.speechOperation) ?? 'speech.synthesize',
						all = Boolean(this.getNodeParameter('returnAll', index, false)),
						limit = all ? undefined : positiveInteger(this.getNodeParameter('limit', index, 50)),
						checkedScope =
							scope === 'speech.synthesize'
								? scope
								: (() => {
										selectionIssue(
											'Model Get Many lists TTS models. STT and STS models remain under their Speech operations.',
										);
									})(),
						rows = modelRows((await request(this, '/v2/models', { timeout })).body, checkedScope);
					const simplify = Boolean(executionOption(this, index, 'simplify', true));
					for (const row of limit === undefined ? rows : rows.slice(0, limit))
						output.push({
							json: simplify ? compactModel(row) : row,
							pairedItem: { item: index },
						});
					continue;
				}
				if (resource === 'language' && operation === 'getAll') {
					const model = languageCatalogModel(this.getNodeParameter('languageModel', index, '')),
						all = Boolean(this.getNodeParameter('returnAll', index, false)),
						limit = all ? undefined : positiveInteger(this.getNodeParameter('limit', index, 50)),
						rows = languageRows(
							(
								await request(this, '/v2/tts/languages?model_id=' + encodeURIComponent(model), {
									timeout,
								})
							).body,
							model,
						);
					for (const row of limit === undefined ? rows : rows.slice(0, limit))
						output.push({ json: row, pairedItem: { item: index } });
					continue;
				}
				const item = input[index],
					parameters = optionsOf(this.getNodeParameter('additionalOptions', index, {}));
				const selectedVoiceSettings =
					resource === 'speech' ? speechSettings(parameters, operation) : undefined;
				const business = String(executionOption(this, index, 'operationIdentity', ''));
				operationId = /^op_[a-f0-9]{64}$/.test(business)
					? business
					: 'op_' +
						createHash('sha256')
							.update(
								JSON.stringify(
									business
										? [this.getNode().id, business]
										: [this.getWorkflow().id, this.getExecutionId(), this.getNode().id, index],
								),
							)
							.digest('hex');
				const headers = { 'idempotency-key': operationId },
					pairedItem = { item: index };
				const binaryPart = async (property: string, name: string): Promise<BinaryPart> => {
					if (!property.trim()) throw Error('binary_field_required');
					const binary = this.helpers.assertBinaryData(index, property);
					return {
						name,
						bytes: await this.helpers.getBinaryDataBuffer(index, property),
						filename: binary.fileName ?? 'recording',
						mimeType: binary.mimeType,
					};
				};
				if (resource === 'voice' && operation === 'getAll') {
					const returnAll = Boolean(this.getNodeParameter('returnAll', index, false)),
						limit = returnAll ? undefined : positiveInteger(this.getNodeParameter('limit', index)),
						pageSize = 50,
						simplify = Boolean(executionOption(this, index, 'simplify', true));
					const catalogSelection = catalogVoiceSelection(
							this.getNodeParameter('catalogOptions', index, {}),
						),
						filters = catalogSelection.query;
					let after: string | null = null,
						remaining = limit;
					const seen = new Set<string>(),
						seenVoices = new Set<string>();
					do {
						const query = new URLSearchParams(filters);
						query.set(
							'limit',
							String(remaining === undefined ? pageSize : Math.min(pageSize, remaining)),
						);
						if (after) query.set('after', after);
						const page = listPage(
							(
								await request(this, catalogSelection.route + '?' + query, {
									timeout,
								})
							).body,
						);
						for (const voice of [...page.stock, ...page.voices]) {
							const id = String(voice.voice_id);
							if (seenVoices.has(id)) continue;
							seenVoices.add(id);
							output.push({
								json: simplify ? publicVoice(voice) : voice,
								pairedItem,
							});
							if (remaining !== undefined && --remaining === 0) break;
						}
						if (remaining === 0) break;
						after = page.next;
						if (after) {
							if (seen.has(after)) throw Error('catalog_cursor_did_not_advance');
							seen.add(after);
						}
					} while (after);
					continue;
				}
				if (resource === 'voice' && ['get', 'delete'].includes(operation)) {
					const id = selectedId(this.getNodeParameter('voice', index));
					const reply = await request(this, '/v1/voices/' + encodeURIComponent(id), {
						method: operation === 'delete' ? 'DELETE' : 'GET',
						headers,
						timeout,
					});
					const data = asObject(reply.body);
					output.push({
						json:
							operation === 'get' && Boolean(executionOption(this, index, 'simplify', true))
								? publicVoice(data)
								: data,
						pairedItem,
					});
					continue;
				}
				let route: string, body: unknown, contentType: string, format: string | undefined;
				if (resource === 'voice' && operation === 'createClone') {
					const name = String(this.getNodeParameter('name', index, ''));
					if (!name.trim()) throw Error('voice_name_required');
					const fields = optionsOf(this.getNodeParameter('additionalFields', index, {})),
						names = String(this.getNodeParameter('audioFiles', index))
							.split(',')
							.map((v) => v.trim());
					if (!names.length || names.some((v) => !v)) throw Error('reference_fields_required');
					const files = await Promise.all(names.map((name) => binaryPart(name, 'reference')));
					files.push(
						await binaryPart(String(this.getNodeParameter('consentFile', index)), 'consent'),
					);
					const data = multipart(
						{
							name,
							...(fields.description === undefined
								? {}
								: { description: String(fields.description) }),
							...(fields.labels === undefined
								? {}
								: { labels: JSON.stringify(jsonField(fields.labels)) }),
						},
						files,
					);
					body = data.body;
					contentType = data.contentType;
					route = '/v1/voices/add';
				} else if (
					resource === 'speech' &&
					['textToSpeech', 'speechToText', 'speechToSpeech'].includes(operation)
				) {
					const selected = speechModel(parameters),
						model = selected.id,
						language = speechLanguage(parameters);
					if (operation !== 'textToSpeech') customStyle(parameters, operation, 'http');
					if (selected.contract && operation !== 'textToSpeech')
						selectionIssue(
							"API Model is for Text to Speech. Select the operation's model instead.",
						);
					format = String(parameters.outputFormat ?? 'mp3_44100_128');
					if (operation !== 'speechToText') {
						audioMetadata(format);
						if (!String(this.getNodeParameter('outputBinaryField', index, 'audio')).trim())
							throw Error('output_binary_field_required');
					}
					if (operation === 'textToSpeech') {
						const text = String(this.getNodeParameter('text', index, '')),
							style = customStyle(
								parameters,
								operation,
								String(executionOption(this, index, 'speechTransport', 'http')),
							);
						if (!text.trim()) throw Error('speech_text_required');
						const id = selectedId(this.getNodeParameter('voice', index));
						route =
							(selected.contract ? '/v2/text-to-speech/' : '/v1/text-to-speech/') +
							encodeURIComponent(id) +
							'?output_format=' +
							encodeURIComponent(format);
						body = {
							text,
							...(style === undefined ? {} : { delivery_style: style }),
							...(model ? { model_id: model } : {}),
							...(language ? { language_code: language } : {}),
							...(selectedVoiceSettings === undefined
								? {}
								: { voice_settings: selectedVoiceSettings }),
						};
						contentType = 'application/json';
					} else {
						const file = await binaryPart(
							String(this.getNodeParameter('file', index)),
							operation === 'speechToText' ? 'file' : 'audio',
						);
						const fields: Record<string, string> = {};
						if (model) fields.model_id = model;
						if (operation === 'speechToText') {
							if (language) fields.language_code = language;
							fields.diarize = String(parameters.diarize ?? true);
							const timestampPolicy =
								parameters.timestampPolicy === undefined ? 'strict' : parameters.timestampPolicy;
							if (
								typeof timestampPolicy !== 'string' ||
								!['strict', 'best_effort'].includes(timestampPolicy)
							)
								throw new NodeOperationError(this.getNode(), 'Invalid timestamp handling', {
									itemIndex: index,
								});
							// Omit strict to preserve the established request contract and operation replay.
							if (timestampPolicy === 'best_effort') fields.timestamp_policy = 'best_effort';
							if (parameters.numberOfSpeakers !== undefined)
								fields.num_speakers = String(positiveInteger(parameters.numberOfSpeakers));
							route = '/v1/speech-to-text';
							format = undefined;
						} else {
							const id = selectedId(this.getNodeParameter('voice', index));
							route =
								'/v1/speech-to-speech/' +
								encodeURIComponent(id) +
								'?output_format=' +
								encodeURIComponent(format);
							if (selectedVoiceSettings !== undefined)
								fields.voice_settings = JSON.stringify(selectedVoiceSettings);
						}
						const data = multipart(fields, [file]);
						body = data.body;
						contentType = data.contentType;
					}
				} else throw Error('operation_unsupported');
				const transport =
					resource === 'speech' && operation === 'textToSpeech'
						? String(executionOption(this, index, 'speechTransport', 'http'))
						: 'http';
				if (!['http', 'websocket'].includes(transport)) throw Error('transport_invalid');
				usingWs = transport === 'websocket';
				const reply = usingWs
					? await websocketRequest(this, {
							voice: selectedId(this.getNodeParameter('voice', index)),
							text: String(this.getNodeParameter('text', index)),
							format: format!,
							model: speechModel(parameters).id ?? '',
							modelContract: speechModel(parameters).contract,
							language: speechLanguage(parameters) ?? '',
							timeout,
							...(selectedVoiceSettings === undefined
								? {}
								: { voiceSettings: asObject(selectedVoiceSettings) }),
						})
					: await request(this, route, {
							method: 'POST',
							headers: { ...headers, 'content-type': contentType },
							body: body as IDataObject | Buffer,
							json: contentType === 'application/json',
							...(resource === 'speech' && operation === 'speechToText'
								? { ignoreHttpStatusErrors: true }
								: {}),
							...(format ? { encoding: 'arraybuffer' as const } : {}),
							timeout,
						});
				if (format) {
					const expected = audioMetadata(format),
						contentType = Object.entries(reply.headers).find(
							([name]) => name.toLowerCase() === 'content-type',
						)?.[1];
					if (
						typeof contentType !== 'string' ||
						contentType.split(';')[0].trim().toLowerCase() !== expected.mimeType
					)
						throw Error('audio_content_type_invalid');
					if (!Buffer.isBuffer(reply.body) && !(reply.body instanceof ArrayBuffer))
						throw Error('binary_response_invalid');
					const audio = Buffer.isBuffer(reply.body) ? reply.body : Buffer.from(reply.body),
						metadata = audioMetadata(format),
						property = String(this.getNodeParameter('outputBinaryField', index, 'audio'));
					if (!property.trim()) throw Error('output_binary_field_required');
					output.push({
						json: {
							...item.json,
							...(usingWs ? { transport: 'websocket', websocketReplay: false } : { operationId }),
						},
						binary: {
							...item.binary,
							[property]: await this.helpers.prepareBinaryData(
								audio,
								metadata.fileName,
								metadata.mimeType,
							),
						},
						pairedItem,
					});
				} else output.push({ json: asObject(reply.body), pairedItem });
			} catch (cause) {
				const selectionError =
					cause instanceof CatalogSelectionError ? cause.message : sttResponseMessage(cause);
				const error = new NodeOperationError(
					this.getNode(),
					selectionError ?? 'Voicely operation could not complete',
					{
						itemIndex: index,
						description: usingWs
							? 'No retry or HTTP fallback was made. WebSocket sessions cannot be replayed; completed segments may already be charged.'
							: 'No automatic retry was made.' +
								(operationId
									? ' Reuse operation identity ' + operationId + ' when checking uncertain work.'
									: ''),
					},
				);
				if (!this.continueOnFail()) throw error;
				output.push({
					json: {
						error: selectionError ?? 'Voicely operation could not complete',
						...(!usingWs && operationId ? { operationId } : {}),
					},
					pairedItem: { item: index },
				});
			}
		}
		return [output];
	}
}

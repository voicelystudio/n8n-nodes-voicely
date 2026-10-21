'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { NodeApiError } = require('n8n-workflow');
const { Voicely } = require('../dist/nodes/Voicely/Voicely.node');
const { VoicelyApi } = require('../dist/credentials/VoicelyApi.credentials');
const {
	responseMetadata,
	serviceOrigin,
	timeoutValue,
} = require('../dist/nodes/Voicely/transport');
const AUDIO = Buffer.from([0x49, 0x44, 0x33, 0, 1, 2, 3]);
const OK = () => ({
	statusCode: 200,
	body: AUDIO,
	headers: {
		'content-type': 'audio/mpeg',
		'x-voicely-request-id': 'fake-request',
		'x-voicely-characters-charged': '100',
	},
});
function fixture({
	items = [{}],
	respond = async () => OK(),
	concurrency = 1,
	continueOnFail = false,
	execution = 'execution-1',
	run = 0,
} = {}) {
	const calls = [],
		prepared = [];
	const defaults = {
		resource: 'speech',
		operation: 'generate',
		text: 'Hello from a fake-only Voicely test.',
		voiceId: 'vly_f08',
		modelId: '',
		languageCode: '',
		outputFormat: 'mp3_44100_128',
		binaryProperty: 'audio',
		options: {},
	};
	const context = {
		getInputData: () => items.map(() => ({ json: {} })),
		getNodeParameter(name, index, fallback) {
			if (name === 'itemConcurrency') return concurrency;
			if (Object.hasOwn(items[index] ?? {}, name)) return items[index][name];
			return defaults[name] ?? fallback;
		},
		getCredentials: async () => ({
			apiKey: 'fake-secret-never-print',
			serviceUrl: 'https://n8n-dev.tryvoicely.com',
		}),
		getExecutionId: () => execution,
		evaluateExpression(expression) {
			assert.equal(expression, '{{$runIndex}}');
			return run;
		},
		getNode: () => ({
			id: 'fake-node',
			name: 'Voicely',
			type: '@voicelystudio/n8n-nodes-voicely.voicely',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		continueOnFail: () => continueOnFail,
		helpers: {
			async httpRequestWithAuthentication(credential, options) {
				assert.equal(credential, 'voicelyApi');
				calls.push(options);
				return respond(options, calls.length);
			},
			async prepareBinaryData(bytes, fileName, mimeType) {
				prepared.push({ bytes, fileName, mimeType });
				return { data: bytes.toString('base64'), fileName, mimeType };
			},
		},
	};
	return { context, calls, prepared, execute: () => new Voicely().execute.call(context) };
}

test('credential stores a password key, injects only header auth, and tests with a non-generating GET', () => {
	const c = new VoicelyApi();
	assert.equal(c.properties.find((p) => p.name === 'apiKey').typeOptions.password, true);
	assert.equal(c.authenticate.properties.headers['xi-api-key'], '={{$credentials.apiKey}}');
	assert.equal(c.test.request.method, 'GET');
	assert.equal(c.test.request.url, '/v1/user');
	assert.equal(c.test.request.disableFollowRedirect, true);
});
test('generation uses the dedicated service, binary helper, metadata and paired item without duplicate audio JSON', async () => {
	const f = fixture();
	const [rows] = await f.execute();
	assert.equal(f.calls.length, 1);
	assert.equal(f.calls[0].url, 'https://n8n-dev.tryvoicely.com/v1/text-to-speech/vly_f08');
	assert.equal(f.calls[0].disableFollowRedirect, true);
	assert.equal(f.calls[0].encoding, 'arraybuffer');
	assert.strictEqual(f.prepared[0].bytes, AUDIO);
	assert.equal(rows[0].binary.audio.fileName, 'speech.mp3');
	assert.deepEqual(rows[0].pairedItem, { item: 0 });
	assert.equal(rows[0].json.chargedCharacters, 100);
	assert.equal(rows[0].json.requestId, 'fake-request');
	assert.ok(!JSON.stringify(rows[0].json).includes(AUDIO.toString('base64')));
	assert.ok(!JSON.stringify(rows).includes('fake-secret-never-print'));
});
test('long multilingual text is sent unchanged without trimming, splitting or a hard character cap', async () => {
	const text = 'اردو हिन्दी 字🙂 '.repeat(5000);
	const f = fixture({ items: [{ text, languageCode: 'ur', modelId: 'discovered-model' }] });
	await f.execute();
	const body = JSON.parse(f.calls[0].body);
	assert.equal(body.text, text);
	assert.equal(body.language_code, 'ur');
	assert.equal(body.model_id, 'discovered-model');
	assert.equal(f.calls.length, 1);
});
test('missing and non-string expression values give an indexed validation error before any request', async () => {
	for (const field of ['text', 'voiceId', 'binaryProperty']) {
		for (const value of [undefined, null, 42, {}, false, '   ']) {
			const f = fixture({ items: [{ [field]: value }] });
			await assert.rejects(f.execute(), (error) => {
				assert.equal(error.name, 'NodeOperationError');
				assert.match(error.message, /must be non-empty strings/);
				assert.equal(error.context.itemIndex, 0);
				return true;
			});
			assert.equal(f.calls.length, 0);
			assert.equal(f.prepared.length, 0);
		}
	}
});
test('automatic retry keys remain stable for an item attempt; workflow reruns and loop iterations are distinct', async () => {
	const a = fixture({ items: [{}, {}] });
	const b = fixture({ items: [{}, {}] });
	await a.execute();
	await b.execute();
	assert.equal(a.calls[0].headers['Idempotency-Key'], b.calls[0].headers['Idempotency-Key']);
	assert.notEqual(a.calls[0].headers['Idempotency-Key'], a.calls[1].headers['Idempotency-Key']);
	const next = fixture({ execution: 'execution-2' });
	const loop = fixture({ run: 1 });
	await next.execute();
	await loop.execute();
	assert.notEqual(a.calls[0].headers['Idempotency-Key'], next.calls[0].headers['Idempotency-Key']);
	assert.notEqual(a.calls[0].headers['Idempotency-Key'], loop.calls[0].headers['Idempotency-Key']);
});
test('business retry keys are preserved across workflow executions', async () => {
	for (const execution of ['execution-1', 'execution-2']) {
		const f = fixture({ execution, items: [{ options: { idempotencyKey: 'fake-business-job' } }] });
		await f.execute();
		assert.equal(f.calls[0].headers['Idempotency-Key'], 'fake-business-job');
	}
});
test('configurable concurrency works above 50 without changing output order', async () => {
	let active = 0,
		max = 0;
	const f = fixture({
		items: Array.from({ length: 80 }, (_, i) => ({ text: 'item-' + i })),
		concurrency: 55,
		respond: async () => {
			active++;
			max = Math.max(max, active);
			await new Promise((resolve) => setTimeout(resolve, 5));
			active--;
			return OK();
		},
	});
	const [rows] = await f.execute();
	assert.equal(rows.length, 80);
	assert.equal(max, 55);
	assert.deepEqual(
		rows.map((row) => row.pairedItem.item),
		Array.from({ length: 80 }, (_, i) => i),
	);
	assert.equal(active, 0);
});
test('serial failure stops new paid submissions; no implicit retry or empty-success audio', async () => {
	const f = fixture({
		items: [{}, {}, {}],
		respond: async () => {
			throw {
				response: {
					statusCode: 429,
					body: { code: 'rate_limit_exceeded', detail: { status: 'rate_limit_exceeded' } },
				},
				config: { headers: { 'xi-api-key': 'fake-secret-never-print' } },
			};
		},
	});
	await assert.rejects(f.execute(), (e) => {
		assert.match(e.message, /rate_limit_exceeded/);
		assert.ok(!JSON.stringify(e).includes('fake-secret-never-print'));
		return true;
	});
	assert.equal(f.calls.length, 1);
	assert.equal(f.prepared.length, 0);
});
test('parallel failure drains already-started work before returning the error', async () => {
	let active = 0;
	const f = fixture({
		items: [{}, {}, {}, {}],
		concurrency: 3,
		respond: async (opts, n) => {
			active++;
			await new Promise((resolve) => setTimeout(resolve, n === 1 ? 1 : 10));
			active--;
			if (n === 1)
				throw {
					response: {
						statusCode: 503,
						data: { code: 'provider_unavailable', detail: { status: 'provider_unavailable' } },
					},
				};
			return OK();
		},
	});
	await assert.rejects(f.execute());
	assert.equal(active, 0);
	assert.equal(f.calls.length, 3);
});
test('Continue On Fail returns a linked error item and processes later items', async () => {
	const f = fixture({
		items: [{}, {}],
		continueOnFail: true,
		respond: async (opts, n) =>
			n === 1
				? {
						statusCode: 402,
						body: { code: 'insufficient_credits', detail: { status: 'insufficient_credits' } },
						headers: {},
					}
				: OK(),
	});
	const [rows] = await f.execute();
	assert.equal(rows.length, 2);
	assert.match(rows[0].json.error, /insufficient_credits/);
	assert.equal(rows[0].binary, undefined);
	assert.ok(rows[1].binary.audio);
	assert.equal(f.calls.length, 2);
});
test('raw formats get truthful extensions and unknown billing fields are omitted', async () => {
	for (const [outputFormat, extension] of [
		['pcm_16000', 'pcm'],
		['pcm_24000', 'pcm'],
		['ulaw_8000', 'ulaw'],
	]) {
		const f = fixture({
			items: [{ outputFormat }],
			respond: async () => ({
				statusCode: 200,
				body: AUDIO,
				headers: { 'content-type': outputFormat === 'ulaw_8000' ? 'audio/basic' : 'audio/pcm' },
			}),
		});
		const [rows] = await f.execute();
		assert.equal(rows[0].binary.audio.fileName, 'speech.' + extension);
		assert.equal(rows[0].json.chargedCharacters, undefined);
		assert.equal(rows[0].json.characterBalance, undefined);
	}
});
test('empty/JSON audio is rejected and request timeout has no upper clamp', async () => {
	for (const response of [
		{ statusCode: 200, body: Buffer.alloc(0), headers: {} },
		{ statusCode: 200, body: Buffer.from('{}'), headers: { 'content-type': 'application/json' } },
	]) {
		const f = fixture({ respond: async () => response });
		await assert.rejects(f.execute(), /audio response/);
		assert.equal(f.prepared.length, 0);
	}
	for (const n of [0, 900000000]) {
		const f = fixture({ items: [{ options: { requestTimeoutMs: n } }] });
		await f.execute();
		assert.equal(f.calls[0].timeout, n);
	}
});
test('voice/model loaders use discovered IDs; full catalog produces separate linked items', async () => {
	const f = fixture({
		items: [{ resource: 'voice', operation: 'getMany' }],
		respond: async (options) => ({
			statusCode: 200,
			headers: {},
			body: options.url.endsWith('/v1/models')
				? [{ name: 'Discovered', model_id: 'real-model' }]
				: {
						voices: [
							{ name: 'Voice A', voice_id: 'voice-a' },
							{ name: 'Voice B', voice_id: 'voice-b' },
						],
					},
		}),
	});
	const node = new Voicely();
	assert.deepEqual(await node.methods.loadOptions.getVoices.call(f.context), [
		{ name: 'Voice A', value: 'voice-a' },
		{ name: 'Voice B', value: 'voice-b' },
	]);
	assert.deepEqual(await node.methods.loadOptions.getModels.call(f.context), [
		{ name: 'API Default', value: '' },
		{ name: 'Discovered', value: 'real-model' },
	]);
	const [rows] = await f.execute();
	assert.equal(rows.length, 2);
	assert.equal(rows[1].json.voice_id, 'voice-b');
	assert.deepEqual(rows[1].pairedItem, { item: 0 });
});
test('URL validation prevents query secrets/path injection; validation rejects invalid values without a new cap', () => {
	assert.equal(serviceOrigin('https://n8n-dev.tryvoicely.com/'), 'https://n8n-dev.tryvoicely.com');
	assert.throws(() => serviceOrigin('https://example.invalid/?key=secret'));
	assert.throws(() => serviceOrigin('https://user:pass@example.invalid'));
	assert.throws(() => timeoutValue(-1));
	assert.throws(() => timeoutValue(''));
	assert.equal(timeoutValue(999999999), 999999999);
	assert.deepEqual(responseMetadata({ 'X-Voicely-Replay': 'true' }), { replayed: true });
});
test('public package declares no external runtime dependencies and includes only compiled node paths', () => {
	const p = require('../package.json');
	assert.equal(p.dependencies, undefined);
	assert.equal(p.n8n.strict, true);
	for (const f of [...p.n8n.nodes, ...p.n8n.credentials])
		assert.ok(fs.existsSync(path.join(__dirname, '..', f)));
	for (const f of ['Voicely.node.js', 'transport.js']) {
		const source = fs.readFileSync(path.join(__dirname, '../dist/nodes/Voicely', f), 'utf8');
		assert.doesNotMatch(source, /process\.env|require\(['"](?:node:)?fs['"]\)/);
		assert.doesNotMatch(source, /better-sqlite3|sqlite|spendV2|auditV2|\/v1\/user|setInterval/);
	}
});

test('actual API code/status survives raw, serialized and binary error bodies without exposing secrets', async () => {
	for (const encode of [
		(value) => value,
		JSON.stringify,
		(value) => Buffer.from(JSON.stringify(value)),
	]) {
		for (const body of [
			{ code: 'insufficient_credits' },
			{ detail: { status: 'insufficient_credits' } },
		]) {
			const f = fixture({
				respond: async () => ({ statusCode: 402, headers: {}, body: encode(body) }),
			});
			await assert.rejects(f.execute(), (error) => {
				assert.match(error.message, /insufficient_credits/);
				assert.equal(error.httpCode, '402');
				assert.ok(!JSON.stringify(error).includes('fake-secret-never-print'));
				return true;
			});
			assert.equal(f.calls.length, 1);
		}
	}
});

test('real n8n NodeApiError cause, errorResponse and context wrappers preserve the safe error code', async () => {
	for (const wrapper of ['cause', 'errorResponse', 'context']) {
		const f = fixture({
			respond: async () => {
				const response = {
					status: 409,
					data: Buffer.from(
						JSON.stringify({
							code: 'idempotency_mismatch',
							detail: { status: 'idempotency_mismatch' },
						}),
					),
				};
				const raw = Object.assign(new Error('untrusted fake-secret-never-print'), {
					response,
					config: { headers: { 'xi-api-key': 'fake-secret-never-print' } },
				});
				if (wrapper === 'cause') throw new NodeApiError(f.context.getNode(), raw);
				if (wrapper === 'errorResponse') throw new NodeApiError(f.context.getNode(), { response });
				const wrapped = new NodeApiError(f.context.getNode(), { httpCode: '409' });
				wrapped.context.data = { detail: { status: 'idempotency_mismatch' } };
				throw wrapped;
			},
		});
		await assert.rejects(f.execute(), (error) => {
			assert.match(error.message, /idempotency_mismatch/);
			assert.equal(error.httpCode, '409');
			assert.ok(!JSON.stringify(error).includes('fake-secret-never-print'));
			return true;
		});
	}
});

test('cyclic or untrusted errors stay generic and secret-free; local transport detail.code remains supported', async () => {
	for (const shape of ['cycle', 'secret', 'html', 'local']) {
		const f = fixture({
			respond: async () => {
				if (shape === 'cycle') {
					const error = {};
					error.cause = error;
					throw error;
				}
				const body =
					shape === 'secret'
						? { code: 'fake-secret-never-print' }
						: shape === 'html'
							? '<html>fake-secret-never-print</html>'
							: { detail: { code: 'integration_upstream_timeout' } };
				throw { response: { statusCode: 504, body } };
			},
		});
		await assert.rejects(f.execute(), (error) => {
			assert.match(
				error.message,
				shape === 'local' ? /integration_upstream_timeout/ : /request_failed/,
			);
			assert.ok(!JSON.stringify(error).includes('fake-secret-never-print'));
			return true;
		});
	}
});

test('canonical request ID is returned without inventing the legacy header', () => {
	assert.deepEqual(responseMetadata({ 'X-Voicely-Request-Id': 'req_actual' }), {
		requestId: 'req_actual',
	});
	assert.deepEqual(responseMetadata({ 'X-Request-Id': 'wrong-header' }), {});
});

test('200 non-audio, missing and wrong-format media types never become successful audio', async () => {
	for (const type of [
		'text/html',
		'text/plain',
		'application/json',
		'image/png',
		'',
		'audio/pcm',
	]) {
		const f = fixture({
			respond: async () => ({ statusCode: 200, body: AUDIO, headers: { 'content-type': type } }),
		});
		await assert.rejects(f.execute(), /audio response/);
		assert.equal(f.prepared.length, 0);
		assert.equal(f.calls.length, 1);
	}
});

test('all supported audio MIME types allow parameters/case and reuse the response buffer', async () => {
	for (const [outputFormat, mime] of [
		['mp3_44100_128', 'Audio/MPEG; mode=mono'],
		['pcm_16000', 'audio/pcm'],
		['pcm_24000', 'audio/pcm; rate=24000'],
		['ulaw_8000', 'audio/basic'],
	]) {
		const f = fixture({
			items: [{ outputFormat }],
			respond: async () => ({ statusCode: 200, body: AUDIO, headers: { 'content-type': mime } }),
		});
		await f.execute();
		assert.strictEqual(f.prepared[0].bytes, AUDIO);
		assert.equal(f.calls.length, 1);
	}
});

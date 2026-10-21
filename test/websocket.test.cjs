'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Voicely } = require('../dist/nodes/Voicely/Voicely.node');
const { wsDeadline } = require('../dist/nodes/Voicely/websocket');
const AUDIO = Buffer.from('fake-audio-not-a-provider');
const SECRET = 'fake_ws_secret';

function fakeSocket(
	t,
	script = (socket) => {
		socket.emit('message', {
			data: JSON.stringify({ audio: AUDIO.toString('base64'), isFinal: null }),
		});
		socket.emit('message', { data: JSON.stringify({ audio: null, isFinal: true }) });
		socket.emit('close', { code: 1000 });
	},
) {
	const sockets = [];
	const original = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');
	class Fake {
		constructor(url) {
			this.url = url;
			this.sent = [];
			this.listeners = new Map();
			this.closed = 0;
			sockets.push(this);
			queueMicrotask(() => this.emit('open', {}));
		}
		addEventListener(name, fn) {
			if (!this.listeners.has(name)) this.listeners.set(name, new Set());
			this.listeners.get(name).add(fn);
		}
		removeEventListener(name, fn) {
			this.listeners.get(name)?.delete(fn);
		}
		emit(name, event) {
			for (const fn of this.listeners.get(name) ?? []) fn(event);
		}
		send(raw) {
			this.sent.push(JSON.parse(raw));
			if (this.sent.length === 3) setImmediate(() => script(this));
		}
		close() {
			this.closed++;
		}
	}
	Object.defineProperty(globalThis, 'WebSocket', {
		configurable: true,
		writable: true,
		value: Fake,
	});
	t.after(() => {
		if (original) Object.defineProperty(globalThis, 'WebSocket', original);
		else delete globalThis.WebSocket;
	});
	return sockets;
}

function fixture({ items = [{}], concurrency = 1, signal, continueOnFail = false } = {}) {
	let httpCalls = 0;
	const prepared = [];
	const defaults = {
		resource: 'speech',
		operation: 'generateWebSocket',
		text: 'Hello Urdu हिन्दी 🙂.',
		voiceId: 'vly_f08',
		modelId: 'discovered-model',
		languageCode: 'ur',
		outputFormat: 'mp3_44100_128',
		binaryProperty: 'audio',
		options: { requestTimeoutMs: 2000 },
	};
	const context = {
		getInputData: () => items.map(() => ({ json: {} })),
		getNodeParameter: (name, i, fallback) =>
			name === 'itemConcurrency' ? concurrency : (items[i]?.[name] ?? defaults[name] ?? fallback),
		getCredentials: async () => ({ serviceUrl: 'https://n8n-dev.tryvoicely.com', apiKey: SECRET }),
		getNode: () => ({
			id: 'fixture',
			name: 'Voicely',
			type: 'CUSTOM.voicely',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		getExecutionCancelSignal: () => signal,
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequestWithAuthentication: () => {
				httpCalls++;
				assert.fail('WS must not submit HTTP or poll balances');
			},
			prepareBinaryData: async (bytes, fileName, mimeType) => {
				prepared.push({ bytes, fileName, mimeType });
				return { data: bytes.toString('base64'), fileName, mimeType };
			},
		},
	};
	return {
		context,
		prepared,
		httpCalls: () => httpCalls,
		execute: () => new Voicely().execute.call(context),
	};
}

test('WS operation authenticates in the first frame only, sends exact text once and returns linked binary', async (t) => {
	const sockets = fakeSocket(t),
		f = fixture();
	const [rows] = await f.execute();
	assert.equal(sockets.length, 1);
	assert.equal(f.httpCalls(), 0);
	const socket = sockets[0],
		url = new URL(socket.url);
	assert.equal(url.origin, 'wss://n8n-dev.tryvoicely.com');
	assert.equal(url.pathname, '/v1/text-to-speech/vly_f08/stream-input');
	assert.equal(url.searchParams.get('model_id'), 'discovered-model');
	assert.equal(url.searchParams.get('language_code'), 'ur');
	assert.ok(!socket.url.includes(SECRET));
	assert.deepEqual(socket.sent, [
		{ text: ' ', xi_api_key: SECRET },
		{ text: 'Hello Urdu हिन्दी 🙂.' },
		{ text: '' },
	]);
	assert.deepEqual(f.prepared[0].bytes, AUDIO);
	assert.equal(rows[0].json.transport, 'websocket');
	assert.equal(rows[0].json.audioFrames, 1);
	assert.equal(rows[0].json.idempotencyKey, undefined);
	assert.equal(rows[0].json.chargedCharacters, undefined);
	assert.equal(rows[0].json.characterBalance, undefined);
	assert.deepEqual(rows[0].pairedItem, { item: 0 });
	assert.equal(rows[0].binary.audio.fileName, 'speech.mp3');
	assert.ok(!JSON.stringify(rows[0].json).includes(AUDIO.toString('base64')));
	assert.ok(!JSON.stringify(rows).includes(SECRET));
	assert.equal(socket.closed, 1);
	assert.ok([...socket.listeners.values()].every((set) => set.size === 0));
});

test('WS large multilingual input is never truncated, segmented locally or capped', async (t) => {
	const sockets = fakeSocket(t),
		text = 'اردو हिन्दी 🙂 字 '.repeat(6000);
	await fixture({ items: [{ text }] }).execute();
	assert.equal(sockets[0].sent[1].text, text);
	assert.equal(sockets[0].sent.length, 3);
});

test('WS chunk order is preserved; raw formats have truthful MIME and extensions', async (t) => {
	fakeSocket(t, (socket) => {
		for (const part of ['first', 'second', 'last'])
			socket.emit('message', {
				data: JSON.stringify({ audio: Buffer.from(part).toString('base64') }),
			});
		socket.emit('message', { data: '{"audio":null,"isFinal":true}' });
		socket.emit('close', { code: 1000 });
	});
	for (const [outputFormat, fileName, mimeType] of [
		['pcm_16000', 'speech.pcm', 'audio/pcm'],
		['pcm_24000', 'speech.pcm', 'audio/pcm'],
		['ulaw_8000', 'speech.ulaw', 'audio/basic'],
	]) {
		const f = fixture({ items: [{ outputFormat }] });
		await f.execute();
		assert.equal(f.prepared[0].bytes.toString(), 'firstsecondlast');
		assert.equal(f.prepared[0].fileName, fileName);
		assert.equal(f.prepared[0].mimeType, mimeType);
	}
});

test('missing native WS fails before submission, without importing a dependency or falling back', async (t) => {
	fakeSocket(t);
	delete globalThis.WebSocket;
	const f = fixture();
	await assert.rejects(f.execute(), /native WebSocket/);
	assert.equal(f.httpCalls(), 0);
	assert.equal(f.prepared.length, 0);
});

test('HTTP-only idempotency key is refused on WS before a session opens', async (t) => {
	const sockets = fakeSocket(t);
	await assert.rejects(
		fixture({ items: [{ options: { idempotencyKey: 'job' } }] }).execute(),
		/HTTP Generate/,
	);
	assert.equal(sockets.length, 0);
});

test('partial, malformed, corrupt, empty and abnormal-close streams never become successful audio', async (t) => {
	const scripts = [
		(s) => s.emit('close', { code: 1000 }),
		(s) => {
			s.emit('message', { data: '{"audio":"YQ=="}' });
			s.emit('close', { code: 1000 });
		},
		(s) => {
			s.emit('message', { data: '{"audio":"YQ==","isFinal":true}' });
			s.emit('close', { code: 1011 });
		},
		(s) => {
			s.emit('message', { data: '{"audio":null,"isFinal":true}' });
			s.emit('close', { code: 1000 });
		},
		(s) => s.emit('message', { data: '{broken' }),
		(s) => s.emit('message', { data: '[]' }),
		(s) => s.emit('message', { data: Buffer.from('binary not JSON') }),
		(s) => s.emit('message', { data: '{"audio":"not base64!"}' }),
		(s) => s.emit('message', { data: '{"audio":42}' }),
		(s) => {
			s.emit('message', { data: '{"isFinal":true}' });
			s.emit('message', { data: '{"audio":"YQ=="}' });
		},
	];
	// One fake class, variable script: no extra global mock teardown complexity.
	let current;
	const sockets = fakeSocket(t, (s) => current(s));
	for (current of scripts) {
		const f = fixture();
		await assert.rejects(f.execute());
		assert.equal(f.prepared.length, 0);
		assert.equal(f.httpCalls(), 0);
	}
	assert.equal(sockets.length, scripts.length);
});

test('provider errors stay secret-free; no retry even after partial charged audio', async (t) => {
	let code = 'insufficient_balance';
	const sockets = fakeSocket(t, (s) => {
		s.emit('message', { data: '{"audio":"YQ=="}' });
		s.emit('message', { data: JSON.stringify({ error: code, message: SECRET }) });
	});
	for (code of ['insufficient_balance', SECRET, '<html>']) {
		const f = fixture();
		await assert.rejects(f.execute(), (error) => {
			assert.ok(!JSON.stringify(error).includes(SECRET));
			assert.match(
				error.message,
				code === 'insufficient_balance' ? /insufficient_balance/ : /provider_error/,
			);
			return true;
		});
		assert.equal(f.prepared.length, 0);
		assert.equal(f.httpCalls(), 0);
	}
	assert.equal(sockets.length, 3);
});

test('configured WS deadline closes once and a zero deadline stays disabled', async (t) => {
	let release;
	const sockets = fakeSocket(t, (s) => {
		release = () => {
			s.emit('message', { data: '{"audio":"YQ==","isFinal":true}' });
			s.emit('close', { code: 1000 });
		};
	});
	await assert.rejects(
		fixture({ items: [{ options: { requestTimeoutMs: 15 } }] }).execute(),
		/request_timeout/,
	);
	assert.equal(sockets[0].closed, 1);
	const f = fixture({ items: [{ options: { requestTimeoutMs: 0 } }] }),
		pending = f.execute();
	await new Promise((resolve) => setTimeout(resolve, 30));
	release();
	await pending;
	assert.equal(sockets[1].closed, 1);
});

test('cancellation before connect and during audio closes work without returning partial audio', async (t) => {
	let onSend;
	const sockets = fakeSocket(t, (s) => onSend(s));
	const early = new AbortController();
	early.abort();
	await assert.rejects(fixture({ signal: early.signal }).execute(), /execution_cancelled/);
	assert.equal(sockets.length, 0);
	const live = new AbortController();
	onSend = (s) => {
		s.emit('message', { data: '{"audio":"YQ=="}' });
		live.abort();
	};
	const f = fixture({ signal: live.signal });
	await assert.rejects(f.execute(), /execution_cancelled/);
	assert.equal(f.prepared.length, 0);
	assert.equal(sockets[0].closed, 1);
});

test('WS configurable concurrency above 50 preserves item order without polling or an account cap', async (t) => {
	let active = 0,
		peak = 0;
	const sockets = fakeSocket(t, (s) => {
		active++;
		peak = Math.max(peak, active);
		setTimeout(() => {
			s.emit('message', { data: '{"audio":"YQ==","isFinal":true}' });
			s.emit('close', { code: 1000 });
			active--;
		}, 15);
	});
	const f = fixture({
		items: Array.from({ length: 70 }, (_, i) => ({ text: 'item-' + i })),
		concurrency: 55,
	});
	const [rows] = await f.execute();
	assert.equal(rows.length, 70);
	assert.equal(peak, 55);
	assert.equal(sockets.length, 70);
	assert.deepEqual(
		rows.map((r) => r.pairedItem.item),
		Array.from({ length: 70 }, (_, i) => i),
	);
	assert.equal(f.httpCalls(), 0);
	assert.equal(active, 0);
});

test('WS Continue On Fail returns linked errors and later audio, without a silent retry', async (t) => {
	let count = 0;
	const sockets = fakeSocket(t, (s) => {
		if (++count === 1) s.emit('error', { message: SECRET });
		else {
			s.emit('message', { data: '{"audio":"YQ==","isFinal":true}' });
			s.emit('close', { code: 1000 });
		}
	});
	const f = fixture({ items: [{}, {}], continueOnFail: true });
	const [rows] = await f.execute();
	assert.equal(rows.length, 2);
	assert.match(rows[0].json.error, /connection_failed/);
	assert.equal(rows[0].binary, undefined);
	assert.ok(rows[1].binary.audio);
	assert.equal(sockets.length, 2);
	assert.equal(f.httpCalls(), 0);
});

test('large deadlines use one native-sized timer, have no upper clamp and cancel cleanly', (t) => {
	const pending = new Set();
	const delays = [];
	t.mock.method(globalThis, 'setTimeout', (fn, delay) => {
		delays.push(delay);
		const timer = { fn };
		pending.add(timer);
		return timer;
	});
	t.mock.method(globalThis, 'clearTimeout', (timer) => pending.delete(timer));
	const disabled = wsDeadline(0, () => assert.fail());
	assert.equal(pending.size, 0);
	disabled();
	const cancel = wsDeadline(Number.MAX_SAFE_INTEGER, () => assert.fail());
	assert.deepEqual(delays, [2 ** 31 - 1]);
	assert.equal(pending.size, 1);
	cancel();
	cancel();
	assert.equal(pending.size, 0);
});

test('a large audio frame is decoded without a regex stack ceiling or corruption', async (t) => {
	const large = Buffer.alloc(1000000, 61);
	fakeSocket(t, (s) => {
		s.emit('message', { data: JSON.stringify({ audio: large.toString('base64'), isFinal: true }) });
		s.emit('close', { code: 1000 });
	});
	const f = fixture();
	await f.execute();
	assert.deepEqual(f.prepared[0].bytes, large);
});

test('a platform buffer allocation failure rejects safely rather than escaping the event callback', async (t) => {
	fakeSocket(t, (s) => {
		s.emit('message', { data: '{"audio":"YQ=="}' });
		s.emit('message', { data: '{"audio":"Yg==","isFinal":true}' });
		s.emit('close', { code: 1000 });
	});
	t.mock.method(Buffer, 'concat', () => {
		throw new RangeError('fixture allocation failure');
	});
	const f = fixture();
	await assert.rejects(f.execute(), /audio_buffer_failed/);
	assert.equal(f.prepared.length, 0);
});

test('WS runtime has no DB, environment, filesystem, polling, external library or audio JSON output', () => {
	const source = fs.readFileSync(require.resolve('../dist/nodes/Voicely/websocket'), 'utf8');
	assert.doesNotMatch(
		source,
		/process\.env|require\(['"](?:node:)?(?:fs|ws|undici)['"]\)|better-sqlite3|sqlite|spendV2|auditV2|setInterval|\/v1\/user/,
	);
});

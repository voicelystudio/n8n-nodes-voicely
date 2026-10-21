# Voicely for n8n

Voicely-maintained text-to-speech integration for n8n workflows, with HTTP and WebSocket operations.

## Credentials

Create a Voicely API key and fund its API wallet using Voicely's existing account controls.
In n8n create a **Voicely API** credential. Its password field stores the key.
The Service URL defaults to `https://n8n.tryvoicely.com`; staging is `https://n8n-dev.tryvoicely.com`.
Do not send a real key to an unverified destination.
Credential testing only reads `/v1/user`; it never generates or charges for audio.
The configured service receives your key: only use a destination you trust. Redirects are disabled.

## Initial operations

- Speech / Generate: text, discovered voice/model, language and output format to audio in `binary.audio`.
- Speech / Generate via WebSocket: receive WS audio chunks, validate final completion, then return
  one complete file in the same binary field. Requires native server-side WebSocket (Node.js 22+).
- Voice / Get Many: the complete voice catalog, one output item per voice.

## Install and try

Self-hosted n8n administrators can install a published release of
`@voicelystudio/n8n-nodes-voicely` from **Settings > Community nodes > Install**.
n8n Cloud availability requires n8n verification. npm publication alone does not enable Cloud installation.
Use a current n8n runtime with Node.js 22 or newer for the WebSocket operation.

Import [HTTP speech](https://github.com/voicelystudio/n8n-nodes-voicely/blob/main/examples/http-speech.json) or
[WebSocket speech](https://github.com/voicelystudio/n8n-nodes-voicely/blob/main/examples/websocket-speech.json) into n8n. Select your Voicely API credential
in the Voicely node, choose an available voice from the list, and press **Execute workflow**.
The examples contain no API key or stored execution data and do not start automatically.
The output's **Binary** tab contains `audio`, ready for another node that accepts binary input.
The examples are in the public repository, not the minimal npm runtime payload.

An API wallet funds generation. A successful credential test does not prove credit availability.
HTTP and WS are paid API operations; there is no special n8n billing plan or second charge.
For failures, inspect the returned status/code and your workflow settings before retrying.
Keep Retry On Fail disabled for WebSocket because a partly completed session can already be billed.

## Support

Report reproducible integration bugs in
[GitHub Issues](https://github.com/voicelystudio/n8n-nodes-voicely/issues), including the n8n version,
operation, safe error code and request ID when available. Never post keys, audio or private text.
Account or billing questions: [administrator@tryvoicely.com](mailto:administrator@tryvoicely.com).

The text is never silently clipped or split. No local character, rate, daily or spending cap is imposed.
Item Concurrency is configurable, defaults to one, and has no coded upper ceiling.
Request Timeout is configurable in node Options; zero disables it, with no coded upper ceiling.
Voicely's API and the n8n host/workflow keep their own configured limits. Runtime node settings must use
n8n Parameters/Credentials, not direct env/filesystem access. Dedicated backend settings use server env.

Programmatic style is used to coordinate configurable in-flight items, stable per-item retry keys,
safe binary/error handling and item linkage, rather than only declarative one-request routing.
There are no external runtime dependencies, direct database calls, filesystem/env access or hidden retry loops.

MP3 returns `.mp3`; raw PCM returns `.pcm`; mu-law returns `.ulaw`. Raw audio is not mislabeled as WAV.
Language can be left to API detection; set it explicitly when needed. Roman Urdu requires `ur`.
Only applied API controls are exposed: no ineffective style/speed knobs or timestamp promises.
Missing billing metadata is omitted rather than invented. n8n owns binary storage.

## Retries and billing

Voicely alone handles charging and credits. This node does not check balances before every request.
No automatic retry is performed by the node. n8n Retry On Fail is a separate workflow setting.
The n8n host's authentication helper may re-authenticate and repeat an HTTP request after a 401;
this is separate from the node's behavior. Correct invalid credentials before rerunning a workflow.
For HTTP Generate, an automatic idempotency key is stable for the same execution/node/run/item; a new workflow execution gets
a new key. Supply a stable business-job key expression if retries must survive whole-workflow reruns.
Do not use one constant business key for different texts. An uncertain response is not permission to charge again.
In parallel mode, already-submitted items may complete and be charged even if another item fails.
Continue On Fail returns a linked error item, not empty audio pretending to be success.
n8n execution history can retain submitted text and audio; configure its retention appropriately.

## WebSocket behavior

Select **Speech > Generate via WebSocket** and use the same trusted Service URL, credential,
discovered voice/model, text, language, output format and binary field. Clear any HTTP Idempotency
Key option. The node changes the configured origin to `wss:` (`ws:` for local HTTP fixtures) and uses
`/v1/text-to-speech/<voice>/stream-input`. The API key travels only in the required first JSON frame,
never a query parameter. HTTP credential/discovery requests remain HTTP.

The operation uses the host's native WebSocket, no external runtime dependency. A host without it
fails clearly before submission; HTTP Generate remains available. The dedicated service must have
its separately configured WS upstream and upgrade routing activated.

This is WebSocket transport into a normal n8n action, not live chunk delivery between downstream
workflow nodes. The action collects decoded chunks, joins them once at completion, releases them,
and gives the complete file to n8n binary storage. Concurrent long audio consumes proportional
memory; choose Item Concurrency accordingly. The private relay pipes raw bytes with backpressure
and does not decode, copy audio into JSON, transcode or access the database.

The returned JSON includes `transport`, `audioFrames`, `firstAudioMs`, `totalMs`, `outputFormat`
and `bytes`, not audio/base64 or invented session IDs/charges/balance. Timings are measured from
connection start in this client. The standard WebSocket does not expose upgrade response headers.
Partial/corrupt/error streams or abnormal closure fail without returning partial audio as success.
Request Timeout covers the entire session; workflow cancellation closes its socket and clears its
deadline. There are no node-authored frame, byte, text, batch or session-duration ceilings.

WS does **not** provide HTTP idempotent replay. No automatic retry, reconnect or HTTP fallback is
made. Completed upstream segments may already be charged when a later segment fails. Do not enable
n8n Retry On Fail for uncertain WS sessions. Switching from HTTP is an explicit operation choice,
not a promise of lower workflow completion time or true realtime workflow execution.

## AI Agent tool

Connect **Voicely** to an n8n **AI Agent** through its Tool connector. Select **Voice → Get Many**
and attach your existing Voicely API credential. The agent receives actual voice IDs and names
as JSON and can use them in its answer. This action does not generate audio or spend TTS credits.

Import the [AI Agent voice example](https://github.com/voicelystudio/n8n-nodes-voicely/blob/main/examples/ai-agent-voices.json) for a ready-wired example.
Configure the Voicely credential and a separate chat-model credential, then execute the workflow.
The example uses n8n's OpenAI Chat Model; a compatible tool-calling model connected to the agent
can be used instead. Model access and any model charges are separate from Voicely.

This does not add an LLM or speech-to-text service to Voicely. AI tools consume JSON, not a playable
audio response. For speech generation with binary output, use the existing HTTP or WebSocket action
in the main workflow and pass its binary file to the next node. Do not rely on the AI Agent to play
or forward generated audio. No billing, polling, dependency or operational limit is added by tool support.

## Development

Generated with the official n8n programmatic scaffold.
`npm run build`, `npm run lint`, and `npm test` are local package checks, not Next/SaaS builds.
Use `npm run dev` for an isolated development n8n instance. Real generation uses your API credits.

The node opts into n8n's native tool wrapper with `usableAsTool: true`. The documented agent example
uses Voice → Get Many, which returns JSON. No verification lint rule is disabled.
Install development tooling with `npm ci --ignore-scripts`: a transitive lint dependency's
package-manager enforcement lifecycle fails under npm. Explicit build, lint and test still run.
The installed CLI can launch a local n8n npm subprocess or use an external instance. Docker is
not mandatory for local npm mode. Automated integration fixtures use an isolated n8n engine,
synthetic HTTP/WS upstreams and the packed community package. They cover credentials, discovery,
linked binary output, error/cancel paths, multilingual batches and the public example workflows.
Synthetic tests do not establish live provider capacity or n8n Cloud compatibility.

The private sibling `voicely-n8n-service` is not part of this npm package or public source.
It forwards to the existing API, which retains the central Voicely DB and billing ownership.

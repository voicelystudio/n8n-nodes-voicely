# HTTP Custom Style Instructions — staging handoff

Completed 2026-11-03T20:49:47.972666+00:00.

**IMPLEMENTED / SYNTHETICALLY TESTED / STAGING ACTIVATED / OWNER STYLE-AUDIO UAT REQUIRED / NO PAID INFERENCE / PRODUCTION UNCHANGED / NOT PUBLISHED**.

## Owner-approved scope

Optional natural-language delivery instructions for six canonical TTS models; HD excluded. Streaming output/playback is deferred to a separate future upgrade. Preserve Model→Language→Voice, seven technical IDs, voices, language normalization, legacy model defaults, quotas/accounting and existing saved WS compatibility.

| Model | Style instructions | New delivery |
|---|---|---|
| Voicely Classic | Available | HTTP completed audio |
| Voicely Classic Pro | Available | HTTP completed audio |
| Voicely Speech Preview | Available; model preview status retained | HTTP completed audio |
| Voicely Narration | Available | HTTP completed audio |
| Voicely Narration Lite | Available | HTTP completed audio |
| Voicely Classic Lite (Preview) | Available; preview retained | HTTP completed audio |
| Voicely HD | Unavailable | Existing normal generation unchanged |

## Actual implementation

Node `Model and Speech Options → Custom Style Instructions` is an optional multiline field. It appears after selecting one of the six canonical Model IDs, is hidden for HD/STT/STS/legacy/savedWS combinations, and permits an expression-selected model with runtime validation. Invalid nonempty combinations reject before the node sends a request. After switching to HD with a retained style, clear the old field (switch back to a supported model to remove it if hidden); it is never silently discarded or applied to another engine.

Node maps trimmed nonempty text to existing HTTP `delivery_style`. Script stays in `text`; numeric STS Custom Style Strength and voice_settings.style are different controls. Blank/whitespace/absent instructions omit delivery_style and preserve original request/identity. Legacy Model/defaults are not automatically upgraded.

Suite advertises can_use_style for exactly six models, style_transports=[http], style_streaming=false. HD is false/empty. The Narration pair sends verbatim transcript plus speechMetadata.style. Older supported models reuse the accepted Studio instruction-wrapper semantics. Target IDs/endpoints/voices/audio processing are unchanged. Server revalidates type, selected model and configured combined-input budget before quote/financial hold. Existing deliveryStyle hash slot differentiates styles; same identity/style replays once, a different style conflicts. Spoken-script text remains the existing quote/billing basis; no new rate, balance, entitlement, refund or payment policy.

Removed new streaming selector and promotion from current node UI/compact discovery. Existing saved transport execution paths and WS modules are retained. Canonical styled streaming is explicitly refused before quote/hold/provider; no WS style-field/protocol extension or chunk output was added. See STREAMING-DEFERRED.md.

## Exact source and build identities

- Node source checkpoint: `f2be35ea50a5db013f2977e117d0f3f88e928def`. Earlier recoverable style checkpoint2e295608 also retained.
- Node local package0.2.1: SHA256 `521f60ceeeab6010581dcddc057333ff2f3349bdc05548663cdb3469314a7f40`, 66files, 64156bytes.
- Suite source checkpoint: `a07e618968647e94a6d8dfe60f7b8c2d7e3294a3`.
- Node parent: `69e5dc3580832bb59c546ef3be9ec279728b8d23`. Suite parent: `f9261095759f6b23ea4d4f735a07c5630ecb595f`.
- New independent Suite source: `/home/myeduprojects/n8n-suite-style-20261103T203153Z`.
- Node code changes: v2/properties.ts, v2/discovery.ts, v2/VoicelyV2.node.ts; scoped tests/docs/package file list. No second authored regular node.
- Suite runtime changes: apiTtsContract.mjs and service.mjs only; exact hashes in SOURCE-CHANGES.json. HTTP/WS modules, old cloud/stock, financial adapters, budgets/config/assembly and API registry untouched.
- Reversible raw patches and losslessgzip copies retained. Frozen parent 369tracked inputs verified unchanged.

## Verification actually executed

| Check | Actual result |
|---|---|
| Official n8n CLI build/lint | PASS on final source |
| Complete node regression | **216/216PASS**,0fail/skip;205previous cases retained/adapted only for approved UI deferral,11new style cases |
| New backend style cases | **14/14PASS** inside the final combined run |
| Initial focused Suite integration |45/45PASS; includes old adapter/language tests, six provider payload shapes, real compiled-node→HTTP Suite→actual provider-adapter fixtures |
| Final broader Suite |**192total /191PASS /1FAIL /0SKIP**; one unchanged inherited style-wording test |
| Protected runtime proof |18existing runtime files byte-identical; canonical model/language registry unchanged |
| Staging HTTP |10/10 expected responses: health200, anonymous catalog/language/voice endpoints401 over loopback+HTTPS |
| Browser |Five fresh unauthenticated editor-shell views320/390/768/1024/1440;0pageerrors/overflow, external network blocked before navigation |
| Actual loaded descriptor |Custom Style Instructions present; Speech Transport selector absent; nine resources, one regular node plus Trigger |
| Owner signed-in style widget/live audio |Not executed by agent; owner UAT pending |
| Real provider/wallet behavior |Not certified; no paid call or manual financial mutation |

Broader inherited failure remains `stream sends exact transcript/style/voice and produces aligned PCM plus one EOF completion`: old cloudSpeech instruction-prefix versus newer test speechMetadata expectation. That legacy module/test assertion was not changed. New canonical 3.8 structured metadata tests pass. No full-suite green claim or baseline force-pass.

An intermediate combined rerun incorrectly overlapped CLI dist cleanup and a dependent compiled-node wire test, producing MODULE_NOT_FOUND. After build finished, the combined run was repeated: the harness error disappeared, leaving only the inherited failure. Initial editor activation stopped before mutation because its prior artifact record used `file` instead of `filename`; reader corrected to that existing field and exact old package SHA reverified. First artifacts/logs and these outcomes remain recorded; no assertion weakened.

## Activation and safety

Suite staging `voicely-n8n-suite-dev` PID369763→387743 at127.0.0.1:3041 / https://n8n-suite-dev.tryvoicely.com. Artifact root selected by the original ordered environment-file launcher; original 7env inputs preserved and only a private source-root overlay appended. No credential, financial/provider limit or publication setting changed.

Review editor `voicely-n8n-review-v021-dev` PID369843→387853, **http://localhost:5680**. Old package SHA `ff4804c09882cbe8ca6691ab627b1fdcf6ef500f6a2a286686c4b4a3e176fc89` verified against installed files before replacement. Only these two processes changed. Old editor5678, Web, separate API/WS/Mobile/Calling/STT/STS/relay services retained their states. No owner workflow edit or credential/session access. nginx config hash unchanged. Main HEAD/status fingerprint unchanged and no main application edit performed. No production connection/deployment, GitHub push/npm publication, PM2save or real inference/payment.

Bounded READ ONLY preflight: stageDBvoicely_staging at10.128.0.11,0dispatched operations; review editor0active workflows/0in-flight executions before replacement. Service-owned normal housekeeping remains normal; no manual customer/business mutation was issued.

## Input-budget limitation

Existing configured CLOUD_INPUT_BYTES remains **16777216bytes** and is reused for combined prepared transcript/style admission. This is an application/transport ceiling, **not certification of Google's model token limit**. No tokenizer or new stricter commercial/input cap was introduced. Oversize synthetic tests prove this configured guard and pre-hold rejection, not provider acceptance of all smaller payloads. Model-specific provider token-budget admission remains a separate production review item; use short scripts/styles for initial owner UAT. No new entitlement or guaranteed maximum was advertised.

## Owner UAT

1. Hard refresh localhost5680. Use existing staging Suite credential; do not change production URLs.
2. Open existing Generate Speech → Model and Speech Options → choose Voicely Narration, Language, Voice; add **Custom Style Instructions**.
3. Example instruction: `Warm, calm and confident delivery`. Put actual narration only in Text. HTTP completed-audio output remains default.
4. Check the field is available for six models and unavailable for HD/STT/STS/Legacy Model. Model Get Many now exposes can_use_style and explicit HTTP-only style scope.
5. Blank/remove style: normal generation unchanged. For retained style when switching to HD, switch back/remove it before selecting HD; incompatible manual/expression combinations reject, with no silent engine switch.
6. No new streaming selector should appear. Existing saved WS-only workflows without style remain compatible; do not expect new style+WS support.
7. Owner may manually assess audible style effect through normal authorized staging usage. Agent has not made or scheduled paid inference and does not claim six-model provider-style audio certification.

## Rollback

Preserve source checkpoints and node-source-before.tar.gz. Restore editor package first while idle: stop only voicely-n8n-review-v021-dev, preserve current package directory, rename `/home/myeduprojects/n8n-nodes-voicely-review-v021-20261103T140631Z/uat-editor-20261103T143539Z/style-rollback-previous-package` back to `/home/myeduprojects/n8n-nodes-voicely-review-v021-20261103T140631Z/uat-editor-20261103T143539Z/user/.n8n/nodes/node_modules/@voicelystudio/n8n-nodes-voicely`, restart only that editor and verify readiness. Do not reset/remove its SQLite DB or credentials.

If restoring the paired Suite source is needed:

```bash
pm2 startOrRestart /home/myeduprojects/n8n-suite-style-20261103T203153Z/private/suite-rollback.config.cjs --only voicely-n8n-suite-dev --update-env
```

Private rollback/activation configs are0600; original source/env inputs remain recoverable. New style-configured workflows must remove the new field or remain on the new version; rollback does not automatically rewrite them. Temporary staging PM2 state was not saved for reboot persistence.

## Remaining release gates

Owner actual style-audio UAT, provider/token-budget acceptance, inherited legacy test mismatch and the earlier separate STT reliability issue remain explicit. Coordinated production Suite+package release and provenance-backed publication require separate owner approval. Standalone Public API/WS, Web, Android/n8n production services were not updated. Streaming receiver/playback/chunk design is intentionally deferred.

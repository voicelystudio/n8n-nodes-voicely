# Model → Language → Voice dependency & Suite parity — staging handoff

Completed 2026-11-03T17:37:58.659298+00:00.

**STAGING SUITE ACTIVE / REVIEW EDITOR ACTIVE / SYNTHETICALLY VERIFIED / OWNER AUTHENTICATED UAT REQUIRED / PROVIDER NOT VERIFIED / PRODUCTION UNCHANGED / NOT PUBLISHED**.

## Outcome

Preserved the existing seven-model canonical contract, old Suite model/default behavior, all model/voice technical IDs and the prior 190 node cases. Added model-dependent language discovery and selection within the existing regular Voicely Studio node. The package still registers one action node and its companion Trigger. Separate discovery nodes are optional.

| Surface | Current behavior |
|---|---|
| Model → Get Many | Seven canonical TTS entries. Default SimplifyON gives compact fields/counts; SimplifyOFF returns full language arrays. Count means selectable options, not independent provider-language totals. |
| Language → Get Many | Required Model selector, Return All/Limit, one selected model's languages as individual paired items. |
| Generate Speech | Model and Speech Options → Model, then Language; searchable model-specific choices, with Voicely-preview labels. Voice options depend on model and language. |
| Voice → Get Many | Catalog Options → Speech Operation=TTS → Model → optional Language. Service validates compatibility. |
| HTTP / WS | Still Options → Speech Transport inside Generate Speech. No extra mandatory node or silent HTTP fallback. |
| Legacy | Saved additionalOptions.model / languageCode and blank/default behavior unchanged. No automatic migration to canonical engine. |

Selectable counts: five older models39, Narration138, NarrationLite109. Urdu remains available in all seven via the unchanged accepted compatibility/normalization pathway. This is not a claim of native Urdu in Google's documented matrix or certification of every selectable language. Model switches never silently substitute engine/voice/language; incompatible retained combinations are refused. Existing Language Code accepts saved aliases; the new Language picker uses exact registry selection IDs.

The voice list comes from the accepted canonical stock catalog and may be identical across models/languages. This implementation validates model/language admission, not a newly certified provider-level voice/accent matrix. Owned/native/STS voices remain on the original contract. The user must reselect/check Voice after changes; the node does not rewrite saved workflows.

## Found and fixed canonical streaming defect

The existing canonical stream branch selected apiStock voice objects but invoked legacy stock.synthesizeStream. The stock adapter checks voice object identity; distinct canonical/legacy catalogs can therefore reject before reaching the right adapter. Corrected one selected adapter reference to activeStock.synthesizeStream. A new regression uses distinct objects/adapters and proves canonical→api and legacy→legacy. Earlier tests used the same fixture stock instance, masking this defect. No real provider call was made, so successful provider audio is still owner UAT.

## Exact identities

- Node source: `ff1c7ff727ee14524eb0e9341e092801b35c6040`; local package0.2.1.
- Package SHA256: `ff4804c09882cbe8ca6691ab627b1fdcf6ef500f6a2a286686c4b4a3e176fc89`; 65files, 62345bytes.
- Suite source: `63240f99aacdb302d45e9daa4e40871522fec015`; independent workspace `/home/myeduprojects/n8n-suite-discovery-20261103T171935Z`.
- Node parent: `73eb494bde5befcc4195090853241eb61f8fa7cd`. Frozen Suite parent `8a16ad6fd49fad73774c7606240d22fe203bcf35` preserved byte-for-byte across 353tracked inputs.
- Review editor localhost5680: PID361667→369843.
- Staging Suite127.0.0.1:3041 / https://n8n-suite-dev.tryvoicely.com: PID361505→369763.

## Changed files and evidence

`SOURCE-CHANGES.json` lists every source/test/doc/package change with before/afterSHA256. `node.patch` and `suite.patch` are reversible patches (losslessgzip copies are versioned; raw context whitespace is preserved); no main synchronization. Node runtime changes are limited to v2/properties.ts, v2/discovery.ts and v2/VoicelyV2.node.ts. New guide/example and regression expectations cover the explicitly approved ninth resource and compact default. Suite runtime edits are12insertions/4deletions in http.mjs, metadata.mjs, service.mjs, plus two new synthetic test files. All accepted API model/language registry files remain byte-identical.

The authenticated new read-only endpoint `/v2/tts/languages?model_id=...` uses catalog/read. `/v2/tts/voices` now passes language_code to canonical admission. Existing /v1 routes and defaults are unchanged. New canonical flows remain staging only; production backend has not gained these changes.

## Verification actually executed

| Check | Result |
|---|---|
| Official n8n CLI build | PASS |
| Official n8n CLI lint | PASS; first run2unused-local errors, fixed and rerun without bypass |
| Full node suite | **205/205PASS**,0fail/skip; includes190prior cases plus15new cases |
| New Suite/registry/compiled-node wire tests | **13/13PASS**,0fail/skip |
| Broader selected Suite run | **176total:175PASS/1FAIL/0SKIP**; retained inherited speechStream style-wording mismatch |
| Real compiled node→real loopback HTTP Suite | Seven-model compact discovery→Urdu language→voice→synthetic audioPASS; narrower-model mismatch refuses |
| Existing HTTP/WS adapter and wire checks | Included in selected Suite run; canonical stream regression uses distinct adapter identities |
| Staging HTTP checks |10/10 expected results: health200; unauthenticated v1/v2 model, language and voice paths401 on loopback and HTTPS |
| Browser | Five fresh signin-shell views320/390/768/1024/1440:0pageerrors, no horizontal overflow; external requests blocked before navigation |
| Authenticated owner node panel / live audio | **NOT RUN by agent**; owner credentials/sessions were not accessed |
| Financial/provider/DB integration | Synthetic only; no real inference, payment, wallet mutation or customer-row inspection |

The broader Suite failure is the same historical test `stream sends exact transcript/style/voice and produces aligned PCM plus one EOF completion`: old generic cloudSpeech emits an instruction-prefix while newer test expects speechMetadata. cloudSpeech/speechStream were not changed and the assertion was not weakened. This task does not claim all backend tests are green or resolve that separate issue.

Initial setup also encountered missing `python` command (used python3), an existing cloned dependency symlink (resumed same setup), and missing local Git identity in the new clone (reused parent commit identity locally). No dirty-main or global Git configuration was changed. Complete run/failure logs are preserved as losslessgzip.

## Compliance

One authored regular node plus Trigger; ninth resource is not a second node. ReturnAll/Limit retained and no PageSizeUI. Optional language/transport/simplification controls live in collections; Language discovery Model is required. Codex nodeVersion1.0 and runtime versions1/2 retained. No runtime env/filesystem access or external dependency added to the node. All shipped UI/docs English. Official CLI lint/build passed; this is not n8n review approval. Publication/provenance and coordinated production backend release remain separate owner gates.

## Runtime safety

Read-only bounded preflight verified stagingDBvoicely_staging at10.128.0.11 and0dispatched Suite work; editor aggregate checks found0active workflows/0in-flight executions. Original six ordered Suite env files remain unchanged, with a new private overlay containing only VOICELY_SUITE_ARTIFACT_ROOT. Provider settings, quotas/budgets, accounting, sessions and entitlements unchanged. Eleven requested protected runtime paths were inspected; ten existing files including funding/store/operations/cloudSpeech/transcription/nativeSpeech/capacity/wsAdmission/wsTextQuotes/stock were hashed unchanged (no cpu.mjs exists under that name). API pure input registry unchanged. Existing service-owned housekeeping continues normally; no manual business/financial data write was performed.

Only Suite and review-editor processes changed. Old editor5678, stagingWeb/API/WS/Mobile/Calling/STT/STS/n8nrelay and all other PM2 states remained unchanged. nginx hash unchanged. Main HEAD/status fingerprint unchanged; no application edits performed there. No production connection/deployment, GitHub push or npm publication. No PM2save; temporary launch state is not promised across reboot.

## Owner UAT — no separate discovery chain required

1. Hard refresh **http://localhost:5680**, select existing **staging Suite** credential.
2. Model→GetMany: expect seven compact rows. Options→SimplifyOFF restores detailed arrays.
3. Language→GetMany: select Model; check Urdu and counts39/138/109 for appropriate models. Limit works without provider requests.
4. GenerateSpeech→ModelandSpeechOptions: add **Model**, then **Language**. Leave LegacyModel/LanguageCode empty for a new selection. Search Urdu and then select Voice. HTTP/WS lives under Options.
5. Voice→GetMany: SpeechOperation=TTS, Model, Language; expect admitted stock voices. Voice equality across models is allowed.
6. Switch Narration to Lite with a Flash-only language retained: request is refused, no silent engine substitution. Clear/reselect supported Language and Voice. Execution-level generic service error wording is inherited; manually supplied IDs still rely on server admission.
7. Check an existing saved legacy workflow's settings/defaults are intact. Metadata-only example `examples/studio-v2-model-language-voice-discovery.json` selects one model/language/voice and makes no synthesis request.

Do not connect all7models×alllanguages×allvoices directly to paid synthesis unintentionally. This package does not execute automatic owner provider UAT. A successful small sample would still not certify every model/language.

## Rollback

Suite rollback configuration (private0600): `/home/myeduprojects/n8n-suite-discovery-20261103T171935Z/private/suite-rollback.config.cjs`. Command:

```bash
pm2 startOrRestart /home/myeduprojects/n8n-suite-discovery-20261103T171935Z/private/suite-rollback.config.cjs --only voicely-n8n-suite-dev --update-env
```

For paired rollback, restore editor package first while idle: stop only voicely-n8n-review-v021-dev; preserve current package; rename `/home/myeduprojects/n8n-nodes-voicely-review-v021-20261103T140631Z/uat-editor-20261103T143539Z/dependency-rollback-previous-package` back to `/home/myeduprojects/n8n-nodes-voicely-review-v021-20261103T140631Z/uat-editor-20261103T143539Z/user/.n8n/nodes/node_modules/@voicelystudio/n8n-nodes-voicely`; restart only that editor and verify readiness. Do not remove/reset its SQLite DB or credentials. Then restore Suite if needed. Source backup: `/home/myeduprojects/n8n-nodes-voicely-review-v021-20261103T140631Z/dependency-refinement-20261103T171935Z/node-source-before.tar.gz`; old Suite source remains frozen at `/home/myeduprojects/n8n-suite-model-parity-20261103T155526Z`. Source checkpoints/patches are recoverable. New Language-resource workflows require the new package/backend and are not automatically downgraded by a package rollback.

## Remaining gates

Owner authenticated node-panel UAT, real provider permissions/output/voice-language quality, inherited style-test mismatch and earlier separate STT reliability issue remain explicit. Existing backend budgets are unchanged. No production or publication approval is implied by these staging results.

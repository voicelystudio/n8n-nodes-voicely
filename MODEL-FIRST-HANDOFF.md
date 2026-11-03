# Model-first discovery refinement — staging package 0.2.1

Prepared 2026-11-03 UTC. Parent: `761e0ff107d49b91c1938e35889df03fb85cd45a`. Owner reported the previous six Voice Get Many UAT steps PASS, then approved this focused model-first refinement. Package remains unpublished0.2.1; n8n runtime Studio version2 is unchanged.

## Implemented

- Same regular Studio node gains **Model → Get Many**. Model/Voice/Speech use the existing `voicelySuiteApi` credential. Agent/Call/Delivery/Tool/Subscription remain on `voicelyAutomationApi`. No extra regular node introduced.
- Model catalog comes from the selected Suite Service URL `/v1/models`, accepting array/envelope contracts. Return All and Limit are supported; optional Speech Operation filters TTS/STT/STS using advertised `operations`. Output includes public `model_id`, `name`, and `operations` only where supplied. No hardcoded provider catalog, language counts, model mapping or endpoint change.
- **Voice → Get Many → Catalog Options:** choose Speech Operation first, then Model. The voice model field is offered only for TTS/STS. Both filters are sent on every cursor page; stock/owned voice eligibility is determined by the backend. Limit, Return All, internal50 page size, stock deduplication and cursor-loop protection remain intact.
- Voice listing with empty Catalog Options keeps the old generic catalog without additional model-discovery requests. A model with no operation is rejected locally with a specific safe message. A scripted STT voice filter is refused before networking. Voice Get/Delete management views remain unfiltered.
- Existing `additionalOptions` collection is renamed **Model and Speech Options** and moved before Voice. The saved `additionalOptions.model` key, model IDs, voices, defaults, output formats, speech payloads, credits and service routing remain unchanged. Model switches refresh voice discovery; a previously saved voice is never silently substituted. Users should reselect a compatible voice; backend admission remains authoritative and is not newly bypassed.
- Existing configured synthesis needs no mandatory Model/Voice discovery nodes and no extra catalog reads. No live inference was run. New optional discovery chain example is inactive and contains no credentials.

## Important architecture boundary

Suite model/voice catalog is its own service authority, separate from Web/Public API deployments. This package exposes what that endpoint actually advertises; it does not activate or backport model engines. Source review found Suite `/v1/voices` accepts `operation` + `model_id`, rejects model-without-operation, and chooses reference eligibility from the selected engine. Public/private voice content and provider outputs were not inspected. This establishes the filtering contract; it does not independently certify every voice/model/provider combination.

STT model filtering works, but STT has no voice choice. This task does not fix the separate intermittent backend transcription timing error.

## Verification

- Initial combined suite: **180/180 PASS**, before final two UI/compatibility tests.
- Final full combined suite after all changes: **182/182 PASS, 0 failed, 0 skipped**. Includes all161 review-correction cases plus21 model-first cases. Full final rerun after the lint error correction also passed182/182; counts are distinct cases, not summed runs.
- Standard n8n CLI build PASS; CLI lint PASS with no rule disable. First lint accidentally traversed live-editor generated cache and was stopped; verification was then run on a byte-identical source snapshot outside that runtime tree. Clean first lint flagged a custom error directly thrown in a list-search method; it was replaced with n8n `NodeOperationError`, then build/test/lint passed. Failed/stopped runs retained in evidence.
- Exact clean verification snapshot source comparison:0 mismatches. Twelve protected package files (V1, V2 transport/WS, credentials, automation, trigger and saved-option helper) byte-identical to761e0ff; see `model-first-evidence/protected-package-inputs.json`.
- Standard local npm pack PASS, one regular node + companion Trigger, discovery helper compiled, no old standalone Agents payload. Artifact hash is in `model-first-evidence/artifact.json`.
- Production, Web main, existing editor5678 and product backends are outside activation scope. No paid inference, customer DB write, credentials export, nginx change or npm/GitHub publication.

## Owner UAT after review-editor activation

Use the same SSH tunnel and localhost5680 editor, then hard refresh. Keep Service URL `https://n8n-suite-dev.tryvoicely.com` and a staging key with catalog/voice-read scopes.

1. **Model → Get Many**. Catalog Options → Speech Operation = Text to Speech. Return All ON. Execute: public TTS model rows, each with model_id/name/operations. Repeat filter for STT/STS; no audio generated.
2. **Voice → Get Many**. Catalog Options → Speech Operation = Text to Speech, then add Model and select a returned model. Return All OFF, Limit3. Execute: service-compatible voices.
3. Change the model; rerun voice discovery. Some models legitimately share a voice set; differing lists are not guaranteed. For STS choose Speech to Speech and a conversion model. STT must not be selectable as a voice operation.
4. In **Speech → Text to Speech**, Model and Speech Options appears before Voice. Select/change the model and reopen Voice to see refreshed compatible choices. Do not execute synthesis as part of these discovery checks.
5. Optional inactive example `examples/studio-v2-model-first-discovery.json` maps model ID into Voice Catalog Options via `={{ $json.model_id }}`. It lists1model and up to3voices, no synthesis. For a later generation step use `={{ $('Get Models').item.json.model_id }}` and the compatible `voice_id`; avoid accidental generation per catalog item.
6. Existing saved speech workflows retain parameter paths. Existing generic Voice Get Many still works with no Catalog Options. V1 stays version1; do not upgrade by editing its node version.

Authenticated rendered-field/customer operation UAT belongs to the owner. Runtime descriptor checks and browser sign-in-shell checks are distinct from a real credentialed workflow PASS. Activation evidence, actual checkpoint, previous/new package identity and rollback are recorded separately after the guarded editor update.

## Activation completed

Source `c5e185fb77c19253e3aa58d843591cb6203afb15` now runs only in the existing review UAT editorlocalhost5680. User state preserved. Runtime descriptor and explicit Chromium/signin checks pass; owner credentialed discovery UAT remains pending. See `MODEL-FIRST-ACTIVATION.md` for exact identities and rollback. The first browser probe failed on a premature root redirect assertion, then passed after a narrow harness fix; no app source changed.

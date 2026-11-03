# Model-first staging UAT activation

**ACTIVATED ON REVIEW EDITOR5680 / OWNER UAT PENDING / NOT PUBLISHED / PRODUCTION UNCHANGED**

Activation UTC: 2026-11-03T15:26:26.251765+00:00.

Source checkpoint: `c5e185fb77c19253e3aa58d843591cb6203afb15`.

Package0.2.1 artifact SHA-256: `dba0634695cb40a2fa50fd77e0b7faec7d97e0d81ab316a59dc834f0eab0d2d9`.

Previous0.2.1 artifact SHA-256: `4b05ec39d96703dddc954cd8861ddfa0e08e2d864c2f69f49139f659ee1bcb4c`.

## Live status and isolation

- Use existing SSH tunnel and **http://localhost:5680**; hard refresh. Owner setup is complete and existing editor user/workflow/credential state is retained. No credentials were accessed/copied and no workflows edited.
- Only PM2 `voicely-n8n-review-v021-dev` restarted: PID349319 → 354729. All other existing process PID/status/restart tuples unchanged. Old editor5678 remains healthy on0.2.0. Ports5680/5681 remain loopback-only.
- Pre-activation checks:0active workflows,0in-flight executions; installed previous package matched the previous tarball byte-for-byte. Frozen package source protected by previous checkpoint and preserved tarball.
- No production access, business/customer DB mutation, billing/provider/API/WS/backend change, nginx/DNS change, PM2 save, npm publish or remote Git action. Paid calls:0.
- Dirty Web main status fingerprint remains `345d26b80d8a3846226dd256552ff64c5a50fd5691749315d77033601543a0c5`; release0.2.0 source remains clean atbe48a6e.

## Verification actually executed

- Final CLI lint/build PASS; final combined182/182 cases PASS,0failed0skipped. The original161 review cases remain;21 model-first cases were added. Earlier180/180 and182/182 reruns are not additional distinct coverage.
- Twelve protected runtime/credential sources byte-identical to761e0ff. Exact verification copy matched selected package source with0mismatches.
- Activated n8n runtime descriptors show8resources (including Model), model/operation voice filters, the original V1, one regular Studio and the companion Trigger, and the model/speech collection before Voice. No standalone Agents action.
- Actual Chromium public sign-in page PASS with0page errors, external requests blocked. Owner session never accessed. Real authenticated model/voice execution is owner UAT pending.
- First browser probe asserted an immediate root-to-signin SPA redirect too early and failed. It was corrected to navigate explicitly to/signin and wait for the password control; no app fix or suppression. The first attempt to generate final activation documentation consequently stopped because browser evidence was absent; after the successful probe it was completed. Failed/stopped lint and test-harness steps are recorded, not counted as PASS.

## Owner UAT now

1. Hard refresh localhost5680. Use Studio runtime node version2 and your existing **staging Suite** credential at `https://n8n-suite-dev.tryvoicely.com`.
2. **Model → Get Many**. Add Catalog Options → Speech Operation=Text to Speech. Return All ON. Execute: public model_id/name/operations rows. Repeat STT/STS filters if useful; no audio generated.
3. **Voice → Get Many**. Add Catalog Options → Speech Operation=Text to Speech, then add Model and select one returned model. Return All OFF, Limit3. Execute: service-compatible stock/owned voices.
4. Switch Model and rerun Voices. Multiple models may legitimately share voices; lists need not differ. For STS use Speech to Speech and a conversion model. STT is not a Voice operation.
5. Inspect **Speech → Text to Speech**: Model and Speech Options is before Voice. Choose/change model then reopen/reselect Voice. No synthesis is required for this discovery pass.
6. Optional inactive example: `examples/studio-v2-model-first-discovery.json`, mapping model ID via `={{ $json.model_id }}`. It lists1model and up to3voices without synthesis. Existing generation workflows need no mandatory discovery nodes and retain their saved model path/defaults/IDs.

Backend catalog remains authoritative. This package does not deploy new engines or make Suite identical to separately deployed Web/Public API catalogs. Backend admission rejects invalid model/voice use; the connector never silently swaps voice or engine. This is not provider certification or resolution of the separate intermittent STT backend timing issue.

## Exact rollback inputs

Current package:

`/home/myeduprojects/n8n-nodes-voicely-review-v021-20261103T140631Z/uat-editor-20261103T143539Z/user/.n8n/nodes/node_modules/@voicelystudio/n8n-nodes-voicely`

Previous package preserved:

`/home/myeduprojects/n8n-nodes-voicely-review-v021-20261103T140631Z/uat-editor-20261103T143539Z/model-first-rollback-previous-package`

To roll back on owner request, first verify editor5680 is idle. Stop only `voicely-n8n-review-v021-dev`; move the current package aside, move the preserved previous directory back to the exact current-package path, restart only that process, then verify readiness and old descriptors. Preserve the SQLite/user folder. Never reset its DB or touch editor5678.

A package rollback does not convert newly saved Model-resource workflows; older package code cannot execute that new resource. Preserve exports and leave affected workflows inactive until compatible package code is restored. Production needs no rollback because it was not accessed or modified.

Full implementation handoff: `MODEL-FIRST-HANDOFF.md`. Evidence: `model-first-evidence/activation.json`, `browser-runtime.json`, descriptors, screenshot, hashes and full verification logs.

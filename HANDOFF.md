# n8n 0.2.1 review correction handoff

Status: **IMPLEMENTED / OFFLINE TESTED / NOT INSTALLED / NOT PUBLISHED / OWNER UAT REQUIRED**.

Date: 2026-11-03 UTC.

## Authority and isolation

Parent is clean release repository `/home/myeduprojects/n8n-nodes-voicely-release-v020`, commit `be48a6e1aa2e1d67bf544fd0c16256d535afbace`. This independent repository uses branch `review/0.2.1`. Original release source remains clean at the same commit. Dirty Web main remains at `8fd416a0241ee0eeb27405827098f3e451de72f1` with identical recorded porcelain fingerprint. Installed editor package remains 0.2.0. No running service, workflow database, credentials, production host or provider was modified/accessed for this package correction.

## Reviewer corrections

| Finding | Implementation | Evidence |
| --- | --- | --- |
| Multiple regular nodes | One registered `voicely` Studio version wrapper plus `voicelyAgentsTrigger`; old standalone regular-node directory removed. Agents behavior extracted into private `nodes/Voicely/v2/automation.ts` and integrated as five resources. | Manifest/compiled payload tests, package audit, original agent operation tests now execute Studio. |
| Page Size | Removed from descriptions; internal pagination size 50, remaining limit respected; Return All continues through cursors. Agent single-list result now respects standard Limit. | Pagination/cursor/limit tests, resource-visibility tests. |
| Optional parameters | Studio and Trigger Options collections; resource-scoped credential and field visibility; old execution getter fallbacks with explicit new Options precedence. | New collection/precedence tests, signed trigger regression suite, complete combined suite. |
| Codex nodeVersion | Studio codex uses `"1.0"` per reviewer instruction. Runtime V1/V2 identity remains unchanged. | Codex and versioned-wrapper tests. |

Programmatic execution is retained because binary speech, dynamic voice/model selection, multipart requests, cursor pagination, idempotency and signed webhook lifecycles require control flow beyond declarative routing.

## Customer and workflow compatibility

- V1 source, transport, WebSocket and original credential are byte-identical to parent. V2 speech transport/WebSocket and all three credential implementations are byte-identical too. See `review-evidence/PRESERVATION.json`.
- Studio Speech/Voice resources use `voicelySuiteApi`; Agent/Call/Delivery/Subscription/Tool use `voicelyAutomationApi`. No host, key, wallet or balance is moved.
- Standalone `voicelyAgents` from unapproved 0.2.0 is deliberately no longer registered; leaving a hidden second regular node would not satisfy review. Export affected workflows **before upgrade** and use `migration/upgrade-v020.mjs` explicitly. It outputs an inactive new copy, retains IDs/names/wiring/credential references, removes workflow identity/pins/trigger registration state and refuses option conflicts. Original inputs are not mutated. Review credentials and trigger registration before activation.
- Old Studio/Trigger optional fields retain an execution-time fallback; explicit Options values (including zero/false/empty identity) win. Before editing/resaving old 0.2.0 workflows, migrate the export, because editor normalization can discard unrepresented fields.
- Tool policy semantics, protected shared-data scopes, HMAC checks, no automatic retry, binary output and billing authority remain intact. This task does not fix the separate intermittent backend `transcript_timing_incomplete` issue.

## Tests actually run

| Run | Outcome |
| --- | --- |
| First CLI TypeScript build | PASS |
| First existing suite | 141 passed / 1 failed / 0 skipped. The failed test searched for Simplify at its removed top-level UI location; its assertion was moved to Options while preserving runtime expectations. |
| First lint | Tool rule crashed on a spread inside Resource options. Replaced with explicit finite resource definitions; no rule suppression. |
| Second lint | 1 collection-order error. Alphabetized Options. |
| Third lint | New migration fixture syntax error. Fixed fixture braces. |
| Fourth lint | PASS, 0 lint errors/warnings. CLI emitted environment color warnings only. |
| Second CLI build | PASS |
| Final combined suite | **161 passed / 0 failed / 0 skipped**, approximately 17.55 seconds. Includes all prior 142 cases and 19 new cases. |
| Local npm pack | PASS, 60 files, 52,226 bytes; no standalone Agents payload. |
| Git diff whitespace check | PASS |

Node runtime used: existing Node 24 from the acceptance toolchain. Complete logs, including failed first runs, are in `review-evidence/`. No live provider inference, real payment, STT/STS request, account login, database mutation or editor browser UAT was performed. UI visibility was tested with n8n's actual `NodeHelpers.displayParameter`; this is descriptor verification, not manual browser certification.

## Local package artifact

`voicelystudio-n8n-nodes-voicely-0.2.1.tgz`

SHA-256: `4b05ec39d96703dddc954cd8861ddfa0e08e2d864c2f69f49139f659ee1bcb4c`.

The local tarball is preparation evidence, not an npm publication. Release publishing must follow the existing owner-approved GitHub Actions/provenance process after explicit approval; no push/tag/npm stage/publication was performed here. N8n review acceptance is not guaranteed by local checks.

## Owner UAT checklist and next gate

1. Review the consolidated Studio resources and resource-specific credential selection in a separately approved isolated editor. Leave the currently installed package intact until this is authorized.
2. Import the inactive credential-free Voice and Agent catalog examples; bind the correct environment's credential explicitly. Discovery needs no paid inference.
3. Check Get Many exposes Return All/Limit, optional fields sit in Options and Call Get does not show unrelated Voice controls.
4. Export a disposable synthetic 0.2.0 Agents workflow; run the offline transformer, review its changes/requirements and import the inactive copy. Check wiring, credentials, tool policy and Trigger Options without activating business workflows.
5. Confirm a saved V1 workflow still resolves node version 1. Do not replace its endpoint or credentials with Suite contracts.
6. After owner approves package UAT and source review, prepare normal provenance publication of **new version 0.2.1**. Publishing/review resubmission is not authorized by this implementation handoff.

No real provider calls are part of these proposed checks. Any speech/agent business execution needs a separately approved test scope.

## Recovery

Running editor and production remain unchanged, so there is no runtime rollback needed. Parent release commit remains available in both repositories. Discard this isolated candidate to abandon the change. Never overwrite the published 0.2.0 tag/version. If a later approved test installation is made, preserve its prior package and exported workflows before switching; importing the inactive migrated copy is separate from restoring the original workflow.

## Sources and reviewer clarification

The owner's pasted review is the exact requirements authority. Official guidance was checked on 2026-11-03: [verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines.md) and [codex metadata](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/codex-files.md). The current general codex page describes nodeVersion in terms of the main node version; this package follows the reviewer's specific **1.0** correction while retaining runtime V1/V2. The correction is not presented as a universal rule inferred from that documentation.

Detailed source before/after hashes: `review-evidence/SOURCE-CHANGES.json`. Reviewer-facing response draft: `REVIEW-RESPONSE.md`.

Local checkpoint note: the first commit attempt found no author identity in the new clone; no commit was created. Repository-local identity was copied from the existing release repository (no global configuration change). Build logs retain all output with trailing blank lines normalized for Git whitespace checks.

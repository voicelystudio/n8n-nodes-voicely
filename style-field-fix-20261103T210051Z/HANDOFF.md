# Custom Style input-field rendering fix

Completed 2026-11-03T21:07:35.472188+00:00.

**STAGING REVIEW EDITOR UPDATED /220NODE TESTS PASS /SUITE UNCHANGED /NO PAID INFERENCE /PRODUCTION UNCHANGED /OWNER PANEL UAT PENDING**.

Owner reported Custom Style Instructions appears in Add Option for supported models, but selecting it produces no input. Confirmed using the actual n8n getNodeParameters lifecycle: the original condition passes dropdown displayParameter checks but is removed during parameter cleanup before rendering. The absolute self-collection reference `/additionalOptions.apiModel.value` is absent from the root simple-parameter display snapshot. A local collection reference `apiModel.value` survives both cleanup and default/render passes.

## Exact fix

Only application descriptor change: `nodes/Voicely/v2/properties.ts`, one condition key:

```diff
- "/additionalOptions.apiModel.value"
+ "apiModel.value"
```

New `test/custom-style-collection-lifecycle.test.cjs` adds4regressions: deliberate old-bug reproduction; empty/typed/expression input retention across six models/list+ID locators/omitted operation defaults; supported-model switching and standard cleanup for HD/STT/STS; expression-selected model retention. These test actual n8n cleanup/default/render, beyond the earlier visibility-only checks. The earlier216cases remain passing.

Standard n8n UI cleanup removes unsupported optional fields when changing to HD/STT/STS. This corrects the previous handoff's assumption that every hidden field necessarily remains saved. Manual/expression-resolved incompatible payloads remain subject to unchanged node/server validation. No engine/voice/language/billing/HTTP/WS behavior was modified.

## Identities and verification

- Source checkpoint `c9d8fc988a44de51ac8c2cebc4e7b4ed1f8f9b5a`; parent `5e40c2371c03b5bce8f35c52e960aa6989baa656` preserved.
- Local package0.2.1 SHA256 `f7f71dca09f2c7120ee11a8718b53443f744773459c609409841db7a3e98bcec`, 66files /64155bytes.
- Official n8n CLI buildPASS and lintPASS.
- **220/220PASS**,0fail/skip:216existing+4new lifecycle cases.
- After activation, tested the actual loaded descriptor with the review editor host's own n8n-workflow library: selected empty style field retainedPASS (`evidence/ACTIVE-LIFECYCLE.json`).
- Actual authenticated browser interaction is owner UAT; no screenshot of an owner session or private credential access was attempted. Signin-shell tests from previous increment are historical, not reclassified as this field's browser proof.
- No Suite/provider/billing regression suite rerun because no backend changed; previous inherited backend style-test mismatch remains a separate historical limitation.

## Staging activation

Only `voicely-n8n-review-v021-dev` restarted, PID387853→390113. Editor **http://localhost:5680** healthy; cached descriptor confirms local `apiModel.value` condition. Previous installed package SHA `521f60ceeeab6010581dcddc057333ff2f3349bdc05548663cdb3469314a7f40` verified before swap. Idle preflight found0active workflows/0in-flight executions via bounded read-only aggregates. No workflows, sessions or credentials edited/read. Suite, old editor5678, Web/API/WS/Mobile/Calling/STT/STS/relay and all other PM2 states unchanged. Main HEAD/status fingerprint unchanged; no main edits or production access. No paid inference, publication, GitHub push or nginx change.

## Owner UAT

1. Hard refresh localhost5680 with Ctrl+Shift+R and reopen Generate Speech.
2. Keep a supported Model selected, then **Model and Speech Options → Custom Style Instructions**.
3. A multiline input should now appear. Enter delivery instructions; close/reopen the node to check retention.
4. Switch between supported models: text retained. HD: control unavailable through normal conditional cleanup. Manual unsupported combinations still reject.

The agent did not generate audio. Audible style behavior/provider limits remain owner UAT as documented in the parent style handoff.

## Recovery

Package rollback: stop only the review editor while idle; preserve current package, restore `/home/myeduprojects/n8n-nodes-voicely-review-v021-20261103T140631Z/uat-editor-20261103T143539Z/style-field-rollback-previous-package` to `/home/myeduprojects/n8n-nodes-voicely-review-v021-20261103T140631Z/uat-editor-20261103T143539Z/user/.n8n/nodes/node_modules/@voicelystudio/n8n-nodes-voicely`, restart that editor and verify readiness. Do not reset/delete the editor SQLite DB or credentials. Previous Suite/runtime remains active throughout. Raw properties-before.ts kept locally; losslessgzip source backup and reversible fix.patch.gz are versioned. Exact before/afterSHA256 is in SOURCE-CHANGES.json. No PM2save or production action.

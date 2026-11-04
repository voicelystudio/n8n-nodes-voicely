# n8n review response — version 0.2.1

Prepared on 2026-11-04. Publication and n8n verification are separate steps; this response is ready for the actual release record.

Thank you for reviewing version 0.2.0. Version 0.2.1 addresses all four findings:

1. **One regular node:** The package registers Voicely Studio and its companion Voicely Agents Trigger. Agent, Call, Delivery, Subscription and Tool operations are resources within Studio version 2. The standalone Agents regular node is removed. Saved Studio version 1 workflows retain their implementation and credentials.
2. **Get Many parameters:** Page Size is removed from the node interface. Get Many exposes Return All and conditional Limit. Pagination is internal, respects the remaining limit and does not truncate Return All at the internal page size.
3. **Options collections:** Operation Identity, Request Timeout, Include Shared Data and Trigger setup-event settings are inside Options. Explicit new settings take precedence, including false and zero. Legacy saved values have documented execution fallbacks; a pure offline migration helper handles the former standalone Agents node.
4. **Codex metadata:** Both codex files use nodeVersion "1.0" as requested. Runtime Studio node versions 1 and 2 are unchanged.

## Validation

The final compliance audit ran 236 offline connector regression cases: 236 passed, 0 failed, 0 skipped. The official n8n-node build and lint passed. The official scanner 0.42.0 local static analyzer passed on both the source and packed JavaScript/package.json. Eighteen independent package checks passed. The audited 67-file tarball was reproducible byte for byte before the final documentation-only release edits.

The package has no external runtime dependencies, runtime environment/filesystem access, credential logging or security-rule suppression. Only n8n-workflow as a peer and built-in crypto are used by the node. Credentials stay in native n8n credentials. Source and release identity are pinned; saved V1, versioned canonical/legacy models, model-language-voice selection, custom-style boundaries, signed triggers, pagination and migration remain covered.

The owner separately accepted end-to-end staging and production UAT against the matching Voicely Suite. This is owner manual acceptance, not complete provider certification. No automatic paid retry is added. Strict STT remains the default; explicitly selected Best Effort may return null invalid word times and visible quality warnings. Missing required speaker information still fails.

The package is published through the test-gated GitHub Actions provenance workflow. Actual release commit, tag, Actions run, final artifact integrity and post-publication full registry/provenance scan are recorded in the release handoff. Local static analysis is not presented as completed registry provenance verification or n8n manual approval.

Existing 0.2.0 standalone Agents workflows require the documented migration; existing V1 workflows do not. New streaming UI/output remains intentionally outside this update, while saved legacy WebSocket behavior remains supported.

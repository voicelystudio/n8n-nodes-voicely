# n8n review response — local 0.2.1 candidate

Prepared on 2026-11-03. Not yet published or resubmitted.

1. **One regular node:** Removed the standalone Voicely Agents node from source and the package registration. Its Agent, Call, Delivery, Subscription and Tool resources are now part of Voicely Studio node version 2. The Voicely Agents Trigger remains a companion trigger. Existing Studio node version 1 behavior and credentials are unchanged.
2. **Get Many parameters:** Removed Page Size. Voice, Agent, Delivery and Tool lists expose Return All and Limit. Paginated endpoints use an internal page size of 50, reduced when the remaining Limit is smaller. Agent discovery applies Limit to its nonpaginated response. Return All is not capped by the internal page size.
3. **Options collections:** Operation Identity, Request Timeout, Include Shared Data and Include Setup Test Events now appear under Options, with appropriate resource/operation visibility. Other optional tool-policy, transport and simplification settings are also grouped. New explicit Options override legacy saved fields; an offline transformer documents the standalone-node migration.
4. **Codex metadata:** `nodes/Voicely/Voicely.node.json` now uses `nodeVersion: "1.0"`, as specifically requested. This does not change runtime node versions 1 and 2.

Validation: n8n-node CLI build and lint pass; all 161 offline regression cases pass (142 prior cases retained/adapted to the approved UI change, 19 additional review/migration cases). The local npm tarball contains two registered node entries, no standalone Agents payload and no external runtime dependencies. No live provider, financial or production request was made.

Publication and n8n verification remain separate approval steps. Existing 0.2.0 Agents workflows require the documented explicit migration before installing 0.2.1. V0.1.1-compatible saved V1 workflows do not require migration.

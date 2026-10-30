# Voicely Studio and Agents for n8n

Create speech, transcribe recordings, convert voices, and connect Voicely Calling Agents to business workflows.

`@voicelystudio/n8n-nodes-voicely` contains three node types in one package:

| Node | What it does |
| --- | --- |
| **Voicely Studio** | Text-to-speech over HTTP or WebSocket, speech-to-text, speech-to-speech, voice catalog and consented voice-profile management. Audio output is binary data for downstream nodes. |
| **Voicely Agents** | Discover agents, retrieve completed calls and permitted shared details, register business tools, and inspect or redeliver automation events. |
| **Voicely Agents Trigger** | Receive authenticated, signed completed-call events for post-call workflows. |

[Voicely integration guide](https://tryvoicely.com/integrations/n8n) · [Account and API access](https://tryvoicely.com/api-access)

## Installation and upgrades

For a self-hosted n8n instance, install `@voicelystudio/n8n-nodes-voicely` from **Settings → Community nodes**, following your administrator's package policy. n8n Cloud availability follows n8n's review and release process. Version 0.1.1 was verified; its status does not automatically certify the expanded 0.2.0 features.

Version 0.2.0 retains the original `voicely` node identity. Saved node version 1 workflows keep their original operations, **Voicely API** credentials and service URLs. Fresh Studio nodes use node version 2. Package version 0.2.0 and Studio node version 2 are different version numbers. Updating the package does not convert workflows, move credentials between hosts or transfer balances.

## Credentials

Sign in to [Voicely API access](https://tryvoicely.com/api-access), create an API key, and enable only the permissions your workflow needs. Configure the service URL explicitly; this destination receives your key.

| Credential | Service URL | Use |
| --- | --- | --- |
| **Voicely Studio API** | `https://n8n-suite.tryvoicely.com` | Studio node version 2 |
| **Voicely Agents API** | `https://n8n-suite.tryvoicely.com` | Agents and Agents Trigger |
| **Voicely API** | `https://n8n.tryvoicely.com` | Existing node version 1 workflows |

Staging accounts and keys belong to their staging service; do not mix environments. Existing speech keys do not automatically gain agent, tool or automation permissions.

Common permissions are `credential/read` for the Studio credential test, `voices/read` and `catalog/read` for discovery, `speech/synthesize`, `speech/transcribe` or `speech/convert` for the matching speech operation, and `voices/write` for owned-profile creation/deletion. Agents discovery uses `agents/read`; completed calls use `calls/read`; subscriptions and delivery management use `automation/read` and `automation/write`; tool management uses `tools/read` and `tools/write`. Additional shared-call details require their matching scopes and recorded sharing permission.

For **Voicely Agents API**, set a strong random **Webhook Signing Secret** privately in the credential. Optional previous secrets support rotation. Keep API keys and webhook secrets out of exported workflow JSON, screenshots and recordings. Tool-webhook signing credentials serve a separate purpose from the API key used to manage tools.

## Speech workflows

Start with the inactive, credential-free [Studio voice catalog example](examples/studio-v2-voice-catalog.json). Import it, select your Studio credential and execute it to list voices without generating audio.

For TTS, select a voice/model, enter text and choose an output binary field. For STT or STS, provide audio in the configured input binary field. Connect generated audio to playback, storage or delivery nodes. Consented voice creation takes the reference audio, consent recording and profile name; reuse the resulting owned profile ID for later operations rather than creating it for every request.

STS presets separate voice identity from conversion settings:

- **Voicely-Expressive:** default tested expressive preset.
- **Voicely-Normal:** tested normal preset.
- **Custom:** select a supported model and style strength from 0 to 1. Blank settings use the service-configured defaults. Expressions can choose supported models/settings per item.

Fixed presets reject incompatible overrides. Catalog availability, pricing, concurrency and deadlines come from the service. CPU conversion can take longer than the audio duration; choose a suitable workflow timeout. The connector does not grant credits. The generous n8n builder campaign is not active as part of this release.

Existing [HTTP speech](examples/http-speech.json), [WebSocket speech](examples/websocket-speech.json) and [AI voice-tool](examples/ai-agent-voices.json) examples continue to target node version 1. Their credentials remain separate from Studio version 2.

## Calling Agent business tools

Use the [Calling order lookup and verification example](examples/calling-order-verification/README.md) for a complete 17-node workflow and synthetic setup data. It uses standard n8n nodes and is invoked by a Voicely Calling Agent; it is not a combined canvas of the three custom Voicely nodes. Importing it does not provision an agent, initiate a call or allocate credits.

Register typed tools through **Voicely Agents → Tool** with input/result schemas and the workflow's public HTTPS webhook. Configure the matching signing credential inside that workflow. Read-only lookups, confirmed writes, verified-caller access and escalation notifications have distinct contracts. The live agent receives the authoritative structured result after the business workflow completes. A webhook HTTP acceptance alone does not prove a CRM or database action completed.

Publish/activate the business workflow for its persistent production webhook URL. Keep the examples inactive until you have selected your own credentials, table and tool configuration. Use synthetic data for initial tests.

## Completed-call Trigger

1. Add **Voicely Agents Trigger**, select your Agents credential and choose an agent.
2. Ensure n8n generates a **public HTTPS callback URL**. A localhost editor tunnel alone is not a reachable callback.
3. For a manual test, select **Listen for test event**, then complete a call for that same agent and environment. The test listener is temporary and can stop after one accepted event.
4. For persistent post-call automation, publish/activate the Trigger workflow and use its production webhook lifecycle.
5. Inspect the output JSON, including `event_type`, `event_id` and the call details inside `data`.

The Trigger manages its subscription automatically. Normal use does not require copying a subscription ID. Self-hosted reverse proxies must forward the generated POST callback paths to n8n, preserving headers and raw request bytes. They must not be limited to an old node UUID. Depending on your n8n version, configure `N8N_WEBHOOK_URL` or `WEBHOOK_URL` as appropriate; verify the actual test and production URLs shown in your editor. Exposing callback paths does not require exposing the editor or REST API.

Events are HMAC signed with timestamp validation. Keep the raw body intact and deduplicate downstream business actions by `event_id`, because retries/redeliveries can contain the same event. Delivery happens independently after call settlement. Use **Voicely Agents → Delivery** to inspect attempts or request a controlled redelivery. A completed call can remain successfully settled even if the receiving workflow is unavailable.

## Retry safety and workflow migration

Speech operations expose an operation identity. Reuse it only for the same intended operation when recovering an uncertain response. Use a new identity for new work. Avoid automatic retries of uncertain writes; inspect the authoritative result first.

The [workflow converter](migration/index.html) runs locally in your browser when served as static files. It reviews supported speech/voice mappings and produces a new inactive workflow; it does not upload your file or request a key. Map actual Voicely voice/model IDs, bind credentials privately, review the report and test before activation. Dynamic mappings require account-side configuration. It does not transfer private voices, balances or third-party permissions, and it is not a universal credential scrubber. Review custom code and linked workflows separately.

Examples are available in this GitHub repository; they are not bundled inside the npm package. The migration utility is bundled.

## Development and license

Run `npm ci --ignore-scripts`, `npm run lint` and `npm test` to build and validate the connector with the n8n node CLI. The package has no external runtime dependencies. Release publishing uses the repository's GitHub Actions workflow with provenance and an owner-reviewed npm publication stage.

This connector is MIT licensed; see [LICENSE.md](LICENSE.md). Hosted Voicely services and separately deployed runtime components retain their own terms and applicable licenses.

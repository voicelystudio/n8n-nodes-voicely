# Voicely Studio and Agents for n8n

Create speech, transcribe recordings, convert voices, and connect Voicely Calling Agents to business workflows.

`@voicelystudio/n8n-nodes-voicely` contains one regular node and one companion trigger:

| Node | What it does |
| --- | --- |
| **Voicely Studio** | Model discovery and Speech/Voice resources handle HTTP/WebSocket TTS, STT, STS and consented voice profiles. Agent, Call, Delivery, Subscription and Tool resources handle discovery, permitted call details, tool registration and automation events. Audio output remains binary data. |
| **Voicely Agents Trigger** | Receive authenticated, signed completed-call events for post-call workflows. |

[Voicely integration guide](https://tryvoicely.com/integrations/n8n) · [Account and API access](https://tryvoicely.com/api-access)

## Installation and upgrades

For a self-hosted n8n instance, install `@voicelystudio/n8n-nodes-voicely` from **Settings → Community nodes**, following your administrator's package policy. n8n Cloud availability follows n8n's review and release process. Version 0.1.1 was verified; its status does not automatically certify the expanded features. Version 0.2.1 is a review-correction candidate until separately published and approved.

Version 0.2.0 retains the original `voicely` node identity. Saved node version 1 workflows keep their original operations, **Voicely API** credentials and service URLs. Fresh Studio nodes use node version 2. Package version 0.2.1 and Studio node version 2 are different version numbers. Updating the package does not convert workflows, move credentials between hosts or transfer balances.

## Credentials

Sign in to [Voicely API access](https://tryvoicely.com/api-access), create an API key, and enable only the permissions your workflow needs. Configure the service URL explicitly; this destination receives your key.

| Credential | Service URL | Use |
| --- | --- | --- |
| **Voicely Studio API** | `https://n8n-suite.tryvoicely.com` | Studio v2 Speech and Voice resources |
| **Voicely Agents API** | `https://n8n-suite.tryvoicely.com` | Studio v2 Agent/Call/Delivery/Subscription/Tool resources and Agents Trigger |
| **Voicely API** | `https://n8n.tryvoicely.com` | Existing node version 1 workflows |

Staging accounts and keys belong to their staging service; do not mix environments. Existing speech keys do not automatically gain agent, tool or automation permissions.

Common permissions are `credential/read` for the Studio credential test, `voices/read` and `catalog/read` for discovery, `speech/synthesize`, `speech/transcribe` or `speech/convert` for the matching speech operation, and `voices/write` for owned-profile creation/deletion. Agents discovery uses `agents/read`; completed calls use `calls/read`; subscriptions and delivery management use `automation/read` and `automation/write`; tool management uses `tools/read` and `tools/write`. Additional shared-call details require their matching scopes and recorded sharing permission.

For **Voicely Agents API**, set a strong random **Webhook Signing Secret** privately in the credential. Optional previous secrets support rotation. Keep API keys and webhook secrets out of exported workflow JSON, screenshots and recordings. Tool-webhook signing credentials serve a separate purpose from the API key used to manage tools.

## Speech workflows

Start with the inactive, credential-free [Studio voice catalog example](examples/studio-v2-voice-catalog.json). Import it, select your Studio credential and execute it to list voices without generating audio.

For current TTS discovery, use **Model → Get Many**. It lists the seven API-consistent TTS models, including model-specific languages and provider-streaming versus buffered-segment delivery mode. STT/STS models are chosen inside their own Speech operations. The service supplies model IDs/names and advertised operations; the connector does not invent model, voice or language mappings. Return All and Limit control the returned model items. These new selections require the matching Suite backend with versioned `/v2` TTS routes.

For model-specific voices, use **Voice → Get Many → Catalog Options**: first add Speech Operation (Text to Speech or Speech to Speech), then Model. The node forwards both filters on every catalog page and uses the service's compatible stock/owned voice results. Leave Catalog Options empty to retain the original unfiltered management catalog; that list is not a promise of universal model compatibility. STT is a model-only workflow and has no voice selector.

For TTS, select the model under **Model and Speech Options** before selecting Voice, then enter text and choose an output binary field. Changing the model refreshes voice discovery; reselect a compatible voice. Explicit voice/model IDs and saved settings are never silently substituted. Backend admission remains authoritative. Existing configured generation workflows need no separate discovery nodes or extra catalog requests. For STT or STS, provide audio in the configured input binary field. Connect generated audio to playback, storage or delivery nodes. Consented voice creation takes the reference audio, consent recording and profile name; reuse the resulting owned profile ID for later operations rather than creating it for every request.

STS presets separate voice identity from conversion settings:

- **Voicely-Expressive:** default tested expressive preset.
- **Voicely-Normal:** tested normal preset.
- **Custom:** select a supported model and style strength from 0 to 1. Blank settings use the service-configured defaults. Expressions can choose supported models/settings per item.

Fixed presets reject incompatible overrides. Catalog availability, pricing, concurrency and deadlines come from the service. CPU conversion can take longer than the audio duration; choose a suitable workflow timeout. The connector does not grant credits. The generous n8n builder campaign is not active as part of this release.

Existing [HTTP speech](examples/http-speech.json), [WebSocket speech](examples/websocket-speech.json) and [AI voice-tool](examples/ai-agent-voices.json) examples continue to target node version 1. Their credentials remain separate from Studio version 2.

### Model contract compatibility

The new optional **Model** field uses `additionalOptions.apiModel` for generation and `catalogOptions.apiModel` for compatible-voice discovery. It explicitly uses the Suite's versioned `/v2` TTS contract, aligned with the seven Public API names/IDs. The new catalog is `/v2/models`; compatible stock voices use `/v2/tts/voices`; HTTP and WebSocket synthesis use `/v2/text-to-speech/{voice}` paths.

Existing `additionalOptions.model` and `catalogOptions.model` are retained as **Legacy Model** and continue using `/v1` Suite routes. The old Suite `voicely-flash-v1` mapping was 3.8 Flash, while the canonical Public API ID maps to Voicely Classic/2.5 Flash. Versioning preserves both without silently changing existing workflows. Leave Model blank to keep the old service default. Never select both Model and Legacy Model; the node refuses the conflict.

New canonical TTS exposes public stock voices, matching the Public API contract. Existing owned/cloned profiles and Native Speech remain on the legacy Suite contract; they are not advertised as compatible with every new model. STT/STS, legacy V1 workflows and their billing contracts remain separate. Model capabilities describe implementation, not certification of every provider/language combination.

Choose **Options → Speech Transport → WebSocket** for supported TTS models. HD uses buffered segments; the other six use provider streaming. Audio chunks are received during execution, but the n8n node emits a complete binary item after success. It does not emit partial successful items or promise live browser playback. No automatic HTTP fallback, provider substitution or retry occurs.

### Optional chained discovery

An inactive [model-first catalog example](examples/studio-v2-model-first-discovery.json) links Model Get Many to Voice Get Many without synthesis. With all models returned, Voice executes once per model input. Model ID is mapped with `={{ $json.model_id }}`; each output retains n8n item linkage. If a later generation node needs the selected model, use `={{ $('Get Models').item.json.model_id }}` and `={{ $json.voice_id }}` for the compatible voice. Review n8n execution behavior before adding synthesis: returning every voice could generate audio once per item. Start with one model and one voice.

Discovery results reflect the credential's actual Service URL and current catalog. The package does not activate deferred backend models or make the Suite catalog equal to a separately deployed Web/Public API catalog. No provider calls occur when listing models/voices.

## Calling Agent business tools

Use the [Calling order lookup and verification example](examples/calling-order-verification/README.md) for a complete 17-node workflow and synthetic setup data. It uses standard n8n nodes and is invoked by a Voicely Calling Agent; it is not a combined canvas of the custom Voicely nodes. Importing it does not provision an agent, initiate a call or allocate credits.

Register typed tools through **Voicely Studio → Tool** with input/result schemas and the workflow's public HTTPS webhook. Configure the matching signing credential inside that workflow. Read-only lookups, confirmed writes, verified-caller access and escalation notifications have distinct contracts. The live agent receives the authoritative structured result after the business workflow completes. A webhook HTTP acceptance alone does not prove a CRM or database action completed.

Publish/activate the business workflow for its persistent production webhook URL. Keep the examples inactive until you have selected your own credentials, table and tool configuration. Use synthetic data for initial tests.

## Completed-call Trigger

1. Add **Voicely Agents Trigger**, select your Agents credential and choose an agent.
2. Ensure n8n generates a **public HTTPS callback URL**. A localhost editor tunnel alone is not a reachable callback.
3. For a manual test, select **Listen for test event**, then complete a call for that same agent and environment. The test listener is temporary and can stop after one accepted event.
4. For persistent post-call automation, publish/activate the Trigger workflow and use its production webhook lifecycle.
5. Inspect the output JSON, including `event_type`, `event_id` and the call details inside `data`.

The Trigger manages its subscription automatically. Normal use does not require copying a subscription ID. Self-hosted reverse proxies must forward the generated POST callback paths to n8n, preserving headers and raw request bytes. They must not be limited to an old node UUID. Depending on your n8n version, configure `N8N_WEBHOOK_URL` or `WEBHOOK_URL` as appropriate; verify the actual test and production URLs shown in your editor. Exposing callback paths does not require exposing the editor or REST API.

Events are HMAC signed with timestamp validation. Keep the raw body intact and deduplicate downstream business actions by `event_id`, because retries/redeliveries can contain the same event. Delivery happens independently after call settlement. Use **Voicely Studio → Delivery** to inspect attempts or request a controlled redelivery. A completed call can remain successfully settled even if the receiving workflow is unavailable.

## Retry safety and workflow migration

Under **Options**, speech operations expose an Operation Identity and Request Timeout. Speech Transport and voice Simplify are also optional settings. Call Get exposes Include Shared Data under Options; Trigger Options contains Request Timeout and Include Setup Test Events. Get Many uses Return All and Limit; page size is chosen internally (50 per paginated request, reduced for the remaining limit). Agent discovery applies the selected limit to its single-list service response.

Speech operations expose an operation identity. Reuse it only for the same intended operation when recovering an uncertain response. Use a new identity for new work. Avoid automatic retries of uncertain writes; inspect the authoritative result first.

The [workflow converter](migration/index.html) runs locally in your browser when served as static files. It reviews supported speech/voice mappings and produces a new inactive workflow; it does not upload your file or request a key. Map actual Voicely voice/model IDs, bind credentials privately, review the report and test before activation. Dynamic mappings require account-side configuration. It does not transfer private voices, balances or third-party permissions, and it is not a universal credential scrubber. Review custom code and linked workflows separately.

Examples are available in this GitHub repository; they are not bundled inside the npm package. The migration utility is bundled.

## Upgrading workflows created with package 0.2.0

Version 0.2.1 consolidates the former **Voicely Agents** regular node into Studio v2 resources, as required by n8n review. Its standalone node type is no longer registered. The companion Trigger keeps its existing identity. Existing V1 workflows are unchanged.

Before replacing 0.2.0, export affected workflows. The pure offline transformer [upgrade-v020.mjs](migration/upgrade-v020.mjs) changes only the known Voicely 0.2.0 node shapes: it maps the old Agents type to Studio v2, retains node IDs/names/connections and credential references, moves optional fields into Options, and removes the Page Size setting. It returns a new **inactive** workflow without the original workflow ID, pinned data or trigger registration state. Review/rebind credentials and register triggers for the new copy before activation. It does not upload files, call services, update the live editor or read credentials.

Call `upgradeV020Workflow(exportedWorkflow)` from a local module importing that file. The result contains `ok`, `workflow`, `changes`, `issues` and `requirements`. Conflicting new/legacy option values produce no migrated workflow. Review and import the returned workflow only when `ok` is true. Keep the original export for recovery; this utility is not a general secret scrubber.

Old Studio/Trigger saved optional values have an execution-time fallback while the new Options field is absent. Explicit Options values take precedence, including zero and false. Migrate exported 0.2.0 workflows before editing/resaving them: editor normalization may drop unrepresented legacy fields. Never upgrade V1 to V2 by merely changing its version number.

A credential-free [Agent catalog example](examples/studio-v2-agent-catalog.json) shows the consolidated resource and requires an explicit Agents credential selection before execution.

## Development and license

Run `npm ci --ignore-scripts`, `npm run lint` and `npm test` to build and validate the connector with the n8n node CLI. The package has no external runtime dependencies. Release publishing uses the repository's GitHub Actions workflow with provenance and an owner-reviewed npm publication stage.

This connector is MIT licensed; see [LICENSE.md](LICENSE.md). Hosted Voicely services and separately deployed runtime components retain their own terms and applicable licenses.

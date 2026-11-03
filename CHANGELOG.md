# Changelog

## 0.2.1 (2026-11-03) — review-correction candidate

- Consolidate the standalone Agents action into Studio v2 Agent, Call, Delivery, Subscription and Tool resources; retain the companion signed-event Trigger.
- Select Studio or Agents credentials by resource without changing service endpoints, billing or V1 contracts.
- Remove Page Size from Get Many; keep Return All/Limit and internal pagination, including agent-list limits.
- Move optional request identity, timeout, shared-call data, tool policy, transport and simplification settings into Options, with saved-value execution fallbacks and an explicit offline 0.2.0 migration helper.
- Move Trigger timeout and setup-event settings into Options.
- Set Studio codex metadata nodeVersion to 1.0 per reviewer; runtime node versions 1 and 2 remain unchanged.
- Add focused structural, pagination, credential, option-precedence and workflow-migration regression coverage. No live-service or provider change.

## 0.2.0 (2026-10-30)

- Add Voicely Studio node version 2 for HTTP/WebSocket text-to-speech, speech-to-text, speech-to-speech and consented voice-profile management.
- Add Voicely Agents for agent discovery, completed-call metadata and permitted shared data, typed business tools, delivery status and controlled redelivery.
- Add Voicely Agents Trigger with public HTTPS subscriptions, HMAC signature/timestamp verification and rotation support for signed completed-call events.
- Add workflow-level STS preset/model selection and Custom style strength while retaining service-configured operational defaults.
- Include the reviewed browser workflow converter and document inactive, credential-free examples, including the Calling order-verification workflow and synthetic data.
- Preserve saved Voicely node version 1 operations, original credentials, HTTP/WebSocket behavior and existing service URLs.
- Document production suite setup, permission scopes, retry safety and test-versus-production webhook behavior. The generous builder trial remains inactive.

## 0.1.1 (2026-10-21)

- Enable native n8n AI Agent tool use, with a voice discovery example workflow.
- Document that the agent consumes voice JSON, not generated audio playback, and uses a separately configured chat model.
- Existing HTTP and WebSocket speech operations, credentials and billing remain unchanged.

## 0.1.0 (2026-10-21)

- Initial speech generation and complete voice catalog operations.
- API credentials, dynamic voice/model selection, binary audio and stable retry keys.
- Independent service URL and configurable concurrency/timeout without coded upper ceilings.
- Native WebSocket speech operation with final-frame validation, workflow cancellation, linked binary
  output, no automatic retry/fallback and no new runtime dependency or accounting layer.
- Indexed validation errors for empty or non-string workflow expressions before any paid submission.
- Importable HTTP and WebSocket workflow examples and test-gated provenance publication workflow.

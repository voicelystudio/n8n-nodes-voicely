# Changelog

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

# Official capability evidence — observed 2026-11-03T20:34:58.766063+00:00

- https://docs.cloud.google.com/text-to-speech/docs/gemini-tts — Gemini2.5Flash,2.5Pro,2.5FlashLitePreview,3.1FlashPreview; natural-language prompts and streaming formats documented.
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/overview — Gemini3.8Flash/FlashLite; speech_metadata.style and generateContent/streamGenerateContent.
- https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd — HD native streaming exists at provider; not a Gemini-style natural-language prompt control in the accepted Voicely contract. No claim that HD is inherently unable to stream.
- https://docs.n8n.io/workflows/streaming/ — streaming needs a compatible trigger and participating nodes; arbitrary chunk items are not automatically a live audio response. Deferred by owner.

Accepted frozen Web source: post-release-seo-corrections-20261103T061222Z/candidate/src/lib/ttsTypes.ts (six supportsStylePrompt flags, HDfalse), gemini38Studio.ts (structured speechMetadata.style), geminiTtsShared.ts (older instruction wrapper). New Suite style behavior reuses those request-shape semantics without Web changes. Source-backed/synthetic evidence is distinct from owner-reported successful streaming UAT and fresh provider acceptance. No paid request authorized/executed by agent in this increment.

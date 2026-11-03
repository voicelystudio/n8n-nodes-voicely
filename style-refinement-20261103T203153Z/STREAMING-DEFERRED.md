# Streaming deferral — owner decision

New n8n streaming/chunk/playback UX is outside this update. Removed Speech Transport selector and streaming promotion from canonical model-picker descriptions/compact output. Existing saved Options/top-level transport fields, v1 examples, binary WS client and server WS modules remain compatible; no silent downgrade or engine substitution. Raw detailed service metadata may still describe existing server transports, but is not a new node streaming-output offer.

Custom style is HTTP complete-audio only. Catalog advertises style_transports=[http] for six models and [] for HD; style_streaming=false. Node rejects new style + saved WS before networking; Suite rejects canonical styled streaming before quote/hold/provider. No new WS fields, listener/player, gRPC client, streaming callback endpoint or downstream chunk items.

Google HD native streaming exists; current Voicely adapter remains buffered. Future streaming work must specify trigger/receiver, audio framing/format, ordered delivery, cancellation/backpressure, failure semantics and n8n verification compliance. Sending arbitrary chunks as workflow items does not automatically implement live playback and can multiply downstream actions.

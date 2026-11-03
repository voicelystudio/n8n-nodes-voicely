# Model → Language → Voice: staging UAT

The standard workflow is **Manual Trigger → Voicely Studio / Speech / Text to Speech**. Discovery nodes are optional; they do not need to precede generation.

## Generate speech without reading API documentation

1. Select the **staging Suite credential** (Service URL `https://n8n-suite-dev.tryvoicely.com`).
2. In **Model and Speech Options**, add **Model**, choose a branded model. Leave **Legacy Model** empty for a new canonical selection.
3. Add **Language**, choose from the searchable model-specific list. `(Preview)` means preview in Voicely; it does not claim the provider model is GA or every option has been live-tested. Blank preserves the existing automatic language behavior.
4. Select **Voice** from its refreshed list. After changing model or language, reselect/check the voice. Unsupported retained combinations fail; the node never silently switches model, language or voice.
5. Enter **Text**. **Output Format** is optional in the same collection. New generation uses HTTP. Add Custom Style Instructions only for a supported model; streaming selection is deferred.
6. Execute only when you intend real synthesis with ordinary entitlements/provider usage. Agent verification performed no paid synthesis.

The seven canonical models share the accepted public stock voice catalog. Voice discovery validates model/language admission; a repeated speaker list is not an error or a guarantee of native accent quality in every language. Owned/cloned voice and STS behavior remains on the existing legacy contract.

## Compact discovery

- **Model → Get Many**: seven TTS models, counts, preview/transport information. **Options → Simplify** defaults ON; turn OFF for full language arrays.
- **Language → Get Many**: select required **Model**, then Return All or Limit. One language per output item, with its model ID and preview flag.
- **Voice → Get Many → Catalog Options**: Speech Operation = Text to Speech, **Model**, optional **Language**. Return All/Limit controls output.

The metadata-only example `examples/studio-v2-model-language-voice-discovery.json` selects one model, one language and one voice without generating audio. Expressions retain the original selected model through item linking. Do not expand all models × languages × voices into a paid generation node unintentionally.

## Legacy compatibility

Saved `additionalOptions.model` remains **Legacy Model** and old `languageCode` remains supported. Blank selections keep the old Suite default. The same historical `voicely-flash-v1` ID maps to a different engine on old Suite v1 versus explicit canonical v2; no workflow is silently migrated. Do not choose both Model/Legacy Model or Language/Language Code. STT/STS remain under their existing Speech operations.

## Transport truth

New workflows use HTTP and receive one completed audio binary. Streaming output/playback is deferred from this update; no new Speech Transport control is shown. Existing saved WS parameters and older v1 workflows remain compatible. HD has provider-side native streaming capability, but the current Voicely adapter remains buffered. No new provider certification is implied.

## Owner UAT

- Hard refresh localhost:5680 after activation. Check Model Get Many is compact and still lists seven models.
- Language Get Many: HD/Classic-family 39 selectable options; Narration 138; Narration Lite 109. These are selectable options, not independent provider language totals. Urdu remains present on all seven.
- Generate Speech: add Model then Language; search Urdu, verify Voice loads. No generation required to test discovery.
- Switch Narration to Lite with a Flash-only selection retained: language/voice discovery must refuse, without substitution. Select a supported language to recover.
- Confirm an existing saved legacy workflow's parameters remain unchanged. Do not run paid generation solely for this UAT.

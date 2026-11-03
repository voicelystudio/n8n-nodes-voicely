# Custom Style Instructions — staging UAT

Use localhost:5680 with the staging Suite credential. In Speech → Text to Speech, choose Model under Model and Speech Options, then add Language and select Voice as usual.

1. Select Voicely Narration. Add **Custom Style Instructions** in the same collection, for example `Warm, calm and confident delivery`. Keep actual narration in **Text**. Output is a completed audio file over HTTP.
2. Verify the field is available for Classic, Classic Pro, Speech Preview, Narration, Narration Lite and Classic Lite (Preview), and absent for HD, STT/STS and Legacy Model selection. Model discovery advertises can_use_style for exactly these six.
3. Change to HD: do not silently keep/apply instructions. Clear a retained nonempty style before generation; runtime validation rejects incompatible manually saved or expression-resolved combinations.
4. Empty instructions preserve the previous request and delivery. Existing Language, Voice and Output Format selection remain unchanged.
5. The new field is not the numeric STS Custom Style Strength or Voice Settings JSON style value. The script alone remains the existing billing-character basis; no new price or entitlement is introduced. Existing combined provider-input limits still apply.
6. Streaming output/playback is deferred. A saved WS transport combined with new style is refused with an HTTP-only explanation; existing WS workflows without new instructions remain compatible. No new transport selector is exposed.

All agent audio/provider/financial tests are synthetic. Real audio style effectiveness and unsupported-model user experience require owner UAT. The agent does not execute paid inference automatically.

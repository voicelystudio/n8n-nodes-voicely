# API-consistent TTS / streaming — staged integration

Owner approved a versioned canonical contract while preserving old Suite3.8 behavior. Existing /v1 routes and saved `additionalOptions.model` remain unchanged; the old key appears as Legacy Model. New `additionalOptions.apiModel` selects API-consistent seven models using /v2 TTS routes. `catalogOptions.apiModel` selects compatible canonical stock voices; legacy model field still addresses old Suite behavior. Both together fail clearly.

ModelGetMany now defaults toTTS-only and /v2/models. STT/STS choices remain under their own Speech operations. Model discovery retains public streaming mode, transports and model-specific language metadata. New Model dropdown descriptions distinguishHD buffered WS from the six provider-streaming models. Node WS receives chunks then outputs one complete audio binary.

Node191? No: actual combined count is190 (old182 plus8newcases),0fail0skip. CLI build/lint passed; source and example conversion are verified in an exact clean copy. Initial build/lint failures were unused helper/direct-error checks, fixed without rule bypass. Backend implementation/evidence/activation is separate at:

`/home/myeduprojects/n8n-suite-model-parity-20261103T155526Z`

Backend26focusedcases pass, including actual n8n nativeWSclient→loopbackSuite for sevenIDs, exact request models/endpoints, metadata, old/new identity conflict protection, and synthetic financial hold/capture boundaries. No paid Google calls were made. One baseline style-wording test remains an existing failure, not hidden.

Canonical TTS supports the existing public stock voices, matching the accepted Public API contract; owned/native/cloned voice workflows remain on legacy routes and are not silently converted. Authentication, billing units, credit rules, original V1 package behavior and production remain unchanged.

This package requires coordinated Suite /v2 backend support before production publication. It must not be published against an unupdated production Suite by implication. Current staging UAT activation evidence follows after validation; npm/GitHub publication not performed.

## Activation complete

Sourcef99c4b7 is active in existing review editor5680, paired with Suite sourcee381901. Exact activation evidence, seven-model table and recovery: `/home/myeduprojects/n8n-suite-model-parity-20261103T155526Z/ACTIVATION.md`. Owner login/credentials/workflows retained; no paid inference or production modification.

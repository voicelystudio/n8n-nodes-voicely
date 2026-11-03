# Voicely Calling Agent: order lookup and verification

Import `calling-order-verification.json` into your own n8n editor. This is the 17-node business-tool workflow invoked by a Voicely Calling Agent. It uses standard n8n nodes. Voicely handles the voice conversation; this workflow authenticates tool requests, reads synthetic orders, conditionally saves verification results and returns the authoritative response.

The download is inactive and contains no account credentials, installed-instance IDs, saved executions or references to Voicely's internal Data Tables. It does not create an agent, start a call, allocate credits or configure your account automatically.

## 1. Create your synthetic Data Table

Create a new Data Table in your n8n project. Use the following exact column names and types. n8n creates its row `id`, `createdAt` and `updatedAt` fields automatically.

| Column | Type | Initial value |
| --- | --- | --- |
| order_id | String | DEMO-1010 or DEMO-2020 |
| order_status | String | pending_verification |
| failed_attempts | Number | 0 |
| locked | Boolean | false |
| verification_history | String | [] |
| verification_last4 | String | 1122 or 1212 |

Use `sample-orders.json` as the typed data reference. Add its two synthetic rows to the new table. Keep `verification_last4` as a string so leading zeroes remain possible. Do not import these rows into a real customer's order system.

## 2. Import and configure the workflow

In n8n, choose Import from File and select `calling-order-verification.json`. Open **Voicely Policy** and replace `SELECT_YOUR_SYNTHETIC_ORDER_TABLE_ID` with your table's ID. All three Data Table nodes read this one field; no internal table IDs are embedded.

The other policy values are editable workflow inputs, not fixed limits in the authentication or business code. The supplied demo configuration uses a five-minute signed-request window, a 262144-byte body bound, JSON depth 32, two incorrect PIN attempts, 100 stored operation receipts, and a two-row lookup bound to detect ambiguous order IDs. Review those values for your own test and keep the lookup bound at least two. The reference and PIN patterns are also editable in this node. There is no requirement to enable environment access in n8n.

## 3. Select your HMAC credential

Open **Verify Voicely HMAC** and create/select your own Crypto credential with the signing secret matching the registered Voicely tool. Keep the secret in the credential, never in the policy node, workflow JSON or a screenshot. Authentication checks the signed raw request, timestamp and operation identity. Leave the Webhook node's raw-body/binary settings and authentication path intact.

Voicely API credentials authenticate your management calls to Voicely. This Crypto signing credential verifies requests coming into your workflow; these are separate credentials.

## 4. Register the business tools

Publish/activate the configured workflow in your own n8n instance and copy its HTTPS **production webhook URL**. The path in this example is `voicely-order-tools`; change it if that path is already used on your instance. A test webhook requires an active editor listener and is not the persistent endpoint for live calls.

Using **Voicely Studio → Tool → Register Version**, connect the same HTTPS URL to your accessible agent for these contracts:

- `lookup_order`: read effect; arguments contain the string `reference`.
- `verify_order`: write effect; arguments contain strings `reference` and `last4`.

Use these input schemas when registering the tools:

```json
{"type":"object","properties":{"reference":{"type":"string"}},"required":["reference"],"additionalProperties":false}
```

```json
{"type":"object","properties":{"reference":{"type":"string"},"last4":{"type":"string"}},"required":["reference","last4"],"additionalProperties":false}
```

The lookup result schema is:

```json
{"type":"object","properties":{"order_id":{"type":"string"},"status":{"type":"string"},"verification_required":{"type":"boolean"},"message":{"type":"string"}},"required":["order_id","status","verification_required","message"],"additionalProperties":false}
```

The verification result schema is:

```json
{"type":"object","properties":{"order_id":{"type":"string"},"status":{"type":"string"},"outcome":{"type":"string"},"attempts_remaining":{"type":"integer"},"message":{"type":"string"}},"required":["order_id","status","outcome","attempts_remaining","message"],"additionalProperties":false}
```

The workflow supplies the surrounding `operation_id` / `state` response envelope. Register these schemas as the business result schema, not as a replacement for that envelope. Configure the matching signing secret, permissions and the Calling Agent's verification/explicit-confirmation behavior. The workflow does not replace the Calling service's confirmation or caller-identity checks. Private business data requires the appropriate caller verification in your own integration.

## 5. Test through your configured Calling Agent

Use your own connected Calling Agent to request `DEMO-1010`, then provide `1122` when asked and the explicit confirmation requested by the agent. A successful verification saves `completed` before the workflow returns success. `DEMO-2020` uses `1212`; use a separate synthetic row when testing incorrect PINs so earlier outcomes are preserved. The sample policy locks verification after two incorrect attempts. An unknown order returns a structured not-found result.

Once configured and active, the workflow runs when the agent invokes its tool; you do not manually execute the whole workflow before each call. Calls and speech use your account's normal funding and permissions. Importing this JSON alone does not perform any paid operation.

## Result and retry behavior

The response includes `operation_id`, `state` and `result`. Conditional writes compare the prior row values; the workflow confirms the saved result and rechecks a concurrent conflict. Reusing the same intended operation identity can return its stored result. A changed payload under the same identity is refused. New work needs a new identity. Do not blindly retry uncertain writes or erase earlier receipt/history rows to make a demo fresh.

Use **Voicely Agents Trigger** separately for signed completed-call events and downstream follow-up such as CRM updates or notifications. This business-tool example is invoked during a conversation; it is not itself the three-custom-node canvas or a phone/SIP provisioning workflow.

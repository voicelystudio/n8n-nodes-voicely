import { createHmac, timingSafeEqual } from "node:crypto";
import { NodeConnectionTypes, NodeOperationError } from "n8n-workflow";
import type {
  IDataObject,
  IHookFunctions,
  IWebhookFunctions,
  ILoadOptionsFunctions,
  INodeType,
  INodeTypeDescription,
  INodeListSearchResult,
  IWebhookResponseData,
} from "n8n-workflow";
import { selectedId } from "../Voicely/v2/transport";
import { automationRequest } from "./transport";
import { hookOption } from "../Voicely/v2/options";
type Registration = {
  id: string;
  agent: string;
  workflow: string;
  destination: string;
  windowMs: number;
  bodyBytes: number;
};
type Context = IHookFunctions | IWebhookFunctions;
const mode = (c: Context) => (c.getMode() === "manual" ? "test" : "production");
function registration(c: Context): Registration | undefined {
  const data = c.getWorkflowStaticData("node").voicelyRegistrations as
    | IDataObject
    | undefined;
  return data?.[mode(c)] as unknown as Registration | undefined;
}
function workflow(c: Context) {
  const id = c.getWorkflow().id;
  if (!id)
    throw new NodeOperationError(
      c.getNode(),
      "Save this workflow before registering Voicely events",
    );
  return String(id) + "/" + c.getNode().id;
}
function save(c: Context, value: Registration | undefined) {
  const data = c.getWorkflowStaticData("node"),
    entries = (data.voicelyRegistrations ?? {}) as IDataObject;
  if (value) entries[mode(c)] = value as unknown as IDataObject;
  else delete entries[mode(c)];
  data.voicelyRegistrations = entries;
}
function bound(n: unknown) {
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0;
}
export class VoicelyAgentsTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Voicely Agents Trigger",
    name: "voicelyAgentsTrigger",
    icon: { light: "file:voicely.svg", dark: "file:voicely.svg" },
    group: ["trigger"],
    version: 1,
    subtitle: "Call events",
    description: "Receive signed Voicely call and setup events",
    defaults: { name: "Voicely Agents Trigger" },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [{ name: "voicelyAutomationApi", required: true }],
    webhooks: [
      {
        name: "default",
        httpMethod: "POST",
        responseMode: "onReceived",
        path: "events",
        rawBody: true,
      },
    ],
    properties: [
      {
        displayName: "Agent",
        name: "agent",
        type: "resourceLocator",
        default: { mode: "list", value: "" },
        required: true,
        modes: [
          {
            displayName: "From List",
            name: "list",
            type: "list",
            typeOptions: { searchListMethod: "agents" },
          },
          { displayName: "By ID", name: "id", type: "string" },
        ],
      },

      {
        displayName: "Options",
        name: "options",
        type: "collection",
        default: {},
        placeholder: "Add Option",
        options: [
          {
            displayName: "Include Setup Test Events",
            name: "includeSynthetic",
            type: "boolean",
            default: true,
            description:
              "Whether to emit clearly marked synthetic setup events. Templates must keep these separate from business writes.",
          },
          {
            displayName: "Request Timeout (Ms)",
            name: "requestTimeoutMs",
            type: "number",
            default: 0,
            description:
              "Timeout for registration requests. Zero adds no client deadline; the service still applies its configured limits.",
          },
        ],
      },
    ],
  };
  methods = {
    listSearch: {
      async agents(
        this: ILoadOptionsFunctions,
        filter?: string,
      ): Promise<INodeListSearchResult> {
        const result = await automationRequest(this, "/v1/agents"),
          agents = result?.agents;
        if (!Array.isArray(agents))
          throw new NodeOperationError(
            this.getNode(),
            "Voicely agent list is unavailable",
          );
        return {
          results: agents
            .filter(
              (a) =>
                a &&
                typeof a === "object" &&
                typeof (a as IDataObject).agent_id === "string",
            )
            .map((a) => ({
              name: String((a as IDataObject).agent_id),
              value: String((a as IDataObject).agent_id),
            }))
            .filter(
              (a) =>
                !filter || a.name.toLowerCase().includes(filter.toLowerCase()),
            ),
        };
      },
    },
  };
  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const old = registration(this);
        if (!old) return false;
        const remote = await automationRequest(
          this,
          "/v1/automation/subscriptions/" + encodeURIComponent(old.id),
          {},
          true,
        );
        if (
          !remote ||
          remote.state !== "active" ||
          remote.workflow_id !== workflow(this) ||
          remote.mode !== mode(this) ||
          remote.agent_id !== selectedId(this.getNodeParameter("agent")) ||
          remote.destination !== this.getNodeWebhookUrl("default")
        )
          return false;
        if (
          !bound(remote.signature_window_ms) ||
          !bound(remote.event_body_bytes)
        )
          throw new NodeOperationError(
            this.getNode(),
            "Voicely webhook policy is unavailable",
          );
        save(this, {
          ...old,
          windowMs: Number(remote.signature_window_ms),
          bodyBytes: Number(remote.event_body_bytes),
        });
        return true;
      },
      async create(this: IHookFunctions): Promise<boolean> {
        const destination = this.getNodeWebhookUrl("default");
        if (
          typeof destination !== "string" ||
          !destination.startsWith("https://")
        )
          throw new NodeOperationError(
            this.getNode(),
            "Configure a public HTTPS webhook URL for this n8n instance",
          );
        const credentials = await this.getCredentials("voicelyAutomationApi");
        if (
          typeof credentials.webhookSecret !== "string" ||
          !credentials.webhookSecret
        )
          throw new NodeOperationError(
            this.getNode(),
            "Set the Webhook Signing Secret in the Voicely Agents credential",
          );
        const agent = selectedId(this.getNodeParameter("agent")),
          consumer = workflow(this),
          remote = await automationRequest(
            this,
            "/v1/automation/subscriptions",
            {
              method: "POST",
              body: {
                agent_id: agent,
                workflow_id: consumer,
                mode: mode(this),
                destination,
                webhook_secret: credentials.webhookSecret,
              },
            },
          );
        if (
          typeof remote?.subscription_id !== "string" ||
          !bound(remote.signature_window_ms) ||
          !bound(remote.event_body_bytes)
        )
          throw new NodeOperationError(
            this.getNode(),
            "Voicely registration response is incomplete",
          );
        save(this, {
          id: remote.subscription_id,
          agent,
          workflow: consumer,
          destination,
          windowMs: Number(remote.signature_window_ms),
          bodyBytes: Number(remote.event_body_bytes),
        });
        return true;
      },
      async delete(this: IHookFunctions): Promise<boolean> {
        const old = registration(this);
        if (!old) return true;
        const remote = await automationRequest(
          this,
          "/v1/automation/subscriptions/" + encodeURIComponent(old.id),
          {},
          true,
        );
        if (
          remote &&
          remote.workflow_id === workflow(this) &&
          remote.mode === mode(this)
        )
          await automationRequest(
            this,
            "/v1/automation/subscriptions/" + encodeURIComponent(old.id),
            { method: "DELETE" },
            true,
          );
        save(this, undefined);
        return true;
      },
    },
  };
  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const refuse = (status: number, code: string) => {
      this.getResponseObject().status(status).json({ code });
      return { noWebhookResponse: true };
    };
    try {
      const stored = registration(this),
        raw = this.getRequestObject().rawBody,
        headers = this.getHeaderData();
      if (!stored || !bound(stored.windowMs) || !bound(stored.bodyBytes))
        return refuse(503, "voicely_webhook_not_registered");
      if (!Buffer.isBuffer(raw) || raw.length > stored.bodyBytes)
        return refuse(401, "voicely_webhook_unauthorized");
      const stamp = headers["x-voicely-timestamp"],
        id = headers["x-voicely-event-id"],
        signature = headers["x-voicely-signature"];
      if (
        typeof stamp !== "string" ||
        !/^\d+$/.test(stamp) ||
        !Number.isSafeInteger(Number(stamp)) ||
        Math.abs(Date.now() - Number(stamp)) > stored.windowMs ||
        typeof id !== "string" ||
        !id ||
        typeof signature !== "string" ||
        !/^v1=[a-f0-9]{64}$/.test(signature)
      )
        return refuse(401, "voicely_webhook_unauthorized");
      const credentials = await this.getCredentials("voicelyAutomationApi");
      if (
        typeof credentials.webhookSecret !== "string" ||
        !credentials.webhookSecret
      )
        return refuse(401, "voicely_webhook_unauthorized");
      const previous = credentials.previousWebhookSecrets
        ? JSON.parse(String(credentials.previousWebhookSecrets))
        : [];
      if (
        !Array.isArray(previous) ||
        previous.some((v) => typeof v !== "string" || !v)
      )
        return refuse(401, "voicely_webhook_unauthorized");
      const actual = Buffer.from(signature.slice(3), "hex");
      let valid = false;
      for (const key of [credentials.webhookSecret, ...previous]) {
        const expected = createHmac("sha256", key)
          .update(JSON.stringify([1, Number(stamp), id]) + "\n")
          .update(raw)
          .digest();
        valid = timingSafeEqual(actual, expected) || valid;
      }
      if (!valid) return refuse(401, "voicely_webhook_unauthorized");
      const body = JSON.parse(raw.toString("utf8")) as IDataObject,
        data = body?.data as IDataObject | undefined;
      if (
        !body ||
        body.event_id !== id ||
        body.schema_version !== 1 ||
        typeof body.event_type !== "string" ||
        !["call.completed", "automation.test"].includes(body.event_type) ||
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        data.agent_id !== selectedId(this.getNodeParameter("agent"))
      )
        return refuse(400, "voicely_event_invalid");
      if (
        (body.event_type === "automation.test" && body.synthetic !== true) ||
        (body.event_type === "call.completed" && body.synthetic === true)
      )
        return refuse(400, "voicely_event_invalid");
      if (
        body.synthetic === true &&
        !hookOption(this, "includeSynthetic", true)
      ) {
        this.getResponseObject()
          .status(200)
          .json({ accepted: true, ignored: true });
        return { noWebhookResponse: true };
      }
      // At-least-once events retain event_id. Do not mark an event consumed before
      // n8n durably starts its workflow; downstream writes need atomic idempotency.
      return {
        workflowData: [[{ json: body }]],
        webhookResponse: { accepted: true, event_id: id },
      };
    } catch {
      return refuse(401, "voicely_webhook_unauthorized");
    }
  }
}

import { createHash } from "node:crypto";
import { NodeConnectionTypes, NodeOperationError } from "n8n-workflow";
import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import { automationRequest } from "../VoicelyAgentsTrigger/transport";
import { selectedId } from "../Voicely/v2/transport";
const object = (value: unknown): IDataObject => {
  const v = typeof value === "string" ? JSON.parse(value) : value;
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw Error("invalid_object");
  return v as IDataObject;
};
const text = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) throw Error("required_value");
  return value;
};
export class VoicelyAgents implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Voicely Agents",
    name: "voicelyAgents",
    icon: { light: "file:voicely.svg", dark: "file:voicely.svg" },
    group: ["transform"],
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    version: 1,
    description:
      "Configure agent workflows and inspect call automation with Voicely",
    defaults: { name: "Voicely Agents" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: "voicelyAutomationApi", required: true }],
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        default: "agent",
        options: [
          { name: "Agent", value: "agent" },
          { name: "Call", value: "call" },
          { name: "Delivery", value: "delivery" },
          { name: "Subscription", value: "subscription" },
          { name: "Tool", value: "tool" },
        ],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "getAll",
        displayOptions: { show: { resource: ["agent"] } },
        options: [{ name: "Get Many", value: "getAll", action: "Get agents" }],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "get",
        displayOptions: { show: { resource: ["call"] } },
        options: [
          { name: "Get", value: "get", action: "Get a finalized call" },
          {
            name: "Revoke Data Sharing",
            value: "revokeExports",
            action: "Revoke call data sharing",
          },
        ],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "getAll",
        displayOptions: { show: { resource: ["delivery"] } },
        options: [
          { name: "Get Many", value: "getAll", action: "Get deliveries" },
          {
            name: "Redeliver",
            value: "redeliver",
            action: "Redeliver the same event",
          },
        ],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "getAll",
        displayOptions: { show: { resource: ["tool"] } },
        options: [
          { name: "Get Many", value: "getAll", action: "Get tools" },
          {
            name: "Register Version",
            value: "register",
            action: "Register a tool version",
          },
          { name: "Disable", value: "disable", action: "Disable a tool" },
        ],
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        default: "test",
        displayOptions: { show: { resource: ["subscription"] } },
        options: [
          {
            name: "Send Setup Event",
            value: "test",
            action: "Send a synthetic setup event",
          },
        ],
      },
      {
        displayName: "Agent ID",
        name: "agentId",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: { resource: ["tool"], operation: ["getAll", "register"] },
        },
      },
      {
        displayName: "Call ID",
        name: "callId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["call"] } },
      },
      {
        displayName: "Include Shared Data",
        name: "includeData",
        type: "multiOptions",
        default: [],
        displayOptions: { show: { resource: ["call"], operation: ["get"] } },
        options: [
          { name: "Callback Details", value: "lead" },
          { name: "Transcript", value: "transcript" },
          { name: "Conversation Context", value: "context" },
        ],
        description:
          "Requires explicit caller sharing permission and the matching key scopes. Expired or withdrawn details are unavailable.",
      },
      {
        displayName: "Delivery ID",
        name: "deliveryId",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: { resource: ["delivery"], operation: ["redeliver"] },
        },
      },
      {
        displayName: "Tool ID",
        name: "toolId",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: { resource: ["tool"], operation: ["disable"] },
        },
      },
      {
        displayName: "Subscription ID",
        name: "subscriptionId",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["subscription"] } },
      },
      {
        displayName: "Return All",
        name: "returnAll",
        type: "boolean",
        description:
          "Whether to return all results or only up to a given limit",
        default: false,
        displayOptions: {
          show: { resource: ["delivery", "tool"], operation: ["getAll"] },
        },
      },
      {
        displayName: "Limit",
        name: "limit",
        type: "number",
        typeOptions: {
          minValue: 1,
        },
        default: 50,
        displayOptions: {
          show: {
            resource: ["delivery", "tool"],
            operation: ["getAll"],
            returnAll: [false],
          },
        },
        description: "Max number of results to return",
      },
      {
        displayName: "Page Size",
        name: "pageSize",
        type: "number",
        default: 50,
        displayOptions: {
          show: { resource: ["delivery", "tool"], operation: ["getAll"] },
        },
        description:
          "Records per request, subject to the service configured page policy",
      },
      {
        displayName: "Tool Name",
        name: "toolName",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: { resource: ["tool"], operation: ["register"] },
        },
        description:
          "A stable function name, using letters, digits and underscores",
      },
      {
        displayName: "Description",
        name: "description",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: { resource: ["tool"], operation: ["register"] },
        },
        description: "Explain when the agent should use this tool",
      },
      {
        displayName: "Purpose",
        name: "purpose",
        type: "options",
        default: "business",
        displayOptions: {
          show: { resource: ["tool"], operation: ["register"] },
        },
        options: [
          { name: "Business Action", value: "business" },
          { name: "Verify Caller", value: "verify_caller" },
        ],
        description:
          "A verification tool must be read-only and must not itself require a verified caller. It returns verified and subject after your business system checks identity.",
      },
      {
        displayName: "Effect",
        name: "effect",
        type: "options",
        default: "read",
        displayOptions: {
          show: { resource: ["tool"], operation: ["register"] },
        },
        options: [
          { name: "Read", value: "read" },
          { name: "Write", value: "write" },
          { name: "Escalate or Notify", value: "escalate" },
        ],
        description:
          "Writes and escalation require caller confirmation before dispatch",
      },
      {
        displayName: "Require Verified Caller",
        name: "verifiedCaller",
        type: "boolean",
        default: true,
        displayOptions: {
          show: { resource: ["tool"], operation: ["register"] },
        },
        description:
          "Whether to require verified caller identity before accessing sensitive information",
      },
      {
        displayName: "Workflow Webhook URL",
        name: "destination",
        type: "string",
        default: "",
        required: true,
        displayOptions: {
          show: { resource: ["tool"], operation: ["register"] },
        },
        description:
          "Production HTTPS URL of your business workflow. Return a typed completed result after business work finishes.",
      },
      {
        displayName: "Input Schema",
        name: "inputSchema",
        type: "json",
        default:
          '{"type":"object","properties":{},"required":[],"additionalProperties":false}',
        required: true,
        displayOptions: {
          show: { resource: ["tool"], operation: ["register"] },
        },
      },
      {
        displayName: "Result Schema",
        name: "outputSchema",
        type: "json",
        default:
          '{"type":"object","properties":{},"required":[],"additionalProperties":false}',
        required: true,
        displayOptions: {
          show: { resource: ["tool"], operation: ["register"] },
        },
      },
      {
        displayName: "Request Timeout (Ms)",
        name: "requestTimeoutMs",
        type: "number",
        default: 0,
        description:
          "Zero adds no node-side deadline. Service-side policies still apply.",
      },
    ],
  };
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const out: INodeExecutionData[] = [];
    for (let index = 0; index < this.getInputData().length; index++) {
      try {
        const resource = String(this.getNodeParameter("resource", index)),
          operation = String(this.getNodeParameter("operation", index)),
          timeout = Number(this.getNodeParameter("requestTimeoutMs", index, 0));
        if (!Number.isSafeInteger(timeout) || timeout < 0) throw Error();
        const get = (name: string) => text(this.getNodeParameter(name, index)),
          send = (
            path: string,
            options: Parameters<typeof automationRequest>[2] = {},
          ) => automationRequest(this, path, { ...options, timeout });
        const emit = (data: unknown) =>
          out.push({ json: object(data), pairedItem: { item: index } });
        if (resource === "agent" && operation === "getAll") {
          const result = await send("/v1/agents");
          if (!Array.isArray(result?.agents)) throw Error();
          for (const agent of result.agents) emit(agent);
          continue;
        }
        if (resource === "call" && operation === "get") {
          const include = this.getNodeParameter(
            "includeData",
            index,
            [],
          ) as unknown;
          if (
            !Array.isArray(include) ||
            new Set(include).size !== include.length ||
            include.some((s) => !["lead", "transcript", "context"].includes(s))
          )
            throw Error();
          const query = include.length
            ? "?" + new URLSearchParams({ include: include.join(",") })
            : "";
          emit(
            await send(
              "/v1/calls/" + encodeURIComponent(get("callId")) + query,
            ),
          );
          continue;
        }
        if (resource === "call" && operation === "revokeExports") {
          emit(
            await send(
              "/v1/calls/" +
                encodeURIComponent(get("callId")) +
                "/exports/revoke",
              { method: "POST", body: {} },
            ),
          );
          continue;
        }
        if (resource === "tool" && operation === "register") {
          const credentials = await this.getCredentials("voicelyAutomationApi");
          const purpose = String(
              this.getNodeParameter("purpose", index, "business"),
            ),
            secret = text(credentials.webhookSecret),
            effect = get("effect"),
            verified = this.getNodeParameter("verifiedCaller", index);
          if (
            !["read", "write", "escalate"].includes(effect) ||
            typeof verified !== "boolean" ||
            !["business", "verify_caller"].includes(purpose) ||
            (purpose === "verify_caller" && (effect !== "read" || verified))
          )
            throw Error();
          emit(
            await send("/v1/automation/tools", {
              method: "POST",
              body: {
                agent_id: selectedId(this.getNodeParameter("agentId", index)),
                name: get("toolName"),
                description: get("description"),
                effect,
                purpose,
                requires_verified_caller: verified,
                input_schema: object(
                  this.getNodeParameter("inputSchema", index),
                ),
                output_schema: object(
                  this.getNodeParameter("outputSchema", index),
                ),
                destination: get("destination"),
                webhook_secret: secret,
              },
            }),
          );
          continue;
        }
        if (resource === "tool" && operation === "disable") {
          emit(
            await send(
              "/v1/automation/tools/" + encodeURIComponent(get("toolId")),
              { method: "DELETE" },
            ),
          );
          continue;
        }
        if (resource === "delivery" && operation === "redeliver") {
          emit(
            await send(
              "/v1/automation/deliveries/" +
                encodeURIComponent(get("deliveryId")) +
                "/redeliver",
              { method: "POST", body: {} },
            ),
          );
          continue;
        }
        if (resource === "subscription" && operation === "test") {
          const identity =
            "vly_setup_" +
            createHash("sha256")
              .update(
                JSON.stringify([
                  this.getWorkflow().id,
                  this.getExecutionId(),
                  this.getNode().id,
                  index,
                ]),
              )
              .digest("hex");
          emit(
            await send(
              "/v1/automation/subscriptions/" +
                encodeURIComponent(get("subscriptionId")) +
                "/test",
              {
                method: "POST",
                headers: { "idempotency-key": identity },
                body: {},
              },
            ),
          );
          continue;
        }
        if (["delivery", "tool"].includes(resource) && operation === "getAll") {
          const all = Boolean(this.getNodeParameter("returnAll", index, false)),
            limit = all
              ? undefined
              : Number(this.getNodeParameter("limit", index)),
            size = Number(this.getNodeParameter("pageSize", index));
          if (
            !Number.isSafeInteger(size) ||
            size < 1 ||
            (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))
          )
            throw Error();
          let after: string | undefined,
            remaining = limit;
          const seen = new Set<string>();
          do {
            const query = new URLSearchParams({
              limit: String(
                remaining === undefined ? size : Math.min(size, remaining),
              ),
            });
            if (after) query.set("after", after);
            if (resource === "tool")
              query.set(
                "agent_id",
                selectedId(this.getNodeParameter("agentId", index)),
              );
            const page = await send(
                "/v1/automation/" +
                  (resource === "tool" ? "tools" : "deliveries") +
                  "?" +
                  query,
              ),
              records = page?.[resource === "tool" ? "tools" : "deliveries"];
            if (!Array.isArray(records)) throw Error();
            for (const row of records) {
              emit(row);
              if (remaining !== undefined && --remaining === 0) break;
            }
            if (remaining === 0) break;
            const next = page?.next_cursor;
            if (next !== null && next !== undefined && typeof next !== "string")
              throw Error();
            after = next ? String(next) : undefined;
            if (after) {
              if (seen.has(after)) throw Error();
              seen.add(after);
            }
          } while (after);
          continue;
        }
        throw Error();
      } catch {
        if (this.continueOnFail())
          out.push({
            json: {
              error:
                "Voicely agent operation could not complete. No automatic retry was made.",
            },
            pairedItem: { item: index },
          });
        else
          throw new NodeOperationError(
            this.getNode(),
            "Voicely agent operation could not complete",
            {
              itemIndex: index,
              description:
                "Check this key’s scopes, agent ownership and operation settings. HTTP acceptance alone is not business completion.",
            },
          );
      }
    }
    return [out];
  }
}

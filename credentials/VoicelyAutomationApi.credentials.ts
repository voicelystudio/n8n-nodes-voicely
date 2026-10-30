import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
  Icon,
} from "n8n-workflow";
export class VoicelyAutomationApi implements ICredentialType {
  icon: Icon = {
    light: "file:../nodes/Voicely/voicely.svg",
    dark: "file:../nodes/Voicely/voicely.svg",
  };
  name = "voicelyAutomationApi";
  displayName = "Voicely Agents API";
  documentationUrl = "https://tryvoicely.com/integrations/n8n";
  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
    },
    {
      displayName: "Service URL",
      name: "serviceUrl",
      type: "string",
      default: "",
      required: true,
      description:
        "Your independent Voicely integration service origin. This destination receives the API key.",
    },
    {
      displayName: "Webhook Signing Secret",
      name: "webhookSecret",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description:
        "A strong random secret kept in this credential and shared with Voicely when registering this workflow.",
    },
    {
      displayName: "Previous Signing Secrets",
      name: "previousWebhookSecrets",
      type: "string",
      typeOptions: { password: true },
      default: "",
      description:
        "Optional JSON array of former secrets while pending deliveries finish during rotation. Keep secrets in credentials, not workflow parameters.",
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: { headers: { "xi-api-key": "={{$credentials.apiKey}}" } },
  };
  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.serviceUrl}}",
      url: "/v1/agents",
      method: "GET",
      disableFollowRedirect: true,
    },
  };
}

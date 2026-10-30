import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
  Icon,
} from "n8n-workflow";
export class VoicelySuiteApi implements ICredentialType {
  icon: Icon = {
    light: "file:../nodes/Voicely/voicely.svg",
    dark: "file:../nodes/Voicely/voicely.svg",
  };
  name = "voicelySuiteApi";
  displayName = "Voicely Studio API";
  documentationUrl = "https://tryvoicely.com/developers/api";
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
        "The independent Voicely Studio service origin. This destination receives your API key.",
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: { headers: { "xi-api-key": "={{$credentials.apiKey}}" } },
  };
  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.serviceUrl}}",
      url: "/v1/user",
      method: "GET",
      disableFollowRedirect: true,
    },
  };
}

import type { INodeProperties } from "n8n-workflow";
const speech = { resource: ["speech"] },
  voice = { resource: ["voice"] };
const formatIds = [
  "mp3_22050_32",
  ...[32, 64, 96, 128, 192].map((b) => "mp3_44100_" + b),
  ...[8000, 16000, 22050, 24000, 44100, 48000].map((r) => "pcm_" + r),
  "ulaw_8000",
  "alaw_8000",
  ...[32, 64, 96, 128, 192].map((b) => "opus_48000_" + b),
];
export const properties: INodeProperties[] = [
  {
    displayName: "Resource",
    name: "resource",
    type: "options",
    noDataExpression: true,
    default: "speech",
    options: [
      { name: "Speech", value: "speech" },
      { name: "Voice", value: "voice" },
    ],
  },
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    default: "textToSpeech",
    displayOptions: { show: speech },
    options: [
      {
        name: "Text to Speech",
        value: "textToSpeech",
        action: "Generate speech",
      },
      {
        name: "Speech to Text",
        value: "speechToText",
        action: "Transcribe audio",
      },
      {
        name: "Speech to Speech",
        value: "speechToSpeech",
        action: "Convert speech",
      },
    ],
  },
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    default: "getAll",
    displayOptions: { show: voice },
    options: [
      { name: "Get", value: "get", action: "Get voice" },
      { name: "Get Many", value: "getAll", action: "Get many voices" },
      {
        name: "Create Clone",
        value: "createClone",
        action: "Create owned voice",
      },
      { name: "Delete", value: "delete", action: "Delete owned voice" },
    ],
  },
  {
    displayName: "Voice",
    name: "voice",
    type: "resourceLocator",
    typeOptions: {
      loadOptionsDependsOn: ["operation", "additionalOptions.model"],
    },
    default: { mode: "list", value: "" },
    required: true,
    displayOptions: {
      show: { operation: ["textToSpeech", "speechToSpeech", "get", "delete"] },
    },
    modes: [
      {
        displayName: "From List",
        name: "list",
        type: "list",
        typeOptions: { searchListMethod: "getVoices", searchable: true },
      },
      { displayName: "ID", name: "id", type: "string" },
    ],
  },
  {
    displayName: "Speech Transport",
    name: "speechTransport",
    type: "options",
    default: "http",
    options: [
      { name: "HTTP", value: "http" },
      { name: "WebSocket", value: "websocket" },
    ],
    description:
      "Use the same independent Service URL. WebSocket needs a supported server-side n8n host and has no replay or automatic HTTP fallback.",
    displayOptions: {
      show: { resource: ["speech"], operation: ["textToSpeech"] },
    },
  },
  {
    displayName: "Text",
    name: "text",
    type: "string",
    typeOptions: { rows: 4 },
    default: "",
    required: true,
    displayOptions: { show: { operation: ["textToSpeech"] } },
  },
  {
    displayName: "Input Binary Field",
    name: "file",
    type: "string",
    default: "data",
    required: true,
    displayOptions: { show: { operation: ["speechToText", "speechToSpeech"] } },
  },
  {
    displayName: "Reference Binary Fields",
    name: "audioFiles",
    type: "string",
    default: "data",
    required: true,
    description:
      "Comma-separated binary field names containing recordings you have permission to use",
    displayOptions: { show: { operation: ["createClone"] } },
  },
  {
    displayName: "Consent Binary Field",
    name: "consentFile",
    type: "string",
    default: "",
    required: true,
    description:
      "The separate genuine consent recording required for voice creation",
    displayOptions: { show: { operation: ["createClone"] } },
  },
  {
    displayName: "Name",
    name: "name",
    type: "string",
    default: "",
    required: true,
    displayOptions: { show: { operation: ["createClone"] } },
  },
  {
    displayName: "Additional Fields",
    name: "additionalFields",
    type: "collection",
    default: {},
    placeholder: "Add Field",
    displayOptions: { show: { operation: ["createClone"] } },
    options: [
      {
        displayName: "Description",
        name: "description",
        type: "string",
        default: "",
      },
      { displayName: "Labels", name: "labels", type: "json", default: "{}" },
    ],
  },
  {
    displayName: "Return All",
    name: "returnAll",
    type: "boolean",
    description: "Whether to return all results or only up to a given limit",
    default: false,
    displayOptions: { show: { operation: ["getAll"] } },
  },
  {
    displayName: "Limit",
    name: "limit",
    type: "number",
    typeOptions: {
      minValue: 1,
    },
    default: 50,
    displayOptions: { show: { operation: ["getAll"], returnAll: [false] } },
    description: "Max number of results to return",
  },
  {
    displayName: "Simplify",
    name: "simplify",
    type: "boolean",
    default: true,
    displayOptions: { show: { operation: ["get", "getAll"] } },
  },
  {
    displayName: "Output Binary Field",
    name: "outputBinaryField",
    type: "string",
    default: "audio",
    required: true,
    displayOptions: { show: { operation: ["textToSpeech", "speechToSpeech"] } },
  },
  {
    displayName: "Additional Options",
    name: "additionalOptions",
    type: "collection",
    default: {},
    placeholder: "Add Option",
    displayOptions: { show: speech },
    options: [
      {
        displayName: "Custom Style Strength",
        name: "styleStrength",
        type: "string",
        default: "",
        description:
          "Custom model only: enter a number from 0 to 1 or use an expression. Leave empty for the service default. Fixed presets refuse this override.",
        displayOptions: { show: { "/operation": ["speechToSpeech"] } },
      },
      {
        displayName: "Diarize",
        name: "diarize",
        type: "boolean",
        default: true,
        displayOptions: { show: { "/operation": ["speechToText"] } },
      },
      {
        displayName: "Language Code",
        name: "languageCode",
        type: "string",
        default: "",
      },
      {
        displayName: "Model",
        name: "model",
        description:
          "Leave empty for the service default. Speech-to-Speech presets and Custom choices come from the service.",
        type: "resourceLocator",
        typeOptions: { loadOptionsDependsOn: ["operation"] },
        default: { mode: "list", value: "" },
        modes: [
          {
            displayName: "From List",
            name: "list",
            type: "list",
            typeOptions: { searchListMethod: "getModels", searchable: true },
          },
          { displayName: "ID", name: "id", type: "string" },
        ],
      },
      {
        displayName: "Number of Speakers",
        name: "numberOfSpeakers",
        type: "number",
        default: 2,
        displayOptions: { show: { "/operation": ["speechToText"] } },
        description:
          "Expected count, provided explicitly only when this option is selected",
      },
      {
        displayName: "Output Format",
        name: "outputFormat",
        type: "options",
        default: "mp3_44100_128",
        options: formatIds.map((value) => ({
          name: value.replaceAll("_", " "),
          value,
        })),
        displayOptions: { hide: { "/operation": ["speechToText"] } },
      },
      {
        displayName: "Voice Settings",
        name: "voiceSettings",
        type: "json",
        default: "{}",
        description:
          "Voicely voice controls: stability, similarity_boost, style, use_speaker_boost and speed",
        displayOptions: { hide: { "/operation": ["speechToText"] } },
      },
    ],
  },
  {
    displayName: "Operation Identity",
    name: "operationIdentity",
    type: "string",
    default: "",
    description:
      "Use a stable business identity to safely check retries across workflow runs. Blank uses this execution, node and input item.",
  },
  {
    displayName: "Request Timeout (Ms)",
    name: "requestTimeoutMs",
    type: "number",
    default: 0,
    description:
      "Zero leaves the request without a client timeout. Server policy still applies.",
  },
  {
    displayName: "Page Size",
    name: "pageSize",
    type: "number",
    default: 50,
    description: "User-selected catalog page size, without a coded maximum",
    displayOptions: { show: { operation: ["getAll"] } },
  },
];

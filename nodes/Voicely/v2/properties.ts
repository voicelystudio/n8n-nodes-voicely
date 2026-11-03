import type { INodeProperties } from "n8n-workflow";
import { automationProperties } from "./automation";
import { STYLE_MODEL_IDS } from "./discovery";
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
      { name: "Agent", value: "agent" },
      { name: "Call", value: "call" },
      { name: "Delivery", value: "delivery" },
      { name: "Language", value: "language" },
      { name: "Model", value: "model" },
      { name: "Speech", value: "speech" },
      { name: "Subscription", value: "subscription" },
      { name: "Tool", value: "tool" },
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
    displayName: "Model and Speech Options",
    name: "additionalOptions",
    type: "collection",
    default: {},
    placeholder: "Choose Model or Add Option",
    displayOptions: { show: speech },
    options: [
      {
        displayName: "Custom Style Instructions",
        name: "styleInstructions",
        type: "string",
        typeOptions: { rows: 3 },
        default: "",
        placeholder: "e.g. Speak warmly with a calm, confident delivery",
        description:
          "Delivery instructions, not spoken text. Available for supported TTS models over HTTP; leave blank for normal delivery. Combined input limits apply.",
        displayOptions: {
          show: {
            "/operation": ["textToSpeech"],
            "/additionalOptions.apiModel.value": [
              ...STYLE_MODEL_IDS,
              { _cnd: { startsWith: "=" } },
            ],
          },
          hide: {
            "/options.speechTransport": ["websocket"],
            "/speechTransport": ["websocket"],
          },
        },
      },
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
        displayName: "Language",
        name: "language",
        type: "resourceLocator",
        default: { mode: "list", value: "" },
        displayOptions: { show: { "/operation": ["textToSpeech"] } },
        description:
          "Choose Model first, then a supported language. Preview marks Voicely testing status. Blank keeps existing automatic language behavior.",
        typeOptions: {
          loadOptionsDependsOn: [
            "additionalOptions.apiModel",
            "additionalOptions.model",
            "operation",
          ],
        },
        modes: [
          {
            displayName: "From List",
            name: "list",
            type: "list",
            typeOptions: { searchListMethod: "getLanguages", searchable: true },
          },
          { displayName: "ID", name: "id", type: "string" },
        ],
      },
      {
        displayName: "Language Code",
        name: "languageCode",
        type: "string",
        default: "",
        description:
          "Existing language code for saved workflows, transcription and conversion. For a new TTS Model, use Language to browse supported choices; do not select both.",
      },
      {
        displayName: "Legacy Model",
        name: "model",
        description:
          "Choose a model before selecting a voice. After changing the model, reselect a compatible voice. Blank keeps the service default; presets and Custom choices come from the service.",
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
        displayName: "Model",
        name: "apiModel",
        type: "resourceLocator",
        default: { mode: "list", value: "" },
        displayOptions: { show: { "/operation": ["textToSpeech"] } },
        description:
          "API-consistent TTS models. Clear Legacy Model before selecting this. Blank preserves the existing Suite default.",
        typeOptions: { loadOptionsDependsOn: ["operation"] },
        modes: [
          {
            displayName: "From List",
            name: "list",
            type: "list",
            typeOptions: { searchListMethod: "getApiModels", searchable: true },
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
          "Controls vary by operation and model. Canonical TTS accepts speed here; use Custom Style Instructions for supported delivery prompts. STS and legacy controls retain their existing validation.",
        displayOptions: { hide: { "/operation": ["speechToText"] } },
      },
    ],
  },
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    default: "getAll",
    displayOptions: { show: { resource: ["model"] } },
    options: [{ name: "Get Many", value: "getAll", action: "Get many models" }],
  },
  {
    displayName: "Operation",
    name: "operation",
    type: "options",
    noDataExpression: true,
    default: "getAll",
    displayOptions: { show: { resource: ["language"] } },
    options: [
      { name: "Get Many", value: "getAll", action: "Get many languages" },
    ],
  },
  {
    displayName: "Model",
    name: "languageModel",
    type: "resourceLocator",
    required: true,
    default: { mode: "list", value: "" },
    displayOptions: { show: { resource: ["language"], operation: ["getAll"] } },
    description: "The TTS model whose selectable languages to retrieve",
    modes: [
      {
        displayName: "From List",
        name: "list",
        type: "list",
        typeOptions: { searchListMethod: "getApiModels", searchable: true },
      },
      { displayName: "ID", name: "id", type: "string" },
    ],
  },
  {
    displayName: "Catalog Options",
    name: "catalogOptions",
    type: "collection",
    default: {},
    placeholder: "Add Filter",
    displayOptions: {
      show: { resource: ["voice"], operation: ["getAll"] },
    },
    options: [
      {
        displayName: "Language",
        name: "language",
        type: "resourceLocator",
        default: { mode: "list", value: "" },
        displayOptions: {
          show: { "/catalogOptions.speechOperation": ["textToSpeech"] },
        },
        description:
          "Choose Model first. The service validates this model/language combination; voices may be shared across languages.",
        typeOptions: {
          loadOptionsDependsOn: [
            "catalogOptions.speechOperation",
            "catalogOptions.apiModel",
            "catalogOptions.model",
          ],
        },
        modes: [
          {
            displayName: "From List",
            name: "list",
            type: "list",
            typeOptions: { searchListMethod: "getLanguages", searchable: true },
          },
          { displayName: "ID", name: "id", type: "string" },
        ],
      },
      {
        displayName: "Legacy Model",
        name: "model",
        type: "resourceLocator",
        default: { mode: "list", value: "" },
        description:
          "Choose a speech operation first, then a compatible model. Leave empty to use the service default for that operation.",
        displayOptions: {
          show: {
            "/resource": ["voice"],
            "/catalogOptions.speechOperation": [
              "textToSpeech",
              "speechToSpeech",
            ],
          },
        },
        typeOptions: {
          loadOptionsDependsOn: ["catalogOptions.speechOperation", "resource"],
        },
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
        displayName: "Model",
        name: "apiModel",
        type: "resourceLocator",
        default: { mode: "list", value: "" },
        displayOptions: {
          show: {
            "/resource": ["voice"],
            "/catalogOptions.speechOperation": ["textToSpeech"],
          },
        },
        description:
          "Choose API-consistent TTS model; do not also select Legacy Model",
        typeOptions: {
          loadOptionsDependsOn: ["catalogOptions.speechOperation", "resource"],
        },
        modes: [
          {
            displayName: "From List",
            name: "list",
            type: "list",
            typeOptions: { searchListMethod: "getApiModels", searchable: true },
          },
          { displayName: "ID", name: "id", type: "string" },
        ],
      },
      {
        displayName: "Speech Operation",
        name: "speechOperation",
        type: "options",
        default: "all",
        displayOptions: { show: { "/resource": ["model"] } },
        options: [
          { name: "All (Unfiltered Catalog)", value: "all" },
          { name: "Text to Speech", value: "textToSpeech" },
          { name: "Speech to Speech", value: "speechToSpeech" },
          { name: "Speech to Text", value: "speechToText" },
        ],
        description:
          "Filter by intended use. Speech to Text has no voice selection. An unfiltered voice list does not imply compatibility with every model.",
      },
      {
        displayName: "Speech Operation",
        name: "speechOperation",
        type: "options",
        default: "all",
        displayOptions: { show: { "/resource": ["voice"] } },
        options: [
          { name: "All (Unfiltered Catalog)", value: "all" },
          { name: "Text to Speech", value: "textToSpeech" },
          { name: "Speech to Speech", value: "speechToSpeech" },
        ],
        description:
          "Filter by intended use. Speech to Text has no voice selection. An unfiltered voice list does not imply compatibility with every model.",
      },
    ],
  },
  {
    displayName: "Voice",
    name: "voice",
    type: "resourceLocator",
    typeOptions: {
      loadOptionsDependsOn: [
        "resource",
        "operation",
        "additionalOptions.model",
        "additionalOptions.apiModel",
        "additionalOptions.language",
        "additionalOptions.languageCode",
        "catalogOptions.language",
        "catalogOptions.speechOperation",
        "catalogOptions.model",
        "catalogOptions.apiModel",
      ],
    },
    default: { mode: "list", value: "" },
    required: true,
    displayOptions: {
      show: {
        resource: ["speech", "voice"],
        operation: ["textToSpeech", "speechToSpeech", "get", "delete"],
      },
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
    displayOptions: {
      show: { resource: ["language", "model", "voice"], operation: ["getAll"] },
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
        resource: ["language", "model", "voice"],
        operation: ["getAll"],
        returnAll: [false],
      },
    },
    description: "Max number of results to return",
  },

  {
    displayName: "Output Binary Field",
    name: "outputBinaryField",
    type: "string",
    default: "audio",
    required: true,
    displayOptions: { show: { operation: ["textToSpeech", "speechToSpeech"] } },
  },

  ...automationProperties,
  {
    displayName: "Options",
    name: "options",
    type: "collection",
    default: {},
    placeholder: "Add Option",
    options: [
      {
        displayName: "Effect",
        name: "effect",
        type: "options",
        default: "read",
        displayOptions: {
          show: { "/resource": ["tool"], "/operation": ["register"] },
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
        displayName: "Include Shared Data",
        name: "includeData",
        type: "multiOptions",
        default: [],
        displayOptions: {
          show: { "/resource": ["call"], "/operation": ["get"] },
        },
        options: [
          { name: "Callback Details", value: "lead" },
          { name: "Transcript", value: "transcript" },
          { name: "Conversation Context", value: "context" },
        ],
        description:
          "Requires explicit caller sharing permission and the matching key scopes. Expired or withdrawn details are unavailable.",
      },
      {
        displayName: "Operation Identity",
        name: "operationIdentity",
        type: "string",
        default: "",
        displayOptions: { show: { "/resource": ["speech", "voice"] } },
        description:
          "Use a stable business identity to safely check retries across workflow runs. Blank uses this execution, node and input item.",
      },
      {
        displayName: "Purpose",
        name: "purpose",
        type: "options",
        default: "business",
        displayOptions: {
          show: { "/resource": ["tool"], "/operation": ["register"] },
        },
        options: [
          { name: "Business Action", value: "business" },
          { name: "Verify Caller", value: "verify_caller" },
        ],
        description:
          "A verification tool must be read-only and must not itself require a verified caller. It returns verified and subject after your business system checks identity.",
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
        displayName: "Require Verified Caller",
        name: "verifiedCaller",
        type: "boolean",
        default: true,
        displayOptions: {
          show: { "/resource": ["tool"], "/operation": ["register"] },
        },
        description:
          "Whether to require verified caller identity before accessing sensitive information",
      },
      {
        displayName: "Simplify",
        name: "simplify",
        type: "boolean",
        default: true,
        description:
          "Whether to return a simplified version of the response instead of the raw data",
        displayOptions: {
          show: {
            "/resource": ["model", "voice"],
            "/operation": ["get", "getAll"],
          },
        },
      },
    ],
  },
];

import type { IDataObject } from "n8n-workflow";
import { asObject, selectedId } from "./transport";
const scopes: Record<string, string> = {
  textToSpeech: "speech.synthesize",
  speechToText: "speech.transcribe",
  speechToSpeech: "speech.convert",
};
export class CatalogSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogSelectionError";
  }
}
export function catalogOptions(value: unknown): IDataObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CatalogSelectionError("Set valid Catalog Options.");
  return value as IDataObject;
}
export function selectedModel(value: unknown): string | undefined {
  if (
    value === undefined ||
    value === "" ||
    (value &&
      typeof value === "object" &&
      (value as { value?: unknown }).value === "")
  )
    return undefined;
  return selectedId(value);
}
export function operationScope(operation: unknown): string | undefined {
  if (operation === undefined || operation === "all") return undefined;
  if (typeof operation !== "string" || !scopes[operation])
    throw new CatalogSelectionError(
      "Choose a supported speech operation in Catalog Options.",
    );
  return scopes[operation];
}
export function voiceFilters(value: unknown): URLSearchParams {
  const options = catalogOptions(value),
    operation = operationScope(options.speechOperation),
    model = selectedModel(options.model);
  if (operation === "speech.transcribe")
    throw new CatalogSelectionError(
      "Speech to Text has no voice selection. Choose Text to Speech or Speech to Speech.",
    );
  if (model && !operation)
    throw new CatalogSelectionError(
      "Choose Speech Operation in Catalog Options before filtering voices by Model.",
    );
  const query = new URLSearchParams();
  if (operation) query.set("operation", operation);
  if (model) query.set("model_id", model);
  return query;
}
export function modelRows(raw: unknown, operation?: string): IDataObject[] {
  const list = Array.isArray(raw) ? raw : asObject(raw).models;
  if (!Array.isArray(list)) throw Error("model_catalog_invalid");
  const seen = new Set<string>();
  return list
    .map(asObject)
    .map((row) => {
      if (
        typeof row.model_id !== "string" ||
        !row.model_id.trim() ||
        typeof row.name !== "string" ||
        !row.name.trim() ||
        seen.has(row.model_id) ||
        (row.operations !== undefined &&
          (!Array.isArray(row.operations) ||
            row.operations.some((op) => typeof op !== "string")))
      )
        throw Error("model_catalog_invalid");
      seen.add(row.model_id);
      return {
        model_id: row.model_id,
        name: row.name,
        ...(row.operations === undefined ? {} : { operations: row.operations }),
        ...(row.model_contract === "api-v1"
          ? { model_contract: "api-v1" }
          : {}),
        ...(["provider_streaming", "buffered_segments"].includes(
          String(row.streaming_mode),
        )
          ? { streaming_mode: row.streaming_mode }
          : {}),
        ...(row.streaming === "available" ? { streaming: "available" } : {}),
        ...(typeof row.preview === "boolean" ? { preview: row.preview } : {}),
        ...(typeof row.can_use_style === "boolean"
          ? { can_use_style: row.can_use_style }
          : {}),
        ...(Array.isArray(row.transports) &&
        row.transports.every((t) => ["http", "websocket"].includes(String(t)))
          ? { transports: row.transports }
          : {}),
        ...(Array.isArray(row.languages) ? { languages: row.languages } : {}),
        ...(Array.isArray(row.language_options)
          ? { language_options: row.language_options }
          : {}),
      };
    })
    .filter(
      (row) =>
        !operation ||
        (Array.isArray(row.operations) && row.operations.includes(operation)),
    );
}

export function speechModel(options: IDataObject): {
  id?: string;
  contract?: "api-v1";
} {
  const api = selectedModel(options.apiModel),
    legacy = selectedModel(options.model);
  if (api && legacy)
    throw new CatalogSelectionError(
      "Select Model or Legacy Model, not both. Clear the old selection before changing contracts.",
    );
  return api ? { id: api, contract: "api-v1" } : { id: legacy };
}
export function catalogVoiceSelection(value: unknown): {
  query: URLSearchParams;
  route: string;
} {
  const options = catalogOptions(value),
    chosen = speechModel(options);
  const query = voiceFilters({ ...options, model: chosen.id });
  if (chosen.contract) {
    if (operationScope(options.speechOperation) !== "speech.synthesize")
      throw new CatalogSelectionError(
        "API Model is for Text to Speech. Use Legacy Model for Speech to Speech.",
      );
    const language = selectedModel(options.language);
    if (language) query.set("language_code", language);
    return { query, route: "/v2/tts/voices" };
  }
  if (selectedModel(options.language))
    throw new CatalogSelectionError(
      "Choose Model before selecting Language. Legacy voice discovery is unchanged.",
    );
  return { query, route: "/v1/voices" };
}

export function selectionIssue(message: string): never {
  throw new CatalogSelectionError(message);
}

// Read only the public, model-specific selection registry. Never invent locale codes.
export function languageRows(
  raw: unknown,
  expectedModel?: string,
): IDataObject[] {
  const page = asObject(raw),
    rows = page.languages;
  if (
    typeof page.model_id !== "string" ||
    (expectedModel !== undefined && page.model_id !== expectedModel) ||
    !Array.isArray(rows)
  )
    throw new CatalogSelectionError(
      "The service returned an invalid language catalog.",
    );
  const seen = new Set<string>();
  return rows.map(asObject).map((row) => {
    if (
      typeof row.language_id !== "string" ||
      !row.language_id ||
      typeof row.name !== "string" ||
      !row.name ||
      seen.has(row.language_id) ||
      typeof row.preview_in_voicely !== "boolean"
    )
      throw new CatalogSelectionError(
        "The service returned an invalid language catalog.",
      );
    seen.add(row.language_id);
    return {
      model_id: page.model_id,
      language_id: row.language_id,
      name: row.name,
      preview_in_voicely: row.preview_in_voicely,
    };
  });
}
export function compactModel(row: IDataObject): IDataObject {
  const choices = row.language_options,
    rest = { ...row };
  delete rest.languages;
  delete rest.language_options;
  delete rest.streaming;
  delete rest.streaming_mode;
  delete rest.transports;
  return {
    ...rest,
    ...(Array.isArray(choices)
      ? {
          language_option_count: choices.length,
          preview_language_option_count: choices.filter(
            (r) => asObject(r).preview_in_voicely === true,
          ).length,
        }
      : {}),
  };
}
export function speechLanguage(options: IDataObject): string | undefined {
  const choice = selectedModel(options.language),
    legacy = options.languageCode;
  if (legacy !== undefined && typeof legacy !== "string")
    throw new CatalogSelectionError("Set a valid language code.");
  if (choice && legacy)
    throw new CatalogSelectionError(
      "Select Language or Language Code, not both. Clear the old language code first.",
    );
  if (choice && !speechModel(options).contract)
    throw new CatalogSelectionError(
      "Choose Model before selecting Language. Existing workflows can keep Language Code.",
    );
  return choice ?? (legacy || undefined);
}
export function languageCatalogModel(value: unknown): string {
  const model = selectedModel(value);
  if (!model)
    throw new CatalogSelectionError("Choose Model before loading languages.");
  return model;
}

// Stable public identities only; provider routing remains server-owned.
export const STYLE_MODEL_IDS = [
  "voicely-flash-v1",
  "voicely-tts-classic-pro-v1",
  "voicely-tts-preview-v1",
  "voicely-tts-narration-v1",
  "voicely-tts-narration-lite-v1",
  "voicely-tts-classic-lite-v1",
] as const;
export function customStyle(
  options: IDataObject,
  operation: string,
  transport: string,
): string | undefined {
  const raw = options.styleInstructions;
  if (raw === undefined) return undefined;
  if (typeof raw !== "string")
    throw new CatalogSelectionError("Custom Style Instructions must be text.");
  const style = raw.trim();
  if (!style) return undefined;
  const selected = speechModel(options),
    id = selected.id === "eleven_v3" ? "voicely-flash-v1" : selected.id;
  if (operation !== "textToSpeech" || !selected.contract)
    throw new CatalogSelectionError(
      "Select a supported Model for Text to Speech before adding Custom Style Instructions. Legacy workflows are unchanged.",
    );
  if (!STYLE_MODEL_IDS.some((value) => value === id))
    throw new CatalogSelectionError(
      "Custom Style Instructions are unavailable for this model. Voicely HD does not support this control.",
    );
  if (transport !== "http")
    throw new CatalogSelectionError(
      "Custom Style Instructions use HTTP in this update. Use a new HTTP Generate Speech node; saved WebSocket workflows remain unchanged.",
    );
  return style;
}

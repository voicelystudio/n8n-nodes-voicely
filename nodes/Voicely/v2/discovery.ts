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
      };
    })
    .filter(
      (row) =>
        !operation ||
        (Array.isArray(row.operations) && row.operations.includes(operation)),
    );
}

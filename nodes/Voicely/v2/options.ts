import type {
  IDataObject,
  IExecuteFunctions,
  IHookFunctions,
  IWebhookFunctions,
  ILoadOptionsFunctions,
} from "n8n-workflow";
function collection(value: unknown): IDataObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("options_invalid");
  return value as IDataObject;
}
export function executionOption(
  context: IExecuteFunctions,
  index: number,
  name: string,
  fallback: unknown,
): unknown {
  const values = collection(context.getNodeParameter("options", index, {}));
  return Object.hasOwn(values, name)
    ? values[name]
    : context.getNodeParameter(name, index, fallback);
}
export function hookOption(
  context: IHookFunctions | IWebhookFunctions | ILoadOptionsFunctions,
  name: string,
  fallback: unknown,
): unknown {
  const values = collection(context.getNodeParameter("options", {}));
  return Object.hasOwn(values, name)
    ? values[name]
    : context.getNodeParameter(name, fallback);
}

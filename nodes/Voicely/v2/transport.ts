import { randomUUID } from "node:crypto";
import { NodeOperationError } from "n8n-workflow";
import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  IHttpRequestOptions,
} from "n8n-workflow";
type Context = IExecuteFunctions | ILoadOptionsFunctions;
type Reply = {
  body: unknown;
  statusCode: number;
  headers: Record<string, string>;
};
export function serviceOrigin(value: unknown): string {
  const url = new URL(String(value));
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error("service_url_invalid");
  return url.origin;
}
export function selectedId(value: unknown): string {
  const selected =
    value && typeof value === "object"
      ? (value as { value?: unknown }).value
      : value;
  if (typeof selected !== "string" || !selected.trim())
    throw Error("selection_required");
  return selected;
}
export function positiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw Error("positive_integer_required");
  return value;
}
export async function request(
  context: Context,
  route: string,
  options: Partial<IHttpRequestOptions> = {},
): Promise<Reply> {
  const signal =
    "getExecutionCancelSignal" in context
      ? context.getExecutionCancelSignal()
      : undefined;
  if (signal?.aborted)
    throw new NodeOperationError(
      context.getNode(),
      "Voicely operation was cancelled",
    );
  const credentials = await context.getCredentials("voicelySuiteApi");
  let origin: string;
  try {
    origin = serviceOrigin(credentials.serviceUrl);
  } catch {
    throw new NodeOperationError(
      context.getNode(),
      "Set a valid Voicely Service URL",
    );
  }
  try {
    const response = (await context.helpers.httpRequestWithAuthentication.call(
      context,
      "voicelySuiteApi",
      {
        ...options,
        url: origin + route,
        method: options.method ?? "GET",
        returnFullResponse: true,
        disableFollowRedirect: true,
        abortSignal: signal,
        timeout: options.timeout ?? 0,
      },
    )) as Reply;
    if (response.statusCode < 200 || response.statusCode >= 300)
      throw Error("request_failed");
    if (options.encoding !== "arraybuffer" && typeof response.body === "string")
      response.body = JSON.parse(response.body);
    return response;
  } catch {
    // Helper errors may contain Authorization, multipart data or URLs. Never expose them.
    throw new NodeOperationError(
      context.getNode(),
      "Voicely request could not complete",
      {
        description:
          "No automatic retry was made. Reuse the same operation identity to check an uncertain request.",
      },
    );
  }
}
export type BinaryPart = {
  name: string;
  bytes: Buffer;
  filename: string;
  mimeType: string;
};
export function multipart(
  fields: Record<string, string>,
  files: BinaryPart[],
): { body: Buffer; contentType: string } {
  let boundary: string;
  do {
    boundary = "voicely-" + randomUUID();
  } while (
    files.some((file) => file.bytes.includes(boundary)) ||
    Object.values(fields).some((value) => value.includes(boundary))
  );
  const chunks: Buffer[] = [];
  const quoted = (value: string) => value.replace(/[\r\n\\"]/g, "_");
  for (const [name, value] of Object.entries(fields))
    chunks.push(
      Buffer.from(
        "--" +
          boundary +
          '\r\nContent-Disposition: form-data; name="' +
          quoted(name) +
          '"\r\n\r\n' +
          value +
          "\r\n",
      ),
    );
  for (const file of files) {
    chunks.push(
      Buffer.from(
        "--" +
          boundary +
          '\r\nContent-Disposition: form-data; name="' +
          quoted(file.name) +
          '"; filename="' +
          quoted(file.filename) +
          '"\r\nContent-Type: ' +
          quoted(file.mimeType) +
          "\r\n\r\n",
      ),
      file.bytes,
      Buffer.from("\r\n"),
    );
  }
  chunks.push(Buffer.from("--" + boundary + "--\r\n"));
  return {
    body: Buffer.concat(chunks),
    contentType: "multipart/form-data; boundary=" + boundary,
  };
}
export function audioMetadata(format: string): {
  fileName: string;
  mimeType: string;
} {
  if (/^mp3_(?:22050_32|44100_(?:32|64|96|128|192))$/.test(format))
    return { fileName: "speech.mp3", mimeType: "audio/mpeg" };
  if (/^opus_48000_(?:32|64|96|128|192)$/.test(format))
    return { fileName: "speech.ogg", mimeType: "audio/ogg" };
  if (/^pcm_(?:8000|16000|22050|24000|44100|48000)$/.test(format))
    return { fileName: "speech.pcm", mimeType: "audio/pcm" };
  if (format === "ulaw_8000")
    return { fileName: "speech.ulaw", mimeType: "audio/basic" };
  if (format === "alaw_8000")
    return { fileName: "speech.alaw", mimeType: "audio/alaw" };
  throw Error("output_format_invalid");
}
export function asObject(value: unknown): IDataObject {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Buffer.isBuffer(value)
  )
    throw Error("response_shape_invalid");
  return value as IDataObject;
}

import { NodeOperationError } from "n8n-workflow";
import type {
  IHookFunctions,
  ILoadOptionsFunctions,
  IExecuteFunctions,
  IHttpRequestOptions,
  IDataObject,
} from "n8n-workflow";
import { serviceOrigin } from "../Voicely/v2/transport";
type Context = IHookFunctions | ILoadOptionsFunctions | IExecuteFunctions;
export async function automationRequest(
  context: Context,
  path: string,
  options: Partial<IHttpRequestOptions> = {},
  allow404 = false,
): Promise<IDataObject | null> {
  const credentials = await context.getCredentials("voicelyAutomationApi");
  let origin: string;
  const timeout =
    options.timeout ?? context.getNodeParameter("requestTimeoutMs", 0);
  if (
    typeof timeout !== "number" ||
    !Number.isSafeInteger(timeout) ||
    timeout < 0
  )
    throw new NodeOperationError(
      context.getNode(),
      "Set a valid request timeout",
    );
  try {
    origin = serviceOrigin(credentials.serviceUrl);
    if (!origin.startsWith("https:")) throw Error();
  } catch {
    throw new NodeOperationError(
      context.getNode(),
      "Set a valid HTTPS Voicely Service URL",
    );
  }
  try {
    const reply = (await context.helpers.httpRequestWithAuthentication.call(
      context,
      "voicelyAutomationApi",
      {
        ...options,
        url: origin + path,
        method: options.method ?? "GET",
        returnFullResponse: true,
        disableFollowRedirect: true,
        timeout,
      },
    )) as { statusCode: number; body: unknown };
    if (allow404 && reply.statusCode === 404) return null;
    if (reply.statusCode < 200 || reply.statusCode >= 300) throw Error();
    const body =
      typeof reply.body === "string" ? JSON.parse(reply.body) : reply.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error();
    return body as IDataObject;
  } catch (error) {
    const status =
      (error as { statusCode?: number; response?: { statusCode?: number } })
        ?.statusCode ??
      (error as { response?: { statusCode?: number } })?.response?.statusCode;
    if (allow404 && status === 404) return null;
    throw new NodeOperationError(
      context.getNode(),
      "Voicely automation request could not complete",
      {
        description:
          "Check the service URL and the agent/automation permissions on this API key. No automatic retry was made.",
      },
    );
  }
}

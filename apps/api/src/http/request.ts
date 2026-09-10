export class RequestBodyError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export type JsonObject = Record<string, unknown>;

export function isPlainObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function readJsonObject(request: Request, maxBytes: number): Promise<JsonObject> {
  const contentLength = request.headers.get("content-length");

  if (contentLength) {
    const declaredLength = Number(contentLength);

    if (!Number.isFinite(declaredLength) || declaredLength < 0) {
      throw new RequestBodyError(400, "Invalid content length.");
    }

    if (declaredLength > maxBytes) {
      throw new RequestBodyError(413, "Request body is too large.");
    }
  }

  if (!request.body) {
    throw new RequestBodyError(400, "Request body is required.");
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytesRead = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    bytesRead += value.byteLength;

    if (bytesRead > maxBytes) {
      throw new RequestBodyError(413, "Request body is too large.");
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RequestBodyError(400, "Request body must be valid JSON.");
  }

  if (!isPlainObject(parsed)) {
    throw new RequestBodyError(400, "Request body must be a JSON object.");
  }

  return parsed;
}

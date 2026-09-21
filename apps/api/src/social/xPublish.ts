import {
  ApiPartialResponseError,
  ApiRequestError,
  ApiResponseError
} from "twitter-api-v2";

import { createXClient } from "./x";

export async function publishTextToX(text: string) {
  const client = createXClient();
  const result = await client.v2.tweet(text);

  return {
    id: result.data.id,
    text: result.data.text
  };
}

export function isDefiniteXRejection(error: unknown) {
  return error instanceof ApiResponseError && error.code >= 400 && error.code < 500;
}

export function sanitizeXPublishError(error: unknown) {
  if (error instanceof ApiResponseError) {
    const title = typeof error.data?.title === "string" ? error.data.title.trim() : "";
    const detail = typeof error.data?.detail === "string" ? error.data.detail.trim() : "";
    const parts = [`X API HTTP ${error.code}`];

    if (title) {
      parts.push(title);
    }

    if (detail && detail !== title) {
      parts.push(detail);
    }

    return parts.join(": ").slice(0, 500);
  }

  if (error instanceof ApiRequestError) {
    return "X API request failed.";
  }

  if (error instanceof ApiPartialResponseError) {
    return "X API partial response.";
  }

  if (error instanceof Error && error.message.startsWith("Missing required")) {
    return "Social publishing is misconfigured.";
  }

  return "Unable to publish post.";
}

export function logXPublishError(error: unknown) {
  if (error instanceof ApiResponseError) {
    console.error("SPØR internal X post failed", {
      name: error.name,
      message: error.message,
      type: error.type,
      httpStatus: error.code,
      data: error.data,
      rateLimit: error.rateLimit ?? null,
      rateLimitError: error.rateLimitError,
      isAuthError: error.isAuthError
    });
    return;
  }

  if (error instanceof ApiRequestError) {
    console.error("SPØR internal X post failed", {
      name: error.name,
      message: error.message,
      type: error.type,
      requestErrorName: error.requestError?.name ?? null,
      requestErrorMessage: error.requestError?.message ?? null
    });
    return;
  }

  if (error instanceof ApiPartialResponseError) {
    console.error("SPØR internal X post failed", {
      name: error.name,
      message: error.message,
      type: error.type,
      responseErrorName: error.responseError?.name ?? null,
      responseErrorMessage: error.responseError?.message ?? null
    });
    return;
  }

  if (error instanceof Error) {
    console.error("SPØR internal X post failed", {
      name: error.name,
      message: error.message
    });
    return;
  }

  console.error("SPØR internal X post failed", {
    name: "unknown"
  });
}

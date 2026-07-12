import "server-only";

import { randomUUID } from "node:crypto";

type LogFields = Record<string, unknown>;

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function getRequestId(request: Request) {
  const suppliedRequestId = request.headers.get("x-request-id")?.trim();
  return suppliedRequestId && REQUEST_ID_PATTERN.test(suppliedRequestId)
    ? suppliedRequestId
    : randomUUID();
}

export function withRequestId<T extends Response>(response: T, requestId: string): T {
  response.headers.set("x-request-id", requestId);
  return response;
}

export function logServerError(event: string, error: unknown, fields: LogFields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: "sketchblock-web",
    level: "error",
    event,
    ...redact(fields),
    error: serializeError(error),
  };

  process.stderr.write(`${JSON.stringify(entry)}\n`);
}

function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { name: "UnknownError", message: String(error) };
  }

  return {
    name: error.name,
    message: error.message,
    ...(process.env.NODE_ENV !== "production" && error.stack ? { stack: error.stack } : {}),
  };
}

function redact(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      if (isSensitiveKey(key)) {
        return [key, "[redacted]"];
      }

      if (Array.isArray(value)) {
        return [
          key,
          value.map((item) =>
            typeof item === "object" && item !== null
              ? redact(item as LogFields)
              : item,
          ),
        ];
      }

      if (typeof value === "object" && value !== null) {
        return [key, redact(value as LogFields)];
      }

      return [key, value];
    }),
  );
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("authorization") ||
    normalized.includes("cookie") ||
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized === "code" ||
    normalized.includes("content") ||
    normalized.includes("payload")
  );
}

const SENSITIVE_KEY_PARTS = [
  "authorization",
  "cookie",
  "password",
  "secret",
  "token",
  "credential",
  "content",
  "payload",
  "invite",
  "url",
];

const MAX_DEPTH = 5;
const MAX_STRING_LENGTH = 512;

export function redactAuditMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return redactRecord(value, 0);
}

function redactRecord(value: Record<string, unknown>, depth: number): Record<string, unknown> {
  if (depth >= MAX_DEPTH) return { truncated: true };

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, redactValue(key, item, depth + 1)]),
  );
}

function redactValue(key: string, value: unknown, depth: number): unknown {
  if (isSensitiveKey(key)) return "[redacted]";
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactValue("item", item, depth));
  if (typeof value === "object" && value !== null) return redactRecord(value as Record<string, unknown>, depth);
  return String(value).slice(0, MAX_STRING_LENGTH);
}

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

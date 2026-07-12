import "server-only";

import { redactAuditMetadata } from "./audit-redaction";
import { findAuditEvents, insertAuditEvent } from "./audit-store";
import type { AuditEventFilter, AuditEventInput } from "./audit-types";

export async function recordAuditEvent(input: AuditEventInput) {
  return insertAuditEvent({ ...input, metadata: redactAuditMetadata(input.metadata ?? {}) });
}

export async function safeRecordAuditEvent(input: AuditEventInput) {
  try {
    await recordAuditEvent(input);
  } catch {
    // Audit failure must not expose payloads or turn an otherwise valid user action into a partial retry.
  }
}

export async function listAuditEvents(filter: AuditEventFilter) {
  return findAuditEvents(filter);
}

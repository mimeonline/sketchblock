export type AuditActorRole = "instance_owner" | "user" | "system" | "anonymous";
export type AuditOutcome = "success" | "failure";

export type AuditEventInput = {
  actorId?: string | null;
  actorUsername: string;
  actorRole: AuditActorRole;
  action: string;
  targetType: string;
  targetId?: string | null;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
  sessionId?: string | null;
};

export type AuditEvent = AuditEventInput & {
  id: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

export type AuditEventFilter = {
  actorId?: string;
  action?: string;
  outcome?: AuditOutcome;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
};

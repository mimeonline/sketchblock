import { z } from "zod";

import { sessionLifecycleStatuses, type SessionLifecycleStatus } from "../../domain/types/session-lifecycle-status.js";

export const sessionIdSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const userIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_.@-]+$/);

export const joinSessionPayloadSchema = z.object({
  sessionId: sessionIdSchema,
  userId: userIdSchema,
  displayName: z.string().min(1).max(120).optional(),
  drawingPath: z.string().min(1).max(500).optional(),
  initialContent: z.unknown().optional(),
});

export const canvasUpdatePayloadSchema = z.object({
  sessionId: sessionIdSchema,
  baseRevision: z.number().int().nonnegative().optional(),
  content: z.unknown(),
  updatedBy: userIdSchema,
});

export const yjsUpdatePayloadSchema = z.object({
  sessionId: sessionIdSchema,
  updateBase64: z.string().min(1).max(2_000_000),
  updatedBy: userIdSchema,
});

export const closeSessionPayloadSchema = z.object({
  sessionId: sessionIdSchema,
  closedBy: userIdSchema,
});

export const sessionLifecycleStatusSchema = z.enum(sessionLifecycleStatuses);

export const updateSessionStatusPayloadSchema = z.object({
  sessionId: sessionIdSchema,
  status: sessionLifecycleStatusSchema,
  updatedBy: userIdSchema,
});

export const kickClientPayloadSchema = z.object({
  sessionId: sessionIdSchema,
  socketId: z.string().min(1).max(120),
  kickedBy: userIdSchema,
});

export const inspectSessionPayloadSchema = z.object({
  sessionId: sessionIdSchema,
});

export const cursorUpdatePayloadSchema = z.object({
  sessionId: sessionIdSchema,
  pointer: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
    })
    .nullable(),
  button: z.enum(["up", "down"]).optional(),
  selectedElementIds: z.array(z.string().max(120)).max(1000).optional(),
  displayName: z.string().min(1).max(120).optional(),
  color: z.string().max(32).optional(),
});

export type JoinSessionPayload = z.infer<typeof joinSessionPayloadSchema>;
export type CanvasUpdatePayload = z.infer<typeof canvasUpdatePayloadSchema>;
export type YjsUpdatePayload = z.infer<typeof yjsUpdatePayloadSchema>;

export type SessionAuditEvent = {
  id: string;
  type:
    | "session_created"
    | "session_joined"
    | "snapshot_updated"
    | "yjs_updated"
    | "client_kicked"
    | "session_status_changed"
    | "session_closed";
  at: string;
  actor: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type PresenceUser = {
  socketId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  role?: "owner" | "collaborator" | "viewer";
  joinedAt: string;
};

export type SessionSnapshot = {
  sessionId: string;
  drawingPath: string | null;
  revision: number;
  content: unknown;
  updatedAt: string;
  updatedBy: string;
};

export type StoredSession = {
  sessionId: string;
  drawingPath: string | null;
  status: SessionLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  snapshot: SessionSnapshot | null;
  yjsStateBase64?: string | null;
  yjsRevision?: number;
  yjsUpdatedAt?: string | null;
  yjsUpdatedBy?: string | null;
  audit: SessionAuditEvent[];
};

export type StoreFile = {
  version: 1;
  sessions: Record<string, StoredSession>;
};

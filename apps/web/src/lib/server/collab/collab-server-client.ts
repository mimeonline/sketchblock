import "server-only";

import { io, type Socket } from "socket.io-client";

import { createServerCollabTicket } from "@/lib/server/auth/collab-ticket";
import type {
  CollaborationSession,
  CollaborationSessionSnapshot,
  CollabSessionRuntime,
  CollabServerStatus,
  SessionAuditEvent,
  SessionLifecycleStatus,
} from "@/types/sketchblock";

type AckResponse<T extends object = object> = T & {
  ok?: boolean;
  error?: string;
};

const DEFAULT_COLLAB_SERVER_URL = "http://localhost:4513";
const REQUEST_TIMEOUT_MS = 2000;

export function getCollabServerUrl() {
  return process.env.COLLAB_SERVER_URL || process.env.NEXT_PUBLIC_COLLAB_SERVER_URL || DEFAULT_COLLAB_SERVER_URL;
}

export async function getCollabDatabaseDiagnostics() {
  const response = await collabHttpRequest<{
    service?: string;
    database?: {
      reachable: boolean;
      schemaVersion: string | null;
      migrationStatus: "aktuell" | "ausstehend" | "fehlerhaft";
      latestSuccessfulMigration: {
        version: string | null;
        description: string | null;
        installedAt: string | null;
      } | null;
      errorCode?: "database_unavailable";
    };
  }>("/internal/diagnostics");

  if (response.ok !== true || !response.database) {
    throw new Error(response.error || "Collab database diagnostics unavailable.");
  }
  return response.database;
}

async function withSocket<T>(callback: (socket: Socket) => Promise<T>): Promise<T> {
  const socket = io(getCollabServerUrl(), {
    auth: {
      token: createServerCollabTicket(),
    },
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    timeout: REQUEST_TIMEOUT_MS,
    transports: ["websocket", "polling"],
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Collab server connection timed out.")), REQUEST_TIMEOUT_MS);

      socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once("connect_error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      socket.connect();
    });

    return await callback(socket);
  } finally {
    socket.disconnect();
  }
}

async function collabHttpRequest<T extends object>(path: string, init?: RequestInit): Promise<AckResponse<T>> {
  const response = await fetch(`${getCollabServerUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${createServerCollabTicket()}`,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  return (await response.json()) as AckResponse<T>;
}

export async function getCollabServerStatus(sessionCount = 0): Promise<CollabServerStatus> {
  const checkedAt = new Date().toISOString();
  const serverUrl = getCollabServerUrl();

  try {
    const response = await fetch(serverUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = (await response.json()) as {
      service?: string;
      status?: string;
      transport?: string;
    };

    return {
      url: serverUrl,
      reachable: response.ok && payload.status === "ok",
      service: payload.service,
      transport: payload.transport,
      checkedAt,
      sessionCount,
      activeSessionCount: sessionCount,
    };
  } catch (error) {
    return {
      url: serverUrl,
      reachable: false,
      checkedAt,
      sessionCount,
      activeSessionCount: 0,
      error: error instanceof Error ? error.message : "Collab server unavailable.",
    };
  }
}

export async function registerCollabSession(
  session: CollaborationSession,
  initialContent?: unknown,
): Promise<CollabSessionRuntime> {
  const checkedAt = new Date().toISOString();

  try {
    const ack = await collabHttpRequest<{
      status?: SessionLifecycleStatus;
      revision?: number;
      yjsRevision?: number;
      yjsStateBase64?: string | null;
      audit?: SessionAuditEvent[];
      presence?: unknown[];
    }>("/sessions", {
      method: "POST",
      body: JSON.stringify({
        sessionId: session.id,
        userId: "web-api",
        displayName: "Sketchblock Web",
        drawingPath: session.drawingPath,
        initialContent,
      }),
    });

    if (ack.ok === false) {
      return {
        status: "error",
        serverUrl: getCollabServerUrl(),
        lastCheckedAt: checkedAt,
        error: ack.error || "Collab session registration failed.",
      };
    }

    return {
      status: "registered",
      serverUrl: getCollabServerUrl(),
      sessionStatus: ack.status || "active",
      snapshotRevision: ack.revision || 0,
      yjsRevision: ack.yjsRevision || 0,
      yjsStateBytes: byteLengthFromBase64(ack.yjsStateBase64),
      presenceCount: Array.isArray(ack.presence) ? ack.presence.length : 0,
      audit: ack.audit || [],
      lastCheckedAt: checkedAt,
    };
  } catch (error) {
    return {
      status: "unreachable",
      serverUrl: getCollabServerUrl(),
      lastCheckedAt: checkedAt,
      error: error instanceof Error ? error.message : "Collab server unavailable.",
    };
  }
}

export async function inspectCollabSession(session: CollaborationSession): Promise<CollabSessionRuntime> {
  const checkedAt = new Date().toISOString();

  try {
    const inspectAck = await collabHttpRequest<{
        snapshotRevision?: number;
        snapshotUpdatedAt?: string | null;
        snapshotUpdatedBy?: string | null;
        status?: SessionLifecycleStatus;
        yjsRevision?: number;
        yjsStateBase64?: string;
        yjsUpdatedAt?: string | null;
        yjsUpdatedBy?: string | null;
        presenceCount?: number;
        presence?: CollabSessionRuntime["presence"];
        audit?: SessionAuditEvent[];
        roomName?: string;
      }>(`/sessions/${encodeURIComponent(session.id)}`);

    if (inspectAck.ok === false && inspectAck.error === "invalid_session_inspect_payload") {
      return inspectCollabSessionLegacy(session, checkedAt);
    }

    if (inspectAck.ok === false) {
      return {
        status: "error",
        serverUrl: getCollabServerUrl(),
        lastCheckedAt: checkedAt,
        error: inspectAck.error || "Collab session inspection failed.",
      };
    }

    return {
      status: "registered",
      serverUrl: getCollabServerUrl(),
      sessionStatus: inspectAck.status || "active",
      snapshotRevision: inspectAck.snapshotRevision || 0,
      snapshotUpdatedAt: inspectAck.snapshotUpdatedAt || null,
      snapshotUpdatedBy: inspectAck.snapshotUpdatedBy || null,
      yjsRevision: inspectAck.yjsRevision || 0,
      yjsStateBytes: byteLengthFromBase64(inspectAck.yjsStateBase64),
      yjsUpdatedAt: inspectAck.yjsUpdatedAt || null,
      yjsUpdatedBy: inspectAck.yjsUpdatedBy || null,
      presenceCount: inspectAck.presenceCount || 0,
      presence: inspectAck.presence || [],
      audit: inspectAck.audit || [],
      roomName: inspectAck.roomName,
      lastCheckedAt: checkedAt,
    };
  } catch (error) {
    return {
      status: "unreachable",
      serverUrl: getCollabServerUrl(),
      lastCheckedAt: checkedAt,
      error: error instanceof Error ? error.message : "Collab server unavailable.",
    };
  }
}

async function inspectCollabSessionLegacy(
  session: CollaborationSession,
  checkedAt: string,
): Promise<CollabSessionRuntime> {
  const [snapshotAck, yjsAck] = await withSocket(async (socket) => {
    const snapshot = (await socket.timeout(REQUEST_TIMEOUT_MS).emitWithAck("session:snapshot:get", {
      sessionId: session.id,
    })) as AckResponse<{ revision?: number; snapshot?: { revision?: number } | null }>;
    const yjs = (await socket.timeout(REQUEST_TIMEOUT_MS).emitWithAck("yjs:state:get", {
      sessionId: session.id,
    })) as AckResponse<{ yjsStateBase64?: string }>;

    return [snapshot, yjs] as const;
  });

  if (snapshotAck.ok === false || yjsAck.ok === false) {
    return {
      status: "error",
      serverUrl: getCollabServerUrl(),
      lastCheckedAt: checkedAt,
      error: snapshotAck.error || yjsAck.error || "Collab session inspection failed.",
    };
  }

  return {
    status: "registered",
    serverUrl: getCollabServerUrl(),
    snapshotRevision: snapshotAck.snapshot?.revision || snapshotAck.revision || 0,
    yjsStateBytes: byteLengthFromBase64(yjsAck.yjsStateBase64),
    presenceCount: undefined,
    presence: [],
    lastCheckedAt: checkedAt,
  };
}

export async function getCollabSessionSnapshot(sessionId: string): Promise<{
  snapshot: CollaborationSessionSnapshot | null;
  status: SessionLifecycleStatus;
  audit: SessionAuditEvent[];
}> {
  const ack = await collabHttpRequest<{
    snapshot?: CollaborationSessionSnapshot | null;
    status?: SessionLifecycleStatus;
    audit?: SessionAuditEvent[];
  }>(`/sessions/${encodeURIComponent(sessionId)}/state`);

  if (ack.ok === false) {
    throw new Error(ack.error || "Collab snapshot request failed.");
  }

  return {
    snapshot: ack.snapshot || null,
    status: ack.status || "active",
    audit: ack.audit || [],
  };
}

export async function upsertCollabSessionSnapshot(input: {
  sessionId: string;
  drawingPath: string;
  content: unknown;
  updatedBy: string;
}): Promise<CollaborationSessionSnapshot> {
  const ack = await collabHttpRequest<{ snapshot?: CollaborationSessionSnapshot }>(
    `/sessions/${encodeURIComponent(input.sessionId)}/state`,
    {
      method: "PATCH",
      body: JSON.stringify({
      content: input.content,
      updatedBy: input.updatedBy,
      }),
    },
  );

  if (ack.ok === false || !ack.snapshot) {
    throw new Error(ack.error || "Collab snapshot update failed.");
  }

  return ack.snapshot;
}

export async function updateCollabSessionStatus(input: {
  sessionId: string;
  status: SessionLifecycleStatus;
  updatedBy: string;
}): Promise<CollabSessionRuntime> {
  const checkedAt = new Date().toISOString();

  try {
    const ack = await collabHttpRequest<{ status?: SessionLifecycleStatus; audit?: SessionAuditEvent[] }>(
      `/sessions/${encodeURIComponent(input.sessionId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: input.status,
          updatedBy: input.updatedBy,
        }),
      },
    );

    if (ack.ok === false) {
      return {
        status: "error",
        serverUrl: getCollabServerUrl(),
        lastCheckedAt: checkedAt,
        error: ack.error || "Collab session status update failed.",
      };
    }

    return {
      status: "registered",
      sessionStatus: ack.status || input.status,
      audit: ack.audit || [],
      serverUrl: getCollabServerUrl(),
      lastCheckedAt: checkedAt,
    };
  } catch (error) {
    return {
      status: "unreachable",
      serverUrl: getCollabServerUrl(),
      lastCheckedAt: checkedAt,
      error: error instanceof Error ? error.message : "Collab session status update unavailable.",
    };
  }
}

export async function closeCollabSession(sessionId: string): Promise<CollabSessionRuntime> {
  const checkedAt = new Date().toISOString();

  try {
    const ack = await collabHttpRequest<{ sessionId?: string }>(`/sessions/${encodeURIComponent(sessionId)}/close`, {
      method: "POST",
      body: JSON.stringify({
        closedBy: "web-api",
      }),
    });

    if (ack.ok === false) {
      return {
        status: "error",
        serverUrl: getCollabServerUrl(),
        lastCheckedAt: checkedAt,
        error: ack.error || "Collab session close failed.",
      };
    }

    return {
      status: "registered",
      sessionStatus: "closed",
      serverUrl: getCollabServerUrl(),
      lastCheckedAt: checkedAt,
    };
  } catch (error) {
    return {
      status: "unreachable",
      serverUrl: getCollabServerUrl(),
      lastCheckedAt: checkedAt,
      error: error instanceof Error ? error.message : "Collab server close unavailable.",
    };
  }
}

export async function kickCollabClient(sessionId: string, socketId: string): Promise<CollabSessionRuntime> {
  const checkedAt = new Date().toISOString();

  try {
    const ack = await withSocket((socket) =>
      socket.timeout(REQUEST_TIMEOUT_MS).emitWithAck("client:kick", {
        sessionId,
        socketId,
        kickedBy: "web-api",
      }) as Promise<AckResponse<{ sessionId?: string; socketId?: string; disconnected?: boolean }>>,
    );

    if (ack.ok === false) {
      return {
        status: "error",
        serverUrl: getCollabServerUrl(),
        lastCheckedAt: checkedAt,
        error: ack.error || "Collab client removal failed.",
      };
    }

    return {
      status: "registered",
      serverUrl: getCollabServerUrl(),
      lastCheckedAt: checkedAt,
    };
  } catch (error) {
    return {
      status: "unreachable",
      serverUrl: getCollabServerUrl(),
      lastCheckedAt: checkedAt,
      error: error instanceof Error ? error.message : "Collab client removal unavailable.",
    };
  }
}

function byteLengthFromBase64(value?: string | null) {
  if (!value) {
    return 0;
  }

  return Buffer.byteLength(value, "base64");
}

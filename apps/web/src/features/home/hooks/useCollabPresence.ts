"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import type { CollabCursor, CollaborationSessionSnapshot, CollabPresenceClient, SessionAuditEvent, SessionLifecycleStatus, SessionRole } from "@/types/sketchblock";

type CollabPresenceState = {
  status: "connecting" | "connected" | "disconnected" | "error";
  socketId?: string;
  presence: CollabPresenceClient[];
  sessionStatus?: SessionLifecycleStatus;
  snapshot?: CollaborationSessionSnapshot | null;
  yjsStateBase64?: string | null;
  yjsRevision?: number;
  remoteYjsUpdate?: {
    updateBase64: string;
    updatedBy: string;
    sequence: number;
  } | null;
  audit: SessionAuditEvent[];
  error?: string;
};

const DEFAULT_LOCAL_COLLAB_SERVER_URL = "http://localhost:4513";

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function resolveBrowserCollabServerUrl(
  configuredUrl = process.env.NEXT_PUBLIC_COLLAB_SERVER_URL,
  browserLocation: Pick<Location, "hostname" | "origin"> | undefined = typeof window === "undefined" ? undefined : window.location,
) {
  if (!browserLocation) {
    return configuredUrl || DEFAULT_LOCAL_COLLAB_SERVER_URL;
  }

  if (!configuredUrl) {
    return isLocalHostname(browserLocation.hostname) ? DEFAULT_LOCAL_COLLAB_SERVER_URL : browserLocation.origin;
  }

  try {
    const parsedUrl = new URL(configuredUrl, browserLocation.origin);
    if (isLocalHostname(parsedUrl.hostname) && !isLocalHostname(browserLocation.hostname)) {
      return browserLocation.origin;
    }
  } catch {
    return configuredUrl;
  }

  return configuredUrl;
}

export function useCollabPresence(input: {
  sessionId: string;
  clientId: string;
  role: SessionRole;
  inviteToken?: string;
  drawingPath?: string;
  displayName?: string;
}) {
  const [state, setState] = useState<CollabPresenceState>({
    status: "connecting",
    presence: [],
    audit: [],
  });
  const [cursors, setCursors] = useState<Record<string, CollabCursor>>({});
  const socketRef = useRef<Socket | null>(null);
  const snapshotRevisionRef = useRef(0);
  const yjsUpdateSequenceRef = useRef(0);
  const collabServerUrl = useMemo(() => resolveBrowserCollabServerUrl(), []);

  const displayName = useMemo(
    () => input.displayName || `Guest ${input.clientId.slice(0, 4)}`,
    [input.clientId, input.displayName],
  );

  useEffect(() => {
    if (!input.clientId) {
      return;
    }

    let cancelled = false;
    let socket: Socket | null = null;

    async function connect() {
      try {
        const tokenResponse = await fetch("/api/auth/socket-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: input.sessionId,
            role: input.role,
            clientId: input.clientId,
            inviteToken: input.inviteToken,
          }),
        });
        const tokenPayload = (await tokenResponse.json()) as { token?: string; error?: string };

        if (!tokenResponse.ok || !tokenPayload.token) {
          throw new Error(tokenPayload.error || "Could not create socket auth token.");
        }

        if (cancelled) {
          return;
        }

        socket = io(collabServerUrl, {
          auth: {
            token: tokenPayload.token,
          },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionAttempts: 8,
          reconnectionDelay: 500,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          socket?.emit(
            "session:join",
            {
              sessionId: input.sessionId,
              userId: input.clientId,
              displayName,
              drawingPath: input.drawingPath,
            },
            (ack: {
              ok?: boolean;
              error?: string;
              socketId?: string;
              presence?: CollabPresenceClient[];
              status?: SessionLifecycleStatus;
              snapshot?: CollaborationSessionSnapshot | null;
              audit?: SessionAuditEvent[];
              yjsStateBase64?: string | null;
              yjsRevision?: number;
            }) => {
              if (ack?.ok === false) {
                setState({
                  status: "error",
                  presence: [],
                  audit: [],
                  error: ack.error || "Collab join failed.",
                });
                return;
              }

              setState({
                status: "connected",
                socketId: ack?.socketId || socket?.id,
                presence: ack?.presence || [],
                sessionStatus: ack?.status || "active",
                snapshot: ack?.snapshot || null,
                yjsStateBase64: ack?.yjsStateBase64 || null,
                yjsRevision: ack?.yjsRevision || 0,
                remoteYjsUpdate: null,
                audit: ack?.audit || [],
              });
              snapshotRevisionRef.current = ack?.snapshot?.revision || 0;
            },
          );
        });

        socket.on("presence:update", (payload: { presence?: CollabPresenceClient[] }) => {
          const presence = payload.presence || [];
          setState((current) => ({
            ...current,
            status: socket?.connected ? "connected" : current.status,
            presence,
          }));
          const presentIds = new Set(presence.map((client) => client.socketId));
          setCursors((current) => {
            const next: Record<string, CollabCursor> = {};
            for (const [socketId, cursor] of Object.entries(current)) {
              if (presentIds.has(socketId)) {
                next[socketId] = cursor;
              }
            }
            return Object.keys(next).length === Object.keys(current).length ? current : next;
          });
        });

        socket.on("cursor:update", (payload: CollabCursor) => {
          if (!payload?.socketId) {
            return;
          }
          setCursors((current) => {
            if (!payload.pointer) {
              if (!current[payload.socketId]) {
                return current;
              }
              const next = { ...current };
              delete next[payload.socketId];
              return next;
            }
            return { ...current, [payload.socketId]: payload };
          });
        });

        socket.on("canvas:update", (snapshot: CollaborationSessionSnapshot) => {
          if (!snapshot || snapshot.revision <= snapshotRevisionRef.current) {
            return;
          }

          snapshotRevisionRef.current = snapshot.revision;
          setState((current) => ({
            ...current,
            snapshot,
          }));
        });

        socket.on("yjs:update", (payload: { updateBase64?: string; updatedBy?: string }) => {
          if (!payload.updateBase64 || !payload.updatedBy) {
            return;
          }

          const updateBase64 = payload.updateBase64;
          const updatedBy = payload.updatedBy;
          yjsUpdateSequenceRef.current += 1;
          setState((current) => ({
            ...current,
            remoteYjsUpdate: {
              updateBase64,
              updatedBy,
              sequence: yjsUpdateSequenceRef.current,
            },
          }));
        });

        socket.on("yjs:state:update", (payload: { yjsStateBase64?: string | null }) => {
          setState((current) => ({
            ...current,
            yjsStateBase64: payload.yjsStateBase64 ?? current.yjsStateBase64,
          }));
        });

        socket.on("session:status:update", (payload: { status?: SessionLifecycleStatus; audit?: SessionAuditEvent[] }) => {
          setState((current) => ({
            ...current,
            sessionStatus: payload.status || current.sessionStatus,
            audit: payload.audit || current.audit,
          }));
        });

        socket.on("session:closed", () => {
          setState((current) => ({
            ...current,
            status: "disconnected",
            sessionStatus: "closed",
          }));
          socket?.disconnect();
        });

        socket.on("client:kicked", () => {
          setState((current) => ({
            ...current,
            status: "disconnected",
            error: "This client was removed from the session.",
          }));
          socket?.disconnect();
        });

        socket.on("disconnect", () => {
          setState((current) => ({
            ...current,
            status: "disconnected",
          }));
          setCursors({});
        });

        socket.on("connect_error", (error) => {
          setState({
            status: "error",
            presence: [],
            audit: [],
            error: error.message,
          });
        });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            presence: [],
            audit: [],
            error: error instanceof Error ? error.message : "Socket authentication failed.",
          });
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      socket?.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [collabServerUrl, displayName, input.clientId, input.drawingPath, input.inviteToken, input.role, input.sessionId]);

  async function pushSnapshot(content: unknown) {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      throw new Error("Collab socket is not connected.");
    }

    const ack = (await socket.timeout(2500).emitWithAck("canvas:update", {
      sessionId: input.sessionId,
      baseRevision: snapshotRevisionRef.current,
      content,
      updatedBy: input.clientId,
    })) as {
      ok?: boolean;
      error?: string;
      snapshot?: CollaborationSessionSnapshot;
    };

    if (ack.ok === false || !ack.snapshot) {
      throw new Error(ack.error || "Canvas update failed.");
    }

    snapshotRevisionRef.current = ack.snapshot.revision;
    setState((current) => ({
      ...current,
      snapshot: ack.snapshot || current.snapshot,
    }));

    return ack.snapshot;
  }

  function sendCursor(cursor: Omit<CollabCursor, "socketId">) {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      return;
    }

    socket.emit("cursor:update", {
      sessionId: input.sessionId,
      pointer: cursor.pointer,
      button: cursor.button,
      selectedElementIds: cursor.selectedElementIds,
      displayName: cursor.displayName,
      color: cursor.color,
    });
  }

  function sendYjsUpdate(updateBase64: string) {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      return;
    }

    socket
      .timeout(2500)
      .emitWithAck("yjs:update", {
        sessionId: input.sessionId,
        updateBase64,
        updatedBy: input.clientId,
      })
      .then((ack: { ok?: boolean; yjsStateBase64?: string | null; error?: string }) => {
        if (ack.ok === false) {
          return;
        }

        setState((current) => ({
          ...current,
          yjsStateBase64: ack.yjsStateBase64 ?? current.yjsStateBase64,
        }));
      })
      .catch(() => {
        // Realtime updates are best-effort; the next local change or snapshot keeps the room moving.
      });
  }

  return {
    ...state,
    cursors,
    serverUrl: collabServerUrl,
    pushSnapshot,
    sendCursor,
    sendYjsUpdate,
  };
}

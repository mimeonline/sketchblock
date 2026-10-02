"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";

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

function decodeYjsUpdate(value: string) {
  return Uint8Array.from(window.atob(value), (character) => character.charCodeAt(0));
}

function encodeYjsUpdate(update: Uint8Array) {
  return window.btoa(Array.from(update, (byte) => String.fromCharCode(byte)).join(""));
}

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
  const pendingYjsRef = useRef<{ sessionId: string; update: Uint8Array; version: number } | null>(null);
  const flushYjsRef = useRef<() => void>(() => {});
  const collabServerUrl = useMemo(() => resolveBrowserCollabServerUrl(), []);

  const displayName = useMemo(
    () => input.displayName || `Guest ${input.clientId.slice(0, 4)}`,
    [input.clientId, input.displayName],
  );
  // Identity changes must not tear down a live socket (each reconnect is a new join).
  const displayNameRef = useRef(displayName);
  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  useEffect(() => {
    if (!input.clientId) {
      return;
    }

    let cancelled = false;
    let socket: Socket | null = null;
    let yjsInFlight = false;
    let joined = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryAttempts = 0;
    function flushYjs() {
      const pending = pendingYjsRef.current;
      if (cancelled || !joined || yjsInFlight || !socket?.connected || !pending || pending.sessionId !== input.sessionId) return;
      yjsInFlight = true;
      const sendingSocket = socket;
      void sendingSocket.timeout(2500).emitWithAck("yjs:update", {
        sessionId: input.sessionId, updateBase64: encodeYjsUpdate(pending.update), updatedBy: input.clientId,
      }).then((ack: { ok?: boolean; yjsStateBase64?: string | null }) => {
        if (cancelled) return;
        if (ack.ok === false) return;
        retryAttempts = 0;
        if (pendingYjsRef.current?.version === pending.version && pendingYjsRef.current.sessionId === input.sessionId) {
          pendingYjsRef.current = null;
        }
        setState((current) => ({ ...current, yjsStateBase64: ack.yjsStateBase64 ?? current.yjsStateBase64 }));
      }).catch(() => {
        // Retain one merged update until acknowledged; Yjs replay is idempotent.
        if (!cancelled && retryAttempts < 8) {
          retryAttempts += 1;
          retryTimer = setTimeout(() => { retryTimer = undefined; flushYjs(); }, Math.min(500 * 2 ** retryAttempts, 10_000));
        }
      }).finally(() => {
        yjsInFlight = false;
        if (!cancelled && !retryTimer && pendingYjsRef.current?.version !== pending.version) flushYjs();
      });
    }
    flushYjsRef.current = flushYjs;

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
        const tokenPayload = (await tokenResponse.json()) as { token?: string; error?: string; code?: string };

        if (tokenPayload.code === "session_closed") {
          if (!cancelled) {
            setState({ status: "disconnected", presence: [], audit: [], sessionStatus: "closed" });
          }
          return;
        }
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
              displayName: displayNameRef.current,
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
                  sessionStatus: ack.error === "session_closed" ? "closed" : undefined,
                });
                if (ack.error === "session_closed") socket?.disconnect();
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
              joined = true;
              retryAttempts = 0;
              if (retryTimer) { clearTimeout(retryTimer); retryTimer = undefined; }
              flushYjs();
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
              // React can batch multiple socket events before the editor renders.
              // Merge their operations rather than retaining only the last event.
              updateBase64: current.remoteYjsUpdate
                ? encodeYjsUpdate(Y.mergeUpdates([decodeYjsUpdate(current.remoteYjsUpdate.updateBase64), decodeYjsUpdate(updateBase64)]))
                : updateBase64,
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
          joined = false;
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
      if (retryTimer) clearTimeout(retryTimer);
      socket?.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [collabServerUrl, input.clientId, input.inviteToken, input.role, input.sessionId]);

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
      if (ack.error === "snapshot_conflict" && ack.snapshot && ack.snapshot.revision >= snapshotRevisionRef.current) {
        snapshotRevisionRef.current = ack.snapshot.revision;
        setState((current) => ({ ...current, snapshot: ack.snapshot }));
      }
      throw new Error(ack.error || "Canvas update failed.");
    }

    if (ack.snapshot.revision >= snapshotRevisionRef.current) {
      snapshotRevisionRef.current = ack.snapshot.revision;
      setState((current) => ({ ...current, snapshot: ack.snapshot }));
    }

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
    const update = decodeYjsUpdate(updateBase64);
    const pending = pendingYjsRef.current;
    pendingYjsRef.current = {
      sessionId: input.sessionId,
      update: pending?.sessionId === input.sessionId ? Y.mergeUpdates([pending.update, update]) : update,
      version: (pending?.version ?? 0) + 1,
    };
    flushYjsRef.current();
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

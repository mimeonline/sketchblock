"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";

import { DEFAULT_MODERATION, type FacilitationAck, type IncomingReaction, type ModerationState, type ModerationUpdate, type ReactionEmoji, type RemoteViewport, type VotesState } from "@/features/facilitation/types";
import type { CollabCursor, CollaborationSessionSnapshot, CollabPresenceClient, SessionAuditEvent, SessionLifecycleStatus, SessionRole } from "@/types/sketchblock";

type CollabPresenceState = {
  status: "connecting" | "connected" | "disconnected" | "error";
  socketId?: string;
  presence: CollabPresenceClient[];
  sessionStatus?: SessionLifecycleStatus;
  /** Set when the server permanently rejects live edits (e.g. document too large). */
  syncError?: string;
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
  moderation: ModerationState;
  votes: VotesState;
};

const DEFAULT_LOCAL_COLLAB_SERVER_URL = "http://localhost:4513";

class TerminalSocketAuthError extends Error {
  constructor(readonly code: "session_closed" | "participant_removed", message: string) {
    super(message);
  }
}

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
    moderation: DEFAULT_MODERATION,
    votes: {},
  });
  const [remoteViewport, setRemoteViewport] = useState<RemoteViewport | null>(null);
  const [reactions, setReactions] = useState<IncomingReaction[]>([]);
  const reactionIdRef = useRef(0);
  const viewportSequenceRef = useRef(0);
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
    let flushRequested = false;
    let joined = false;
    let terminalAuthError: TerminalSocketAuthError["code"] | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryAttempts = 0;
    function flushYjs() {
      const pending = pendingYjsRef.current;
      if (cancelled || !joined || !socket?.connected || !pending || pending.sessionId !== input.sessionId) return;
      if (yjsInFlight) {
        flushRequested = true;
        return;
      }
      flushRequested = false;
      yjsInFlight = true;
      const sendingSocket = socket;
      void sendingSocket.timeout(2500).emitWithAck("yjs:update", {
        sessionId: input.sessionId, updateBase64: encodeYjsUpdate(pending.update), updatedBy: input.clientId,
      }).then((ack: { ok?: boolean; error?: string; yjsStateBase64?: string | null; retryAfterSeconds?: number }) => {
        if (cancelled) return;
        if (ack.ok === false) {
          if (ack.error === "yjs_update_rate_limit_exceeded") {
            retryTimer = setTimeout(() => { retryTimer = undefined; flushYjs(); }, Math.max(1, ack.retryAfterSeconds ?? 1) * 1000);
            return;
          }
          // editing_locked is expected while the owner pauses editing; the UI shows the lock.
          if (ack.error === "editing_locked") return;
          setState((current) => ({ ...current, syncError: ack.error || "yjs_update_rejected" }));
          return;
        }
        retryAttempts = 0;
        if (pendingYjsRef.current?.version === pending.version && pendingYjsRef.current.sessionId === input.sessionId) {
          pendingYjsRef.current = null;
        }
        setState((current) => ({ ...current, yjsStateBase64: ack.yjsStateBase64 ?? current.yjsStateBase64 }));
      }).catch(() => {
        // Retain one merged update until acknowledged; Yjs replay is idempotent.
        if (!cancelled && retryAttempts < 8) {
          retryAttempts += 1;
          // A reconnect or a newer local update already requested another flush.
          // Let finally replay immediately instead of adding backoff latency.
          if (flushRequested && joined && socket?.connected) return;
          retryTimer = setTimeout(() => { retryTimer = undefined; flushYjs(); }, Math.min(500 * 2 ** retryAttempts, 10_000));
        }
      }).finally(() => {
        yjsInFlight = false;
        if (
          !cancelled &&
          !retryTimer &&
          (flushRequested || pendingYjsRef.current?.version !== pending.version)
        ) {
          flushYjs();
        }
      });
    }
    flushYjsRef.current = flushYjs;

    async function connect() {
      try {
        async function requestSocketToken() {
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

          if (tokenPayload.code === "session_closed" || tokenPayload.code === "participant_removed") {
            terminalAuthError = tokenPayload.code;
            if (!cancelled) {
              setState({
                status: "disconnected",
                presence: [],
                audit: [],
                moderation: DEFAULT_MODERATION,
                votes: {},
                sessionStatus: tokenPayload.code === "session_closed" ? "closed" : undefined,
                error: tokenPayload.code === "participant_removed"
                  ? tokenPayload.error || "This client was removed from the session."
                  : undefined,
              });
            }
            throw new TerminalSocketAuthError(
              tokenPayload.code,
              tokenPayload.error || tokenPayload.code,
            );
          }
          if (!tokenResponse.ok || !tokenPayload.token) {
            throw new Error(tokenPayload.error || "Could not create socket auth token.");
          }
          return tokenPayload.token;
        }

        let nextToken: string | null = await requestSocketToken();

        if (cancelled) {
          return;
        }

        socket = io(collabServerUrl, {
          auth: async (callback) => {
            try {
              const token = nextToken || await requestSocketToken();
              nextToken = null;
              callback({ token: cancelled ? "" : token });
            } catch (error) {
              if (!cancelled && !(error instanceof TerminalSocketAuthError) && error instanceof Error) {
                setState((current) => ({ ...current, status: "error", error: error.message }));
              }
              callback({ token: "" });
              if (error instanceof TerminalSocketAuthError) socket?.disconnect();
            }
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
              moderation?: ModerationState;
              votes?: VotesState;
            }) => {
              if (ack?.ok === false) {
                setState({
                  status: "error",
                  presence: [],
                  audit: [],
                  moderation: DEFAULT_MODERATION,
                  votes: {},
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
                moderation: ack?.moderation || DEFAULT_MODERATION,
                votes: ack?.votes || {},
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

        socket.on("moderation:state", (payload: { moderation?: ModerationState }) => {
          if (!payload?.moderation) return;
          const moderation = payload.moderation;
          setState((current) => ({ ...current, moderation }));
        });

        socket.on("votes:state", (payload: { votes?: VotesState }) => {
          if (!payload?.votes) return;
          const votes = payload.votes;
          setState((current) => ({ ...current, votes }));
        });

        socket.on("viewport:update", (payload: { scrollX?: number; scrollY?: number; zoom?: number }) => {
          if (typeof payload?.scrollX !== "number" || typeof payload.scrollY !== "number" || typeof payload.zoom !== "number") return;
          viewportSequenceRef.current += 1;
          setRemoteViewport({ scrollX: payload.scrollX, scrollY: payload.scrollY, zoom: payload.zoom, sequence: viewportSequenceRef.current });
        });

        socket.on("reaction", (payload: { emoji?: string; pointer?: { x: number; y: number }; displayName?: string; socketId?: string }) => {
          if (!payload?.emoji) return;
          reactionIdRef.current += 1;
          const reaction: IncomingReaction = { id: reactionIdRef.current, emoji: payload.emoji, pointer: payload.pointer, displayName: payload.displayName, socketId: payload.socketId };
          setReactions((current) => [...current.slice(-19), reaction]);
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
          if (terminalAuthError) return;
          setState({
            status: "error",
            presence: [],
            audit: [],
            moderation: DEFAULT_MODERATION,
            votes: {},
            error: error.message,
          });
        });
      } catch (error) {
        if (!cancelled && !(error instanceof TerminalSocketAuthError)) {
          setState({
            status: "error",
            presence: [],
            audit: [],
            moderation: DEFAULT_MODERATION,
            votes: {},
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

  async function request(event: string, payload: Record<string, unknown>): Promise<FacilitationAck> {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return { ok: false, error: "not_connected" };
    try {
      const ack = (await socket.timeout(2500).emitWithAck(event, { sessionId: input.sessionId, ...payload })) as FacilitationAck | undefined;
      return ack?.ok === false ? { ok: false, error: ack.error || "rejected" } : { ok: true };
    } catch {
      return { ok: false, error: "timeout" };
    }
  }

  function updateModeration(update: ModerationUpdate) {
    return request("moderation:update", { ...update });
  }

  function sendViewport(viewport: { scrollX: number; scrollY: number; zoom: number }) {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit("viewport:update", { sessionId: input.sessionId, ...viewport });
  }

  function toggleVote(elementId: string) {
    return request("vote:toggle", { elementId });
  }

  function sendReaction(emoji: ReactionEmoji, pointer?: { x: number; y: number }) {
    return request("reaction:send", pointer ? { emoji, pointer } : { emoji });
  }

  function dismissReaction(id: number) {
    setReactions((current) => current.filter((reaction) => reaction.id !== id));
  }

  return {
    ...state,
    remoteViewport,
    reactions,
    dismissReaction,
    updateModeration,
    sendViewport,
    toggleVote,
    sendReaction,
    cursors,
    serverUrl: collabServerUrl,
    pushSnapshot,
    sendCursor,
    sendYjsUpdate,
  };
}

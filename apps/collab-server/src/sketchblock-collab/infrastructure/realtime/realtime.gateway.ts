import { Inject } from "@nestjs/common";
import {
  Ack as SocketAck,
  ConnectedSocket,
  OnGatewayConnection,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

import {
  canvasUpdatePayloadSchema,
  closeSessionPayloadSchema,
  cursorUpdatePayloadSchema,
  inspectSessionPayloadSchema,
  joinSessionPayloadSchema,
  kickClientPayloadSchema,
  updateSessionStatusPayloadSchema,
  yjsUpdatePayloadSchema,
  type PresenceUser,
} from "../../application/dtos/collab-schemas.js";
import { PresenceStorePort } from "../../application/ports/presence-store.port.js";
import { ApplyYjsUpdateUseCase } from "../../application/use-cases/apply-yjs-update.use-case.js";
import { CloseSessionUseCase } from "../../application/use-cases/close-session.use-case.js";
import { GetSessionStateUseCase } from "../../application/use-cases/get-session-state.use-case.js";
import { InspectSessionUseCase } from "../../application/use-cases/inspect-session.use-case.js";
import { RegisterSessionUseCase } from "../../application/use-cases/register-session.use-case.js";
import { RemoveClientUseCase } from "../../application/use-cases/remove-client.use-case.js";
import { UpdateSessionStatusUseCase } from "../../application/use-cases/update-session-status.use-case.js";
import { UpsertSessionSnapshotUseCase } from "../../application/use-cases/upsert-session-snapshot.use-case.js";
import { SessionAccessPolicy } from "../../domain/services/session-access-policy.js";
import { CollabConfigService } from "../../../shared/infrastructure/config/collab-config.service.js";
import { StructuredLoggerService } from "../../../shared/infrastructure/logging/structured-logger.service.js";
import { CollabRateLimitService } from "../../../shared/infrastructure/security/collab-rate-limit.service.js";
import { CollabTicketVerifier, type CollabTicketPayload } from "../auth/collab-ticket.verifier.js";
import { SessionStorePort } from "../../application/ports/session-store.port.js";

type AckCallback = (response: unknown) => void;
type AuthenticatedSocket = Socket & { data: { auth?: CollabTicketPayload } };

function roomName(sessionId: string) {
  return `session:${sessionId}`;
}

function socketSessionIds(socketRooms: Set<string>) {
  return Array.from(socketRooms)
    .filter((room) => room.startsWith("session:"))
    .map((room) => room.replace("session:", ""));
}

@WebSocketGateway()
export class RealtimeGateway
  implements OnGatewayInit<Server>, OnGatewayConnection<AuthenticatedSocket>, OnGatewayDisconnect<AuthenticatedSocket>
{
  @WebSocketServer()
  private server!: Server;

  constructor(
    @Inject(CollabConfigService)
    private readonly config: CollabConfigService,
    @Inject(StructuredLoggerService)
    private readonly logger: StructuredLoggerService,
    @Inject(CollabRateLimitService)
    private readonly rateLimits: CollabRateLimitService,
    @Inject(CollabTicketVerifier)
    private readonly tickets: CollabTicketVerifier,
    @Inject(PresenceStorePort)
    private readonly presence: PresenceStorePort,
    @Inject(SessionStorePort)
    private readonly sessions: SessionStorePort,
    @Inject(ApplyYjsUpdateUseCase)
    private readonly applyYjsUpdate: ApplyYjsUpdateUseCase,
    @Inject(CloseSessionUseCase)
    private readonly closeSessionUseCase: CloseSessionUseCase,
    @Inject(GetSessionStateUseCase)
    private readonly getSessionStateUseCase: GetSessionStateUseCase,
    @Inject(InspectSessionUseCase)
    private readonly inspectSessionUseCase: InspectSessionUseCase,
    @Inject(RegisterSessionUseCase)
    private readonly registerSessionUseCase: RegisterSessionUseCase,
    @Inject(RemoveClientUseCase)
    private readonly removeClientUseCase: RemoveClientUseCase,
    @Inject(UpdateSessionStatusUseCase)
    private readonly updateSessionStatusUseCase: UpdateSessionStatusUseCase,
    @Inject(UpsertSessionSnapshotUseCase)
    private readonly upsertSessionSnapshot: UpsertSessionSnapshotUseCase,
  ) {}

  afterInit(server: Server) {
    server.use((socket: AuthenticatedSocket, next) => {
      const connectLimit = this.rateLimits.consumeSocketConnect(this.socketIpAddress(socket));
      if (!connectLimit.allowed) {
        this.logSocketEvent("socket.connect.rate_limited", socket, {
          error: "socket_connect_rate_limit_exceeded",
          retryAfterSeconds: connectLimit.retryAfterSeconds,
        });
        next(new Error("socket_connect_rate_limit_exceeded"));
        return;
      }

      if (!this.config.authSecret) {
        next();
        return;
      }

      const ticket = this.tickets.verifyDetailed(socket.handshake.auth?.token, this.config.authSecret);
      if (!ticket.ok) {
        this.logSocketEvent("socket.auth.failed", socket, {
          error: ticket.error,
        });
        next(new Error(ticket.error));
        return;
      }

      socket.data.auth = ticket.payload;
      this.logSocketEvent("socket.auth.succeeded", socket, {
        sessionId: ticket.payload.sessionId,
        role: ticket.payload.role,
      });
      next();
    });
  }

  handleConnection(socket: AuthenticatedSocket) {
    this.logSocketEvent("socket.connected", socket);
    socket.on("disconnecting", () => {
      this.handleDisconnecting(socket);
    });
  }

  @SubscribeMessage("session:join")
  async joinSession(
    @MessageBody() rawPayload: unknown,
    @ConnectedSocket() socket: AuthenticatedSocket,
    @SocketAck() ack?: AckCallback,
  ) {
    if (!this.consumeSocketEvent(socket, "session.join", ack)) {
      return;
    }

    const result = joinSessionPayloadSchema.safeParse(rawPayload);
    if (!result.success) {
      this.logSocketEvent("session.join.failed", socket, { error: "invalid_session_join_payload" });
      ack?.({ ok: false, error: "invalid_session_join_payload" });
      return;
    }

    const payload = result.data;
    if (!this.canAccessSession(socket, payload.sessionId)) {
      this.logSocketEvent("session.join.failed", socket, { sessionId: payload.sessionId, error: "not_authorized" });
      ack?.({ ok: false, error: "not_authorized" });
      return;
    }

    const capacity = await this.checkSessionCapacity(socket, payload.sessionId);
    if (!capacity.ok) {
      this.logSocketEvent("session.join.failed", socket, { sessionId: payload.sessionId, error: capacity.error });
      ack?.({ ok: false, error: capacity.error });
      return;
    }

    const auth = this.socketAuth(socket);
    const session = await this.registerSessionUseCase.execute(payload);

    const presenceUser: PresenceUser = {
      socketId: socket.id,
      userId: auth && auth.role !== "server" ? auth.actor : payload.userId,
      displayName: auth && auth.role !== "server" ? auth.displayName : payload.displayName || payload.userId,
      avatarUrl: auth && auth.role !== "server" ? auth.avatarUrl : null,
      role: auth && auth.role !== "server" ? auth.role : "collaborator",
      joinedAt: new Date().toISOString(),
    };

    await socket.join(roomName(payload.sessionId));
    this.presence.addPresence(payload.sessionId, presenceUser);

    const presence = this.presence.getPresence(payload.sessionId);
    socket.to(roomName(payload.sessionId)).emit("presence:update", {
      sessionId: payload.sessionId,
      presence,
    });
    this.logSocketEvent("session.join.succeeded", socket, {
      sessionId: payload.sessionId,
      status: session.status || "active",
      presenceCount: presence.length,
      snapshotRevision: session.snapshot?.revision || 0,
    });

    ack?.({
      ok: true,
      sessionId: payload.sessionId,
      socketId: socket.id,
      snapshot: session.snapshot,
      status: session.status || "active",
      revision: session.snapshot?.revision || 0,
      yjsStateBase64: session.yjsStateBase64 || null,
      yjsRevision: session.yjsRevision || 0,
      audit: session.audit || [],
      presence,
    });
  }

  @SubscribeMessage("canvas:update")
  async updateCanvas(
    @MessageBody() rawPayload: unknown,
    @ConnectedSocket() socket: AuthenticatedSocket,
    @SocketAck() ack?: AckCallback,
  ) {
    if (!this.consumeSocketEvent(socket, "canvas.update", ack)) {
      return;
    }

    const result = canvasUpdatePayloadSchema.safeParse(rawPayload);
    if (!result.success) {
      this.logSocketEvent("canvas.update.failed", socket, { error: "invalid_canvas_update_payload" });
      ack?.({ ok: false, error: "invalid_canvas_update_payload" });
      return;
    }

    const payload = result.data;
    if (!this.canEditSession(socket, payload.sessionId)) {
      this.logSocketEvent("canvas.update.failed", socket, { sessionId: payload.sessionId, error: "not_authorized" });
      ack?.({ ok: false, error: "not_authorized" });
      return;
    }

    const updatedBy = this.socketAuth(socket)?.actor || payload.updatedBy;
    const resultPayload = await this.upsertSessionSnapshot.execute({ ...payload, updatedBy });

    socket.to(roomName(payload.sessionId)).emit("canvas:update", resultPayload.snapshot);
    socket.to(roomName(payload.sessionId)).emit("yjs:state:update", {
      sessionId: payload.sessionId,
      yjsStateBase64: resultPayload.yjsStateBase64,
      updatedBy,
    });
    this.logSocketEvent("canvas.update.succeeded", socket, {
      sessionId: payload.sessionId,
      updatedBy,
      snapshotRevision: resultPayload.snapshot.revision,
    });
    ack?.({ ok: true, ...resultPayload });
  }

  @SubscribeMessage("cursor:update")
  handleCursorUpdate(@MessageBody() rawPayload: unknown, @ConnectedSocket() socket: AuthenticatedSocket) {
    const result = cursorUpdatePayloadSchema.safeParse(rawPayload);
    if (!result.success) {
      return;
    }

    const payload = result.data;
    if (!this.canAccessSession(socket, payload.sessionId)) {
      return;
    }

    // Ephemere Presence-Cursor: kein Persistieren, kein Logging (hohe Frequenz), nur Relay an den Raum.
    socket.to(roomName(payload.sessionId)).emit("cursor:update", {
      sessionId: payload.sessionId,
      socketId: socket.id,
      pointer: payload.pointer,
      button: payload.button ?? "up",
      selectedElementIds: payload.selectedElementIds ?? [],
      displayName: this.socketAuth(socket)?.displayName || payload.displayName,
      color: payload.color,
    });
  }

  @SubscribeMessage("yjs:update")
  async updateYjs(
    @MessageBody() rawPayload: unknown,
    @ConnectedSocket() socket: AuthenticatedSocket,
    @SocketAck() ack?: AckCallback,
  ) {
    if (!this.consumeYjsUpdate(socket, ack)) {
      return;
    }

    const result = yjsUpdatePayloadSchema.safeParse(rawPayload);
    if (!result.success) {
      this.logSocketEvent("yjs.update.failed", socket, { error: "invalid_yjs_update_payload" });
      ack?.({ ok: false, error: "invalid_yjs_update_payload" });
      return;
    }

    const payload = result.data;
    if (!this.canEditSession(socket, payload.sessionId)) {
      this.logSocketEvent("yjs.update.failed", socket, { sessionId: payload.sessionId, error: "not_authorized" });
      ack?.({ ok: false, error: "not_authorized" });
      return;
    }

    const updatedBy = this.socketAuth(socket)?.actor || payload.updatedBy;
    const update = await this.applyYjsUpdate.execute({ ...payload, updatedBy });

    socket.to(roomName(payload.sessionId)).emit("yjs:update", {
      sessionId: payload.sessionId,
      updateBase64: update.updateBase64,
      updatedBy,
    });
    this.logSocketEvent("yjs.update.succeeded", socket, {
      sessionId: payload.sessionId,
      updatedBy,
    });

    ack?.({
      ok: true,
      sessionId: payload.sessionId,
      yjsStateBase64: update.stateBase64,
    });
  }

  @SubscribeMessage("yjs:state:get")
  async getYjsState(
    @MessageBody() rawPayload: unknown,
    @ConnectedSocket() socket: AuthenticatedSocket,
    @SocketAck() ack?: AckCallback,
  ) {
    if (!this.consumeSocketEvent(socket, "yjs.state.get", ack)) {
      return;
    }

    const result = joinSessionPayloadSchema.pick({ sessionId: true }).safeParse(rawPayload);
    if (!result.success) {
      this.logSocketEvent("yjs.state.get.failed", socket, { error: "invalid_yjs_state_request_payload" });
      ack?.({ ok: false, error: "invalid_yjs_state_request_payload" });
      return;
    }

    if (!this.canAccessSession(socket, result.data.sessionId)) {
      this.logSocketEvent("yjs.state.get.failed", socket, { sessionId: result.data.sessionId, error: "not_authorized" });
      ack?.({ ok: false, error: "not_authorized" });
      return;
    }

    const state = await this.getSessionStateUseCase.execute(result.data.sessionId);
    this.logSocketEvent("yjs.state.get.succeeded", socket, {
      sessionId: result.data.sessionId,
      yjsRevision: state.yjsRevision,
    });
    ack?.({
      ok: true,
      sessionId: result.data.sessionId,
      yjsStateBase64: state.yjsStateBase64,
    });
  }

  @SubscribeMessage("session:snapshot:get")
  async getSnapshot(
    @MessageBody() rawPayload: unknown,
    @ConnectedSocket() socket: AuthenticatedSocket,
    @SocketAck() ack?: AckCallback,
  ) {
    if (!this.consumeSocketEvent(socket, "session.snapshot.get", ack)) {
      return;
    }

    const result = joinSessionPayloadSchema.pick({ sessionId: true }).safeParse(rawPayload);
    if (!result.success) {
      this.logSocketEvent("session.snapshot.get.failed", socket, { error: "invalid_snapshot_request_payload" });
      ack?.({ ok: false, error: "invalid_snapshot_request_payload" });
      return;
    }

    if (!this.canAccessSession(socket, result.data.sessionId)) {
      this.logSocketEvent("session.snapshot.get.failed", socket, { sessionId: result.data.sessionId, error: "not_authorized" });
      ack?.({ ok: false, error: "not_authorized" });
      return;
    }

    const state = await this.getSessionStateUseCase.execute(result.data.sessionId);
    this.logSocketEvent("session.snapshot.get.succeeded", socket, {
      sessionId: result.data.sessionId,
      snapshotRevision: state.snapshotRevision,
    });
    ack?.({
      ok: true,
      sessionId: result.data.sessionId,
      snapshot: state.snapshot,
      revision: state.snapshotRevision,
      status: state.status,
      audit: state.audit,
    });
  }

  @SubscribeMessage("session:inspect")
  async inspectSession(
    @MessageBody() rawPayload: unknown,
    @ConnectedSocket() socket: AuthenticatedSocket,
    @SocketAck() ack?: AckCallback,
  ) {
    if (!this.consumeSocketEvent(socket, "session.inspect", ack)) {
      return;
    }

    const result = inspectSessionPayloadSchema.safeParse(rawPayload);
    if (!result.success) {
      this.logSocketEvent("session.inspect.failed", socket, { error: "invalid_session_inspect_payload" });
      ack?.({ ok: false, error: "invalid_session_inspect_payload" });
      return;
    }

    const { sessionId } = result.data;
    if (!this.canAccessSession(socket, sessionId)) {
      this.logSocketEvent("session.inspect.failed", socket, { sessionId, error: "not_authorized" });
      ack?.({ ok: false, error: "not_authorized" });
      return;
    }

    const state = await this.inspectSessionUseCase.execute(sessionId);
    this.logSocketEvent("session.inspect.succeeded", socket, {
      sessionId,
      status: state.status,
      presenceCount: state.presenceCount,
      snapshotRevision: state.snapshotRevision,
    });

    ack?.({
      ok: true,
      ...state,
      roomName: roomName(sessionId),
    });
  }

  @SubscribeMessage("session:status:update")
  async updateSessionStatus(
    @MessageBody() rawPayload: unknown,
    @ConnectedSocket() socket: AuthenticatedSocket,
    @SocketAck() ack?: AckCallback,
  ) {
    if (!this.consumeSocketEvent(socket, "session.status.update", ack)) {
      return;
    }

    const result = updateSessionStatusPayloadSchema.safeParse(rawPayload);
    if (!result.success) {
      this.logSocketEvent("session.status.update.failed", socket, { error: "invalid_session_status_payload" });
      ack?.({ ok: false, error: "invalid_session_status_payload" });
      return;
    }

    if (!this.canAdminSession(socket, result.data.sessionId)) {
      this.logSocketEvent("session.status.update.failed", socket, { sessionId: result.data.sessionId, error: "not_authorized" });
      ack?.({ ok: false, error: "not_authorized" });
      return;
    }

    const updatedBy = this.socketAuth(socket)?.actor || result.data.updatedBy;
    const updated = await this.updateSessionStatusUseCase.execute({
      sessionId: result.data.sessionId,
      status: result.data.status,
      updatedBy,
    });

    if (!updated.ok) {
      this.logSocketEvent("session.status.update.failed", socket, {
        sessionId: result.data.sessionId,
        error: updated.error,
      });
      ack?.(updated);
      return;
    }

    this.server.to(roomName(result.data.sessionId)).emit("session:status:update", {
      sessionId: result.data.sessionId,
      status: result.data.status,
      audit: updated.session.audit,
    });
    this.logSocketEvent("session.status.update.succeeded", socket, {
      sessionId: result.data.sessionId,
      status: result.data.status,
      updatedBy,
    });

    ack?.({ ok: true, sessionId: result.data.sessionId, status: result.data.status, audit: updated.session.audit });
  }

  @SubscribeMessage("session:close")
  async closeSession(
    @MessageBody() rawPayload: unknown,
    @ConnectedSocket() socket: AuthenticatedSocket,
    @SocketAck() ack?: AckCallback,
  ) {
    if (!this.consumeSocketEvent(socket, "session.close", ack)) {
      return;
    }

    const result = closeSessionPayloadSchema.safeParse(rawPayload);
    if (!result.success) {
      this.logSocketEvent("session.close.failed", socket, { error: "invalid_session_close_payload" });
      ack?.({ ok: false, error: "invalid_session_close_payload" });
      return;
    }

    const { sessionId } = result.data;
    if (!this.canAdminSession(socket, sessionId)) {
      this.logSocketEvent("session.close.failed", socket, { sessionId, error: "not_authorized" });
      ack?.({ ok: false, error: "not_authorized" });
      return;
    }

    const closedBy = this.socketAuth(socket)?.actor || result.data.closedBy;
    const closed = await this.closeSessionUseCase.execute({
      sessionId,
      closedBy,
    });
    if (!closed.ok) {
      this.logSocketEvent("session.close.failed", socket, {
        sessionId,
        error: closed.error,
      });
      ack?.(closed);
      return;
    }

    this.presence.deleteSession(sessionId);
    this.server.to(roomName(sessionId)).emit("session:closed", {
      sessionId,
      closedBy,
    });
    await this.server.in(roomName(sessionId)).socketsLeave(roomName(sessionId));
    this.logSocketEvent("session.close.succeeded", socket, {
      sessionId,
      closedBy,
    });

    ack?.({ ok: true, sessionId, status: closed.session.status, audit: closed.session.audit });
  }

  @SubscribeMessage("client:kick")
  async kickClient(
    @MessageBody() rawPayload: unknown,
    @ConnectedSocket() socket: AuthenticatedSocket,
    @SocketAck() ack?: AckCallback,
  ) {
    if (!this.consumeSocketEvent(socket, "client.kick", ack)) {
      return;
    }

    const result = kickClientPayloadSchema.safeParse(rawPayload);
    if (!result.success) {
      this.logSocketEvent("client.kick.failed", socket, { error: "invalid_client_kick_payload" });
      ack?.({ ok: false, error: "invalid_client_kick_payload" });
      return;
    }

    const { sessionId, socketId } = result.data;
    const kickedBy = this.socketAuth(socket)?.actor || result.data.kickedBy;
    if (!this.canAdminSession(socket, sessionId)) {
      this.logSocketEvent("client.kick.failed", socket, { sessionId, targetSocketId: socketId, error: "not_authorized" });
      ack?.({ ok: false, error: "not_authorized" });
      return;
    }

    const targetPresence = this.presence.getSessionPresence(sessionId)?.get(socketId);

    if (!targetPresence) {
      this.logSocketEvent("client.kick.failed", socket, { sessionId, targetSocketId: socketId, error: "client_not_found" });
      ack?.({ ok: false, error: "client_not_found" });
      return;
    }

    const targetSockets = await this.server.in(socketId).fetchSockets();
    if (targetSockets.length === 0) {
      const removed = await this.removeClientUseCase.execute({ sessionId, socketId, removedBy: kickedBy });
      this.server.to(roomName(sessionId)).emit("presence:update", {
        sessionId,
        presence: this.presence.getPresence(sessionId),
      });
      this.logSocketEvent("client.kick.succeeded", socket, {
        sessionId,
        targetSocketId: socketId,
        kickedBy,
        disconnected: false,
      });
      ack?.(removed.ok ? { ok: true, sessionId, socketId, disconnected: false } : removed);
      return;
    }

    for (const targetSocket of targetSockets) {
      targetSocket.emit("client:kicked", {
        sessionId,
        socketId,
        kickedBy,
      });
      targetSocket.leave(roomName(sessionId));
      targetSocket.disconnect(true);
    }

    const removed = await this.removeClientUseCase.execute({ sessionId, socketId, removedBy: kickedBy });
    if (!removed.ok) {
      this.logSocketEvent("client.kick.failed", socket, { sessionId, targetSocketId: socketId, error: removed.error });
      ack?.(removed);
      return;
    }

    this.server.to(roomName(sessionId)).emit("presence:update", {
      sessionId,
      presence: this.presence.getPresence(sessionId),
    });
    this.logSocketEvent("client.kick.succeeded", socket, {
      sessionId,
      targetSocketId: socketId,
      kickedBy,
      disconnected: true,
    });

    ack?.({ ok: true, sessionId, socketId, disconnected: true });
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    const changedSessions = this.presence.removePresence(socket.id);
    this.logSocketEvent("socket.disconnected", socket, {
      changedSessions,
    });
  }

  private handleDisconnecting(socket: AuthenticatedSocket) {
    const sessionIds = socketSessionIds(socket.rooms);
    this.presence.removePresence(socket.id);

    for (const sessionId of sessionIds) {
      socket.to(roomName(sessionId)).emit("presence:update", {
        sessionId,
        presence: this.presence.getPresence(sessionId),
      });
    }
    this.logSocketEvent("socket.disconnecting", socket, {
      sessionIds,
    });
  }

  private socketAuth(socket: AuthenticatedSocket) {
    return socket.data.auth || null;
  }

  private canAccessSession(socket: AuthenticatedSocket, sessionId: string) {
    const auth = this.socketAuth(socket);

    if (!auth) {
      return SessionAccessPolicy.canAccess(null, sessionId, Boolean(this.config.authSecret));
    }

    return SessionAccessPolicy.canAccess(auth, sessionId, Boolean(this.config.authSecret));
  }

  private canEditSession(socket: AuthenticatedSocket, sessionId: string) {
    const auth = this.socketAuth(socket);

    return SessionAccessPolicy.canEdit(auth, sessionId, Boolean(this.config.authSecret));
  }

  private canAdminSession(socket: AuthenticatedSocket, sessionId: string) {
    const auth = this.socketAuth(socket);

    return SessionAccessPolicy.canAdmin(auth, sessionId, Boolean(this.config.authSecret));
  }

  private consumeSocketEvent(socket: AuthenticatedSocket, event: string, ack?: AckCallback) {
    const decision = this.rateLimits.consumeSocketEvent(socket.id);
    if (decision.allowed) {
      return true;
    }

    this.logSocketEvent(`${event}.rate_limited`, socket, {
      error: "socket_event_rate_limit_exceeded",
      retryAfterSeconds: decision.retryAfterSeconds,
    });
    ack?.({
      ok: false,
      error: "socket_event_rate_limit_exceeded",
      retryAfterSeconds: decision.retryAfterSeconds,
    });
    return false;
  }

  private consumeYjsUpdate(socket: AuthenticatedSocket, ack?: AckCallback) {
    const decision = this.rateLimits.consumeYjsUpdate(socket.id);
    if (decision.allowed) {
      return true;
    }

    this.logSocketEvent("yjs.update.rate_limited", socket, {
      error: "yjs_update_rate_limit_exceeded",
      retryAfterSeconds: decision.retryAfterSeconds,
    });
    ack?.({
      ok: false,
      error: "yjs_update_rate_limit_exceeded",
      retryAfterSeconds: decision.retryAfterSeconds,
    });
    return false;
  }

  private async checkSessionCapacity(socket: AuthenticatedSocket, sessionId: string) {
    const sessionPresence = this.presence.getSessionPresence(sessionId);
    if (!sessionPresence?.has(socket.id) && (sessionPresence?.size || 0) >= this.config.maxClientsPerSession) {
      return { ok: false as const, error: "session_client_limit_exceeded" };
    }

    const existingSession = await this.sessions.getSession(sessionId);
    if (!existingSession && (await this.sessions.countSessions()) >= this.config.maxActiveSessions) {
      return { ok: false as const, error: "active_session_limit_exceeded" };
    }

    return { ok: true as const };
  }

  private socketIpAddress(socket: Socket) {
    const forwardedFor = socket.handshake.headers["x-forwarded-for"];
    if (typeof forwardedFor === "string" && forwardedFor.trim()) {
      return forwardedFor.split(",")[0]?.trim() || "unknown";
    }

    return socket.handshake.address || socket.conn.remoteAddress || "unknown";
  }

  private logSocketEvent(event: string, socket: AuthenticatedSocket, fields: Record<string, unknown> = {}) {
    const auth = this.socketAuth(socket);
    this.logger.info(`collab.realtime.${event}`, {
      socketId: socket.id,
      role: auth?.role || null,
      actor: auth?.role === "server" ? "server" : auth?.actor || null,
      ...fields,
    });
  }
}

import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";

import {
  canvasUpdatePayloadSchema,
  closeSessionPayloadSchema,
  inspectSessionPayloadSchema,
  joinSessionPayloadSchema,
  updateSessionStatusPayloadSchema,
} from "../../application/dtos/collab-schemas.js";
import { GetSessionStateUseCase } from "../../application/use-cases/get-session-state.use-case.js";
import { InspectSessionUseCase } from "../../application/use-cases/inspect-session.use-case.js";
import { RegisterSessionUseCase } from "../../application/use-cases/register-session.use-case.js";
import { UpsertSessionSnapshotUseCase } from "../../application/use-cases/upsert-session-snapshot.use-case.js";
import { UpdateSessionStatusUseCase } from "../../application/use-cases/update-session-status.use-case.js";
import { CloseSessionUseCase } from "../../application/use-cases/close-session.use-case.js";
import { SessionStorePort } from "../../application/ports/session-store.port.js";
import { SessionAccessPolicy } from "../../domain/services/session-access-policy.js";
import { CollabConfigService } from "../../../shared/infrastructure/config/collab-config.service.js";
import { StructuredLoggerService } from "../../../shared/infrastructure/logging/structured-logger.service.js";
import { CollabTicketVerifier, type CollabTicketErrorCode, type CollabTicketPayload } from "../auth/collab-ticket.verifier.js";
import { type CollabHttpRequest, readBearerToken } from "../auth/http-auth.js";
import {
  CloseSessionDto,
  ErrorResponseDto,
  RegisterSessionDto,
  UpdateSessionStateDto,
  UpdateSessionStatusDto,
} from "./dtos/session-http.dto.js";

@ApiTags("Sessions")
@ApiBearerAuth("collab-ticket")
@Controller("sessions")
export class SessionsController {
  constructor(
    @Inject(CollabConfigService)
    private readonly config: CollabConfigService,
    @Inject(StructuredLoggerService)
    private readonly logger: StructuredLoggerService,
    @Inject(CollabTicketVerifier)
    private readonly tickets: CollabTicketVerifier,
    @Inject(SessionStorePort)
    private readonly sessions: SessionStorePort,
    @Inject(GetSessionStateUseCase)
    private readonly getSessionState: GetSessionStateUseCase,
    @Inject(InspectSessionUseCase)
    private readonly inspectSessionUseCase: InspectSessionUseCase,
    @Inject(RegisterSessionUseCase)
    private readonly registerSessionUseCase: RegisterSessionUseCase,
    @Inject(UpsertSessionSnapshotUseCase)
    private readonly upsertSessionSnapshot: UpsertSessionSnapshotUseCase,
    @Inject(UpdateSessionStatusUseCase)
    private readonly updateSessionStatus: UpdateSessionStatusUseCase,
    @Inject(CloseSessionUseCase)
    private readonly closeSessionUseCase: CloseSessionUseCase,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: "Register or initialize a collaboration session." })
  @ApiBody({ type: RegisterSessionDto })
  @ApiResponse({ status: 200, description: "Registered session runtime." })
  async registerSession(@Body() body: RegisterSessionDto, @Req() request: CollabHttpRequest) {
    const authResult = this.readAuth(request);
    if (!authResult.ok) {
      return this.authError("session.register.failed", authResult.error);
    }

    const auth = authResult.payload;
    const result = joinSessionPayloadSchema.safeParse(body);
    if (!result.success) {
      this.logSessionEvent("session.register.failed", { error: "invalid_session_join_payload" });
      return { ok: false, error: "invalid_session_join_payload" };
    }

    if (!SessionAccessPolicy.canAccess(auth, result.data.sessionId, Boolean(this.config.authSecret))) {
      this.logSessionEvent("session.register.failed", { sessionId: result.data.sessionId, error: "not_authorized" });
      return { ok: false, error: "not_authorized" };
    }

    const capacity = await this.checkSessionCapacity(result.data.sessionId);
    if (!capacity.ok) {
      this.logSessionEvent("session.register.failed", { sessionId: result.data.sessionId, error: capacity.error });
      return { ok: false, error: capacity.error };
    }

    const session = await this.registerSessionUseCase.execute(result.data);
    this.logSessionEvent("session.register.succeeded", {
      sessionId: session.sessionId,
      status: session.status || "active",
      snapshotRevision: session.snapshot?.revision || 0,
      yjsRevision: session.yjsRevision || 0,
    });

    return {
      ok: true,
      sessionId: session.sessionId,
      snapshot: session.snapshot,
      status: session.status || "active",
      revision: session.snapshot?.revision || 0,
      yjsStateBase64: session.yjsStateBase64 || null,
      yjsRevision: session.yjsRevision || 0,
      audit: session.audit || [],
    };
  }

  @Get(":sessionId")
  @ApiOperation({ summary: "Inspect a collaboration session." })
  @ApiParam({ name: "sessionId", example: "demo-session" })
  @ApiResponse({ status: 200, description: "Session inspection result." })
  @ApiResponse({ status: 403, type: ErrorResponseDto })
  async inspectSession(@Param("sessionId") sessionId: string, @Req() request: CollabHttpRequest) {
    const authResult = this.readAuth(request);
    if (!authResult.ok) {
      return this.authError("session.inspect.failed", authResult.error, sessionId);
    }

    const auth = authResult.payload;
    const result = inspectSessionPayloadSchema.safeParse({ sessionId });
    if (!result.success) {
      this.logSessionEvent("session.inspect.failed", { error: "invalid_session_inspect_payload" });
      return { ok: false, error: "invalid_session_inspect_payload" };
    }

    if (!SessionAccessPolicy.canAccess(auth, sessionId, Boolean(this.config.authSecret))) {
      this.logSessionEvent("session.inspect.failed", { sessionId, error: "not_authorized" });
      return { ok: false, error: "not_authorized" };
    }

    const state = await this.inspectSessionUseCase.execute(sessionId);
    this.logSessionEvent("session.inspect.succeeded", {
      sessionId,
      status: state.status,
      snapshotRevision: state.snapshotRevision,
      yjsRevision: state.yjsRevision,
      presenceCount: state.presenceCount,
    });

    return {
      ok: true,
      ...state,
      roomName: `session:${sessionId}`,
    };
  }

  @Get(":sessionId/state")
  @ApiOperation({ summary: "Read the persisted session snapshot and Yjs state." })
  @ApiParam({ name: "sessionId", example: "demo-session" })
  @ApiResponse({ status: 200, description: "Session state." })
  async getSessionStateRoute(@Param("sessionId") sessionId: string, @Req() request: CollabHttpRequest) {
    const authResult = this.readAuth(request);
    if (!authResult.ok) {
      return this.authError("session.state.get.failed", authResult.error, sessionId);
    }

    const auth = authResult.payload;
    if (!SessionAccessPolicy.canAccess(auth, sessionId, Boolean(this.config.authSecret))) {
      this.logSessionEvent("session.state.get.failed", { sessionId, error: "not_authorized" });
      return { ok: false, error: "not_authorized" };
    }

    const state = await this.getSessionState.execute(sessionId);
    this.logSessionEvent("session.state.get.succeeded", {
      sessionId,
      status: state.status,
      snapshotRevision: state.snapshotRevision,
      yjsRevision: state.yjsRevision,
    });

    return {
      ok: true,
      ...state,
    };
  }

  @Patch(":sessionId/state")
  @ApiOperation({ summary: "Write a full session snapshot." })
  @ApiParam({ name: "sessionId", example: "demo-session" })
  @ApiBody({ type: UpdateSessionStateDto })
  @ApiResponse({ status: 200, description: "Updated snapshot." })
  async updateSessionState(
    @Param("sessionId") sessionId: string,
    @Body() body: UpdateSessionStateDto,
    @Req() request: CollabHttpRequest,
  ) {
    const authResult = this.readAuth(request);
    if (!authResult.ok) {
      return this.authError("session.state.update.failed", authResult.error, sessionId);
    }

    const auth = authResult.payload;
    if (!SessionAccessPolicy.canEdit(auth, sessionId, Boolean(this.config.authSecret))) {
      this.logSessionEvent("session.state.update.failed", { sessionId, error: "not_authorized" });
      return { ok: false, error: "not_authorized" };
    }

    const result = canvasUpdatePayloadSchema.safeParse({
      sessionId,
      content: body.content,
      updatedBy: body.updatedBy,
      baseRevision: body.baseRevision,
    });
    if (!result.success) {
      this.logSessionEvent("session.state.update.failed", { sessionId, error: "invalid_canvas_update_payload" });
      return { ok: false, error: "invalid_canvas_update_payload" };
    }

    const updated = await this.upsertSessionSnapshot.execute(result.data);
    this.logSessionEvent("session.state.update.succeeded", {
      sessionId,
      updatedBy: result.data.updatedBy,
      snapshotRevision: updated.snapshot.revision,
    });

    return {
      ok: true,
      ...updated,
    };
  }

  @Patch(":sessionId/status")
  @ApiOperation({ summary: "Update a session lifecycle status." })
  @ApiParam({ name: "sessionId", example: "demo-session" })
  @ApiBody({ type: UpdateSessionStatusDto })
  @ApiResponse({ status: 200, description: "Updated status." })
  async updateStatus(
    @Param("sessionId") sessionId: string,
    @Body() body: UpdateSessionStatusDto,
    @Req() request: CollabHttpRequest,
  ) {
    const authResult = this.readAuth(request);
    if (!authResult.ok) {
      return this.authError("session.status.update.failed", authResult.error, sessionId);
    }

    const auth = authResult.payload;
    if (!SessionAccessPolicy.canAdmin(auth, sessionId, Boolean(this.config.authSecret))) {
      this.logSessionEvent("session.status.update.failed", { sessionId, error: "not_authorized" });
      return { ok: false, error: "not_authorized" };
    }

    const result = updateSessionStatusPayloadSchema.safeParse({
      sessionId,
      status: body.status,
      updatedBy: body.updatedBy,
    });
    if (!result.success) {
      this.logSessionEvent("session.status.update.failed", { sessionId, error: "invalid_session_status_payload" });
      return { ok: false, error: "invalid_session_status_payload" };
    }

    const updated = await this.updateSessionStatus.execute(result.data);
    if (!updated.ok) {
      this.logSessionEvent("session.status.update.failed", { sessionId, error: updated.error });
      return updated;
    }
    this.logSessionEvent("session.status.update.succeeded", {
      sessionId,
      status: updated.session.status,
      updatedBy: result.data.updatedBy,
    });

    return {
      ok: true,
      sessionId,
      status: updated.session.status,
      audit: updated.session.audit,
    };
  }

  @Post(":sessionId/close")
  @HttpCode(200)
  @ApiOperation({ summary: "Close a session." })
  @ApiParam({ name: "sessionId", example: "demo-session" })
  @ApiBody({ type: CloseSessionDto })
  @ApiResponse({ status: 200, description: "Closed session." })
  async closeSession(@Param("sessionId") sessionId: string, @Body() body: CloseSessionDto, @Req() request: CollabHttpRequest) {
    const authResult = this.readAuth(request);
    if (!authResult.ok) {
      return this.authError("session.close.failed", authResult.error, sessionId);
    }

    const auth = authResult.payload;
    if (!SessionAccessPolicy.canAdmin(auth, sessionId, Boolean(this.config.authSecret))) {
      this.logSessionEvent("session.close.failed", { sessionId, error: "not_authorized" });
      return { ok: false, error: "not_authorized" };
    }

    const result = closeSessionPayloadSchema.safeParse({
      sessionId,
      closedBy: body.closedBy,
    });
    if (!result.success) {
      this.logSessionEvent("session.close.failed", { sessionId, error: "invalid_session_close_payload" });
      return { ok: false, error: "invalid_session_close_payload" };
    }

    const closed = await this.closeSessionUseCase.execute(result.data);
    if (!closed.ok) {
      this.logSessionEvent("session.close.failed", { sessionId, error: closed.error });
      return closed;
    }
    this.logSessionEvent("session.close.succeeded", {
      sessionId,
      closedBy: result.data.closedBy,
    });

    return {
      ok: true,
      sessionId,
      status: closed.session.status,
      audit: closed.session.audit,
    };
  }

  private readAuth(
    request: CollabHttpRequest,
  ): { ok: true; payload: CollabTicketPayload | null } | { ok: false; error: CollabTicketErrorCode } {
    if (!this.config.authSecret) {
      return { ok: true, payload: null };
    }

    const token = readBearerToken(request);
    const result = this.tickets.verifyDetailed(token, this.config.authSecret);
    if (!result.ok) {
      return result;
    }

    return { ok: true, payload: result.payload };
  }

  private authError(event: string, error: CollabTicketErrorCode, sessionId?: string) {
    this.logSessionEvent(event, { sessionId, error });
    return { ok: false, error };
  }

  private async checkSessionCapacity(sessionId: string) {
    const existingSession = await this.sessions.getSession(sessionId);
    if (!existingSession && (await this.sessions.countSessions()) >= this.config.maxActiveSessions) {
      return { ok: false as const, error: "active_session_limit_exceeded" };
    }

    return { ok: true as const };
  }

  private logSessionEvent(event: string, fields: Record<string, unknown>) {
    this.logger.info(`collab.http.${event}`, fields);
  }
}

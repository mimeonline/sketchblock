import { Controller, ForbiddenException, Get, Inject, Req, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { PresenceStorePort } from "../../application/ports/presence-store.port.js";
import { SessionStorePort } from "../../application/ports/session-store.port.js";
import { CollabConfigService } from "../../../shared/infrastructure/config/collab-config.service.js";
import { CollabRateLimitService } from "../../../shared/infrastructure/security/collab-rate-limit.service.js";
import { GetDatabaseDiagnosticsUseCase } from "../../application/use-cases/get-database-diagnostics.use-case.js";
import { CollabTicketVerifier } from "../auth/collab-ticket.verifier.js";
import { type CollabHttpRequest, readBearerToken } from "../auth/http-auth.js";

@ApiTags("Health")
@Controller()
export class HealthController {
  constructor(
    @Inject(CollabConfigService)
    private readonly config: CollabConfigService,
    @Inject(CollabRateLimitService)
    private readonly rateLimits: CollabRateLimitService,
    @Inject(PresenceStorePort)
    private readonly presence: PresenceStorePort,
    @Inject(SessionStorePort)
    private readonly sessions: SessionStorePort,
    @Inject(CollabTicketVerifier)
    private readonly tickets: CollabTicketVerifier,
    @Inject(GetDatabaseDiagnosticsUseCase)
    private readonly databaseDiagnostics: GetDatabaseDiagnosticsUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: "Read collab server health." })
  @ApiResponse({ status: 200, description: "Collab server is reachable." })
  getHealth() {
    return {
      service: "sketchblock-collab-server",
      status: "ok",
      transport: "socket.io",
    };
  }

  @Get("health")
  @ApiOperation({ summary: "Read collab server health." })
  @ApiResponse({ status: 200, description: "Collab server is reachable." })
  getHealthAlias() {
    return this.getHealth();
  }

  @Get("metrics")
  @ApiOperation({ summary: "Read collab server runtime metrics." })
  @ApiResponse({ status: 200, description: "Collab server runtime metrics." })
  async getMetrics() {
    const persistedSessions = await this.sessions.countSessions();

    return {
      service: "sketchblock-collab-server",
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      sessions: {
        persisted: persistedSessions,
        activePresenceSessions: this.presence.countActiveSessions(),
        connectedClients: this.presence.countConnectedClients(),
        maxActiveSessions: this.config.maxActiveSessions,
        maxClientsPerSession: this.config.maxClientsPerSession,
      },
      limits: {
        httpRequestsPerIpPerMinute: this.config.httpRequestsPerIpPerMinute,
        socketConnectsPerIpPerMinute: this.config.socketConnectsPerIpPerMinute,
        socketEventsPerSocketPerMinute: this.config.socketEventsPerSocketPerMinute,
        yjsUpdatesPerSocketPerMinute: this.config.yjsUpdatesPerSocketPerMinute,
        rateLimitState: this.rateLimits.snapshot(),
      },
      config: {
        allowedOrigins: this.config.allowedOrigins,
        socketAuth: this.config.authSecret ? "enabled" : "disabled",
        logLevel: this.config.logLevel,
        logFormat: this.config.logFormat,
      },
    };
  }

  @Get("internal/diagnostics")
  @ApiBearerAuth("collab-ticket")
  @ApiOperation({ summary: "Read secret-free internal collab diagnostics." })
  @ApiResponse({ status: 200, description: "Secret-free database diagnostics." })
  @ApiResponse({ status: 401, description: "Valid server ticket required." })
  async getInternalDiagnostics(@Req() request: CollabHttpRequest) {
    if (!this.config.authSecret) {
      throw new ServiceUnavailableException({ error: "collab_auth_not_configured" });
    }
    const result = this.tickets.verifyDetailed(readBearerToken(request), this.config.authSecret);
    if (!result.ok) {
      throw new UnauthorizedException({ error: result.error });
    }
    if (result.payload.role !== "server" || result.payload.permission !== "admin") {
      throw new ForbiddenException({ error: "server_admin_ticket_required" });
    }
    return {
      ok: true,
      service: "sketchblock-collab-server",
      database: await this.databaseDiagnostics.execute(),
    };
  }
}

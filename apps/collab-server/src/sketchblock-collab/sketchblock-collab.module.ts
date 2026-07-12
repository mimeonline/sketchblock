import { Module } from "@nestjs/common";

import { PresenceStorePort } from "./application/ports/presence-store.port.js";
import { SessionStorePort } from "./application/ports/session-store.port.js";
import { YjsDocumentRegistryPort } from "./application/ports/yjs-document-registry.port.js";
import { DatabaseDiagnosticsPort } from "./application/ports/database-diagnostics.port.js";
import { ApplyYjsUpdateUseCase } from "./application/use-cases/apply-yjs-update.use-case.js";
import { CloseSessionUseCase } from "./application/use-cases/close-session.use-case.js";
import { GetSessionStateUseCase } from "./application/use-cases/get-session-state.use-case.js";
import { InspectSessionUseCase } from "./application/use-cases/inspect-session.use-case.js";
import { RegisterSessionUseCase } from "./application/use-cases/register-session.use-case.js";
import { RemoveClientUseCase } from "./application/use-cases/remove-client.use-case.js";
import { UpdateSessionStatusUseCase } from "./application/use-cases/update-session-status.use-case.js";
import { UpsertSessionSnapshotUseCase } from "./application/use-cases/upsert-session-snapshot.use-case.js";
import { GetDatabaseDiagnosticsUseCase } from "./application/use-cases/get-database-diagnostics.use-case.js";
import { CollabConfigService } from "../shared/infrastructure/config/collab-config.service.js";
import { StructuredLoggerService } from "../shared/infrastructure/logging/structured-logger.service.js";
import { CollabTicketVerifier } from "./infrastructure/auth/collab-ticket.verifier.js";
import { HealthController } from "./infrastructure/http/health.controller.js";
import { SessionsController } from "./infrastructure/http/sessions.controller.js";
import { PostgresSessionStore } from "./infrastructure/persistence/postgres-session.store.js";
import { PostgresDatabaseDiagnosticsAdapter } from "./infrastructure/persistence/postgres-database-diagnostics.adapter.js";
import { YjsDocumentRegistry } from "./infrastructure/persistence/yjs-document.registry.js";
import { PresenceRegistry } from "./infrastructure/realtime/presence.registry.js";
import { RealtimeGateway } from "./infrastructure/realtime/realtime.gateway.js";

@Module({
  controllers: [HealthController, SessionsController],
  providers: [
    CollabConfigService,
    CollabTicketVerifier,
    ApplyYjsUpdateUseCase,
    CloseSessionUseCase,
    GetSessionStateUseCase,
    GetDatabaseDiagnosticsUseCase,
    InspectSessionUseCase,
    RegisterSessionUseCase,
    RemoveClientUseCase,
    RealtimeGateway,
    UpdateSessionStatusUseCase,
    UpsertSessionSnapshotUseCase,
    {
      provide: DatabaseDiagnosticsPort,
      useFactory: (config: CollabConfigService) => new PostgresDatabaseDiagnosticsAdapter(config),
      inject: [CollabConfigService],
    },
    {
      provide: PresenceStorePort,
      useClass: PresenceRegistry,
    },
    {
      provide: SessionStorePort,
      useFactory: (config: CollabConfigService, logger: StructuredLoggerService) =>
        new PostgresSessionStore(config, logger),
      inject: [CollabConfigService, StructuredLoggerService],
    },
    {
      provide: YjsDocumentRegistryPort,
      useClass: YjsDocumentRegistry,
    },
  ],
})
export class SketchblockCollabModule {}

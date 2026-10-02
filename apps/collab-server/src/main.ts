import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module.js";
import { CollabConfigService } from "./shared/infrastructure/config/collab-config.service.js";
import { configureOpenApi } from "./shared/infrastructure/http/configure-open-api.js";
import { configureHttpBodyParser } from "./shared/infrastructure/http/configure-http-body-parser.js";
import { StructuredLoggerService } from "./shared/infrastructure/logging/structured-logger.service.js";
import { ConfiguredSocketIoAdapter } from "./shared/infrastructure/realtime/configured-socket-io.adapter.js";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, bufferLogs: true });
  const config = app.get(CollabConfigService);
  const logger = app.get(StructuredLoggerService);

  app.useLogger(logger);

  configureHttpBodyParser(app, config.maxSnapshotBytes);
  app.useWebSocketAdapter(new ConfiguredSocketIoAdapter(app, config));
  configureOpenApi(app, config.exposeApiDocs);

  await app.listen(config.port);

  logger.info("collab.server.started", {
    port: config.port,
    allowedOrigins: config.allowedOrigins,
    persistence: config.persistenceDriver,
    socketAuth: config.authSecret ? "enabled" : "disabled",
    logLevel: config.logLevel,
    logFormat: config.logFormat,
    maxSnapshotBytes: config.maxSnapshotBytes,
    maxYjsDocumentBytes: config.maxYjsDocumentBytes,
    apiDocs: config.exposeApiDocs ? "enabled" : "disabled",
    maxClientsPerSession: config.maxClientsPerSession,
    maxActiveSessions: config.maxActiveSessions,
    httpRequestsPerIpPerMinute: config.httpRequestsPerIpPerMinute,
    socketConnectsPerIpPerMinute: config.socketConnectsPerIpPerMinute,
    socketEventsPerSocketPerMinute: config.socketEventsPerSocketPerMinute,
    yjsUpdatesPerSocketPerMinute: config.yjsUpdatesPerSocketPerMinute,
  });
}

void bootstrap();

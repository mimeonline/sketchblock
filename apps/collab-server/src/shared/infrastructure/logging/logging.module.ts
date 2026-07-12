import { Global, Module } from "@nestjs/common";

import { CollabConfigService } from "../config/collab-config.service.js";
import { HttpRequestLoggingMiddleware } from "./http-request-logging.middleware.js";
import { StructuredLoggerService } from "./structured-logger.service.js";

@Global()
@Module({
  providers: [CollabConfigService, StructuredLoggerService, HttpRequestLoggingMiddleware],
  exports: [StructuredLoggerService, HttpRequestLoggingMiddleware],
})
export class LoggingModule {}

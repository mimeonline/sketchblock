import { Global, Module } from "@nestjs/common";

import { CollabConfigService } from "../config/collab-config.service.js";
import { LoggingModule } from "../logging/logging.module.js";
import { CollabRateLimitService } from "./collab-rate-limit.service.js";
import { HttpRateLimitMiddleware } from "./http-rate-limit.middleware.js";

@Global()
@Module({
  imports: [LoggingModule],
  providers: [CollabConfigService, CollabRateLimitService, HttpRateLimitMiddleware],
  exports: [CollabRateLimitService, HttpRateLimitMiddleware],
})
export class SecurityModule {}

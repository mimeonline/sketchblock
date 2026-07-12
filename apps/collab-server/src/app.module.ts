import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";

import { SketchblockCollabModule } from "./sketchblock-collab/sketchblock-collab.module.js";
import { CollabConfigService } from "./shared/infrastructure/config/collab-config.service.js";
import { HttpRequestLoggingMiddleware } from "./shared/infrastructure/logging/http-request-logging.middleware.js";
import { LoggingModule } from "./shared/infrastructure/logging/logging.module.js";
import { HttpRateLimitMiddleware } from "./shared/infrastructure/security/http-rate-limit.middleware.js";
import { SecurityModule } from "./shared/infrastructure/security/security.module.js";

@Module({
  imports: [LoggingModule, SecurityModule, SketchblockCollabModule],
  providers: [CollabConfigService],
  exports: [CollabConfigService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpRateLimitMiddleware, HttpRequestLoggingMiddleware).forRoutes("*");
  }
}

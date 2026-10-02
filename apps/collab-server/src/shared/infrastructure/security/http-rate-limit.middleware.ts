import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";

import { CollabConfigService } from "../config/collab-config.service.js";
import { resolveClientIp } from "./client-ip.js";
import { CollabRateLimitService } from "./collab-rate-limit.service.js";
import { StructuredLoggerService } from "../logging/structured-logger.service.js";

type HeaderValue = string | string[] | undefined;
type RequestLike = {
  ip?: string;
  headers?: Record<string, HeaderValue>;
  socket?: {
    remoteAddress?: string;
  };
};
type ResponseLike = {
  statusCode?: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};
type NextFunction = () => void;

@Injectable()
export class HttpRateLimitMiddleware implements NestMiddleware {
  constructor(
    @Inject(CollabRateLimitService) private readonly rateLimits: CollabRateLimitService,
    @Inject(StructuredLoggerService) private readonly logger: StructuredLoggerService,
    @Inject(CollabConfigService) private readonly config: CollabConfigService,
  ) {}

  use(request: RequestLike, response: ResponseLike, next: NextFunction) {
    const ipAddress = this.readClientIp(request);
    const decision = this.rateLimits.consumeHttpRequest(ipAddress);

    response.setHeader("x-ratelimit-limit", String(decision.limit));
    response.setHeader("x-ratelimit-remaining", String(decision.remaining));

    if (!decision.allowed) {
      response.statusCode = 429;
      response.setHeader("retry-after", String(decision.retryAfterSeconds));
      response.setHeader("content-type", "application/json; charset=utf-8");
      this.logger.warnEvent("collab.security.http.rate_limited", {
        ipAddress,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
      response.end(
        JSON.stringify({
          ok: false,
          error: "rate_limit_exceeded",
          retryAfterSeconds: decision.retryAfterSeconds,
        }),
      );
      return;
    }

    next();
  }

  private readClientIp(request: RequestLike) {
    return resolveClientIp({
      forwardedFor: request.headers?.["x-forwarded-for"],
      remoteAddress: request.ip || request.socket?.remoteAddress,
      trustProxy: this.config.trustProxy,
    });
  }
}

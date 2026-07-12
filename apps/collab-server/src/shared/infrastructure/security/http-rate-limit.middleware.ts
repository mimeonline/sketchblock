import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";

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
    const forwardedFor = this.readHeader(request.headers?.["x-forwarded-for"]);
    if (forwardedFor) {
      return forwardedFor.split(",")[0]?.trim() || "unknown";
    }

    return request.ip || request.socket?.remoteAddress || "unknown";
  }

  private readHeader(value: HeaderValue) {
    if (Array.isArray(value)) {
      return value[0] || null;
    }

    return value || null;
  }
}

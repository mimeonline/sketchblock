import { randomUUID } from "node:crypto";

import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";

import { StructuredLoggerService } from "./structured-logger.service.js";

type HeaderValue = string | string[] | undefined;
type RequestLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers?: Record<string, HeaderValue>;
  socket?: {
    remoteAddress?: string;
  };
};
type ResponseLike = {
  statusCode?: number;
  on(event: "finish", listener: () => void): void;
  setHeader(name: string, value: string): void;
};
type NextFunction = () => void;

@Injectable()
export class HttpRequestLoggingMiddleware implements NestMiddleware {
  constructor(@Inject(StructuredLoggerService) private readonly logger: StructuredLoggerService) {}

  use(request: RequestLike, response: ResponseLike, next: NextFunction) {
    const startedAt = Date.now();
    const requestId = this.readRequestId(request.headers?.["x-request-id"]) || randomUUID();

    response.setHeader("x-request-id", requestId);
    response.on("finish", () => {
      this.logger.info("collab.http.request", {
        requestId,
        method: request.method || "UNKNOWN",
        path: request.originalUrl || request.url || "/",
        statusCode: response.statusCode || 0,
        durationMs: Date.now() - startedAt,
        remoteAddress: request.ip || request.socket?.remoteAddress || null,
      });
    });

    next();
  }

  private readRequestId(value: HeaderValue) {
    if (Array.isArray(value)) {
      return value[0] || null;
    }

    return value || null;
  }
}

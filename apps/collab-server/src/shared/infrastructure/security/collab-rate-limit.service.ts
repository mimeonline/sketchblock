import { Inject, Injectable } from "@nestjs/common";

import { CollabConfigService } from "../config/collab-config.service.js";
import { FixedWindowRateLimiter } from "./fixed-window-rate-limiter.js";

const oneMinuteMs = 60_000;

@Injectable()
export class CollabRateLimitService {
  private readonly httpRequests: FixedWindowRateLimiter;
  private readonly socketConnects: FixedWindowRateLimiter;
  private readonly socketEvents: FixedWindowRateLimiter;
  private readonly yjsUpdates: FixedWindowRateLimiter;

  constructor(@Inject(CollabConfigService) private readonly config: CollabConfigService) {
    this.httpRequests = new FixedWindowRateLimiter(config.httpRequestsPerIpPerMinute, oneMinuteMs);
    this.socketConnects = new FixedWindowRateLimiter(config.socketConnectsPerIpPerMinute, oneMinuteMs);
    this.socketEvents = new FixedWindowRateLimiter(config.socketEventsPerSocketPerMinute, oneMinuteMs);
    this.yjsUpdates = new FixedWindowRateLimiter(config.yjsUpdatesPerSocketPerMinute, oneMinuteMs);
  }

  consumeHttpRequest(ipAddress: string) {
    return this.httpRequests.consume(ipAddress);
  }

  consumeSocketConnect(ipAddress: string) {
    return this.socketConnects.consume(ipAddress);
  }

  consumeSocketEvent(socketId: string) {
    return this.socketEvents.consume(socketId);
  }

  consumeYjsUpdate(socketId: string) {
    return this.yjsUpdates.consume(socketId);
  }

  snapshot() {
    return {
      httpRequests: this.httpRequests.snapshot(),
      socketConnects: this.socketConnects.snapshot(),
      socketEvents: this.socketEvents.snapshot(),
      yjsUpdates: this.yjsUpdates.snapshot(),
    };
  }
}

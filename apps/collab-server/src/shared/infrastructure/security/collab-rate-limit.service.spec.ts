import { describe, expect, it } from "vitest";

import type { CollabConfigService } from "../config/collab-config.service.js";
import { CollabRateLimitService } from "./collab-rate-limit.service.js";

function createRateLimits() {
  const config = {
    httpRequestsPerIpPerMinute: 2,
    socketConnectsPerIpPerMinute: 2,
    socketEventsPerSocketPerMinute: 2,
    yjsUpdatesPerSocketPerMinute: 3,
  } as CollabConfigService;

  return new CollabRateLimitService(config);
}

describe("CollabRateLimitService", () => {
  it("keeps high-frequency Yjs updates out of the command event bucket", () => {
    const limits = createRateLimits();

    expect(limits.consumeSocketEvent("socket-1").allowed).toBe(true);
    expect(limits.consumeSocketEvent("socket-1").allowed).toBe(true);
    expect(limits.consumeSocketEvent("socket-1").allowed).toBe(false);

    expect(limits.consumeYjsUpdate("socket-1").allowed).toBe(true);
    expect(limits.consumeYjsUpdate("socket-1").allowed).toBe(true);
    expect(limits.consumeYjsUpdate("socket-1").allowed).toBe(true);
    expect(limits.consumeYjsUpdate("socket-1").allowed).toBe(false);
  });
});

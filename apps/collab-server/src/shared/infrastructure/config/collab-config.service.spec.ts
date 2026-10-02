import { afterEach, describe, expect, it, vi } from "vitest";

import { CollabConfigService } from "./collab-config.service.js";

describe("CollabConfigService trustProxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to false", () => {
    vi.stubEnv("COLLAB_TRUST_PROXY", "");
    expect(new CollabConfigService().trustProxy).toBe(false);
  });

  it("accepts true and 1", () => {
    vi.stubEnv("COLLAB_TRUST_PROXY", "true");
    expect(new CollabConfigService().trustProxy).toBe(true);
    vi.stubEnv("COLLAB_TRUST_PROXY", "1");
    expect(new CollabConfigService().trustProxy).toBe(true);
    vi.stubEnv("COLLAB_TRUST_PROXY", "no");
    expect(new CollabConfigService().trustProxy).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CollabConfigService } from "./collab-config.service.js";

describe("CollabConfigService trustProxy", () => {
  beforeEach(() => vi.stubEnv("COLLAB_AUTH_SECRET", "test-collab-secret"));
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

describe("CollabConfigService authSecret", () => {
  beforeEach(() => {
    vi.stubEnv("COLLAB_AUTH_SECRET", "");
    vi.stubEnv("APP_AUTH_SECRET", "");
    vi.stubEnv("COLLAB_ALLOW_INSECURE_NO_AUTH", "");
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "");
    vi.stubEnv("NODE_ENV", "test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("refuses to start without a secret", () => {
    expect(() => new CollabConfigService()).toThrow(/COLLAB_AUTH_SECRET/);
  });

  it("allows no auth only with the explicit opt-in outside production", () => {
    vi.stubEnv("COLLAB_ALLOW_INSECURE_NO_AUTH", "true");
    expect(new CollabConfigService().authSecret).toBeNull();

    vi.stubEnv("NODE_ENV", "production");
    expect(() => new CollabConfigService()).toThrow(/COLLAB_AUTH_SECRET/);
  });

  it("prefers COLLAB_AUTH_SECRET over APP_AUTH_SECRET", () => {
    vi.stubEnv("APP_AUTH_SECRET", "app-secret");
    expect(new CollabConfigService().authSecret).toBe("app-secret");
    vi.stubEnv("COLLAB_AUTH_SECRET", "collab-secret");
    expect(new CollabConfigService().authSecret).toBe("collab-secret");
  });

  it("rejects placeholder and short secrets in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COLLAB_AUTH_SECRET", "local-compose-auth-secret-CHANGE-ME-please");
    expect(() => new CollabConfigService()).toThrow(/too weak/);
    vi.stubEnv("COLLAB_AUTH_SECRET", "short-secret");
    expect(() => new CollabConfigService()).toThrow(/too weak/);
    vi.stubEnv("COLLAB_AUTH_SECRET", "x".repeat(40));
    expect(new CollabConfigService().authSecret).toBe("x".repeat(40));
  });
});

describe("CollabConfigService deployment environment", () => {
  beforeEach(() => {
    vi.stubEnv("COLLAB_AUTH_SECRET", "local-compose-auth-secret-CHANGE-ME-please");
    vi.stubEnv("APP_AUTH_SECRET", "");
    vi.stubEnv("COLLAB_ALLOW_INSECURE_NO_AUTH", "");
    vi.stubEnv("COLLAB_ALLOWED_ORIGINS", "");
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("lets SKETCHBLOCK_DEPLOYMENT_ENV=local override NODE_ENV=production (compose)", () => {
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "local");
    vi.stubEnv("COLLAB_ALLOWED_ORIGINS", "*");
    const config = new CollabConfigService();
    expect(config.isProduction).toBe(false);
    expect(config.authSecret).toContain("CHANGE-ME");
  });

  it("treats SKETCHBLOCK_DEPLOYMENT_ENV=production as production even with NODE_ENV=test", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "production");
    expect(() => new CollabConfigService()).toThrow(/too weak/);
  });

  it("falls back to NODE_ENV and rejects invalid values", () => {
    expect(() => new CollabConfigService()).toThrow(/too weak/);
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "staging");
    expect(() => new CollabConfigService()).toThrow(/SKETCHBLOCK_DEPLOYMENT_ENV/);
  });
});

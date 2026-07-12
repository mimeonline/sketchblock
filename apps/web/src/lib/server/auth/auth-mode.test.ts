import { afterEach, describe, expect, it, vi } from "vitest";

import { assertSessionRoleAllowed } from "./permissions";
import { getDevAuthUser, getSketchblockAuthMode } from "./auth-mode";

describe("sketchblock auth mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses dev auth by default in local development", () => {
    vi.stubEnv("SKETCHBLOCK_AUTH_MODE", "");
    vi.stubEnv("NODE_ENV", "development");

    expect(getSketchblockAuthMode()).toBe("dev");
  });

  it("uses GitHub auth by default in production", () => {
    vi.stubEnv("SKETCHBLOCK_AUTH_MODE", "");
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");

    expect(getSketchblockAuthMode()).toBe("github");
  });

  it("creates a local admin dev user", () => {
    vi.stubEnv("SKETCHBLOCK_AUTH_MODE", "dev");
    vi.stubEnv("NODE_ENV", "development");

    const user = getDevAuthUser();

    expect(user.login).toBe("local-dev");
    expect(user.permission).toBe("admin");
    expect(() => assertSessionRoleAllowed(user.permission, "owner")).not.toThrow();
  });

  it("allows explicit local dev user values", () => {
    vi.stubEnv("SKETCHBLOCK_AUTH_MODE", "dev");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SKETCHBLOCK_DEV_USER_LOGIN", "micha-dev");
    vi.stubEnv("SKETCHBLOCK_DEV_USER_NAME", "Micha Dev");
    vi.stubEnv("SKETCHBLOCK_DEV_USER_PERMISSION", "write");

    expect(getDevAuthUser()).toMatchObject({
      login: "micha-dev",
      name: "Micha Dev",
      permission: "write",
    });
  });

  it("allows dev auth for local compose when Next.js runs in production mode", () => {
    vi.stubEnv("SKETCHBLOCK_AUTH_MODE", "dev");
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "local");
    vi.stubEnv("NODE_ENV", "production");

    expect(getSketchblockAuthMode()).toBe("dev");
  });

  it("provides an isolated demo identity in local deployments", () => {
    vi.stubEnv("SKETCHBLOCK_AUTH_MODE", "demo");
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "local");
    vi.stubEnv("NODE_ENV", "production");

    expect(getSketchblockAuthMode()).toBe("demo");
    expect(getDevAuthUser()).toMatchObject({ login: "demo", name: "Demo User" });
  });

  it("rejects dev auth in production", () => {
    vi.stubEnv("SKETCHBLOCK_AUTH_MODE", "dev");
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getSketchblockAuthMode()).toThrow("SKETCHBLOCK_AUTH_MODE=dev is not allowed");
  });

  it("rejects demo auth in production", () => {
    vi.stubEnv("SKETCHBLOCK_AUTH_MODE", "demo");
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "production");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => getSketchblockAuthMode()).toThrow("SKETCHBLOCK_AUTH_MODE=demo is not allowed");
  });

  it("rejects invalid dev permissions", () => {
    vi.stubEnv("SKETCHBLOCK_AUTH_MODE", "dev");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SKETCHBLOCK_DEV_USER_PERMISSION", "owner");

    expect(() => getDevAuthUser()).toThrow("Invalid SKETCHBLOCK_DEV_USER_PERMISSION");
  });
});

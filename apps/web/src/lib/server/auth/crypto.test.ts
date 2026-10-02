import { afterEach, describe, expect, it, vi } from "vitest";

import { decryptSecret, encryptSecret, signPayload, verifySignedPayload } from "./crypto";

describe("encrypted auth secrets", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts and decrypts a GitHub access token", () => {
    vi.stubEnv("APP_AUTH_SECRET", "a-long-local-auth-secret-for-tests");

    const encrypted = encryptSecret("gho_test_access_token");

    expect(encrypted).not.toContain("gho_test_access_token");
    expect(decryptSecret(encrypted)).toBe("gho_test_access_token");
  });

  it("rejects a modified encrypted value", () => {
    vi.stubEnv("APP_AUTH_SECRET", "a-long-local-auth-secret-for-tests");
    const encrypted = encryptSecret("gho_test_access_token");
    const parts = encrypted.split(".");
    parts[2] = `${parts[2]?.startsWith("a") ? "b" : "a"}${parts[2]?.slice(1)}`;
    const modified = parts.join(".");

    expect(decryptSecret(modified)).toBeNull();
  });

  it("binds signed payloads to their purpose", () => {
    vi.stubEnv("APP_AUTH_SECRET", "a-long-local-auth-secret-for-tests");
    const token = signPayload({ id: 1 }, "collab-ticket");

    expect(verifySignedPayload(token, "collab-ticket")).toEqual({ id: 1 });
    expect(verifySignedPayload(token, "participant-auth")).toBeNull();
    expect(verifySignedPayload(token, "owner-auth")).toBeNull();
  });

  it("signs collab tickets with COLLAB_AUTH_SECRET when set", () => {
    vi.stubEnv("APP_AUTH_SECRET", "a-long-local-auth-secret-for-tests");
    vi.stubEnv("COLLAB_AUTH_SECRET", "a-separate-collab-secret-for-tests");
    const token = signPayload({ id: 1 }, "collab-ticket");

    vi.stubEnv("COLLAB_AUTH_SECRET", "");
    expect(verifySignedPayload(token, "collab-ticket")).toBeNull();
  });

  it("rejects placeholder or short secrets in production", () => {
    vi.stubEnv("SKETCHBLOCK_DEPLOYMENT_ENV", "production");
    vi.stubEnv("APP_AUTH_SECRET", "local-compose-auth-secret-change-me");
    expect(() => signPayload({ id: 1 }, "owner-auth")).toThrow(/too weak/);

    vi.stubEnv("APP_AUTH_SECRET", "x".repeat(28));
    expect(() => signPayload({ id: 1 }, "owner-auth")).toThrow(/too weak/);

    vi.stubEnv("APP_AUTH_SECRET", "x".repeat(40));
    expect(() => signPayload({ id: 1 }, "owner-auth")).not.toThrow();

    vi.stubEnv("COLLAB_AUTH_SECRET", "short-collab-secret-value-1234");
    expect(() => signPayload({ id: 1 }, "collab-ticket")).toThrow(/COLLAB_AUTH_SECRET/);
  });
});

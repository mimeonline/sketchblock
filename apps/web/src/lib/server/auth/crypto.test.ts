import { afterEach, describe, expect, it, vi } from "vitest";

import { decryptSecret, encryptSecret } from "./crypto";

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
});

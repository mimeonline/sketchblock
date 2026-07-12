import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("local owner password storage", () => {
  it("hashes with scrypt, verifies the password and rejects a different password", async () => {
    const hash = await hashPassword("a-long-local-owner-password");

    expect(hash.startsWith("scrypt$131072$8$1$")).toBe(true);
    await expect(verifyPassword("a-long-local-owner-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("a-different-password", hash)).resolves.toBe(false);
  });

  it("rejects malformed hashes", async () => {
    await expect(verifyPassword("password", "sha256$broken")).resolves.toBe(false);
  });
});

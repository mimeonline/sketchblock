import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("local owner password storage", () => {
  it("hashes with scrypt, verifies the password and rejects a different password", async () => {
    const hash = await hashPassword("a-long-local-owner-password");

    expect(hash.startsWith("scrypt$131072$8$1$")).toBe(true);
    await expect(verifyPassword("a-long-local-owner-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("a-different-password", hash)).resolves.toBe(false);
  }, 30_000);

  it("rejects malformed hashes", async () => {
    await expect(verifyPassword("password", "sha256$broken")).resolves.toBe(false);
  });
});

describe("password hashing concurrency", () => {
  it("limits concurrent derivations to 2 and rejects when the queue is full", async () => {
    const { __passwordSemaphoreForTests: sem, PasswordHashBusyError } = await import("./password");
    let running = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const task = () =>
      new Promise<void>((resolve) => {
        running += 1;
        peak = Math.max(peak, running);
        releases.push(() => {
          running -= 1;
          resolve();
        });
      });
    const all = Array.from({ length: 34 }, () => sem.run(task));
    await new Promise((r) => setTimeout(r, 0));
    expect(running).toBe(2);
    await expect(sem.run(task)).rejects.toBeInstanceOf(PasswordHashBusyError);
    while (releases.length) {
      releases.shift()!();
      await new Promise((r) => setTimeout(r, 0));
    }
    await Promise.all(all);
    expect(peak).toBe(2);
  });

  it("verifies against the dummy hash and returns false", async () => {
    const { verifyPasswordAgainstDummy } = await import("./password");
    await expect(verifyPasswordAgainstDummy("anything")).resolves.toBe(false);
  }, 30_000);
});

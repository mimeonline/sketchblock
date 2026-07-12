import { describe, expect, it } from "vitest";

import { hashUserSessionToken } from "./user-session-store";

describe("User-Session-Identifier", () => {
  it("persistiert nur einen stabilen Einweg-Hash des geheimen Tokens", () => {
    const token = "ein-langes-zufaelliges-session-token";
    const hash = hashUserSessionToken(token);

    expect(hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).not.toContain(token);
    expect(hashUserSessionToken(token)).toBe(hash);
    expect(hashUserSessionToken(`${token}-anders`)).not.toBe(hash);
  });
});

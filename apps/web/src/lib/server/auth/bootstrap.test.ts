import { afterEach, describe, expect, it, vi } from "vitest";

import { getBootstrapTokenStatus, verifyBootstrapToken } from "./bootstrap";

describe("first-run bootstrap token", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("requires a sufficiently long configured token", () => {
    vi.stubEnv("SKETCHBLOCK_BOOTSTRAP_TOKEN", "short");
    expect(getBootstrapTokenStatus().configured).toBe(false);
    expect(verifyBootstrapToken("short")).toBe(false);
  });

  it("accepts only the exact configured token", () => {
    const token = "0123456789abcdef0123456789abcdef";
    vi.stubEnv("SKETCHBLOCK_BOOTSTRAP_TOKEN", token);
    expect(getBootstrapTokenStatus().configured).toBe(true);
    expect(verifyBootstrapToken(token)).toBe(true);
    expect(verifyBootstrapToken(`${token}x`)).toBe(false);
  });

  it("generates a usable runtime token when no token is configured", () => {
    vi.stubEnv("SKETCHBLOCK_BOOTSTRAP_TOKEN", "");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(getBootstrapTokenStatus()).toMatchObject({ configured: true, generated: true });
    expect(warning).toHaveBeenCalledTimes(1);

    warning.mockRestore();
  });
});

import { describe, expect, it } from "vitest";

import { resolveClientIp } from "./client-ip.js";

describe("resolveClientIp", () => {
  it("ignores X-Forwarded-For without trust proxy", () => {
    expect(resolveClientIp({ forwardedFor: "1.2.3.4", remoteAddress: "10.0.0.1", trustProxy: false })).toBe("10.0.0.1");
  });

  it("honors the first X-Forwarded-For entry with trust proxy", () => {
    expect(resolveClientIp({ forwardedFor: "1.2.3.4, 5.6.7.8", remoteAddress: "10.0.0.1", trustProxy: true })).toBe("1.2.3.4");
  });

  it("falls back to the remote address or unknown", () => {
    expect(resolveClientIp({ forwardedFor: null, remoteAddress: "10.0.0.1", trustProxy: true })).toBe("10.0.0.1");
    expect(resolveClientIp({ trustProxy: false })).toBe("unknown");
  });
});

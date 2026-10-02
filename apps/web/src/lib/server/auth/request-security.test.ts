import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getClientAddress } from "./request-security";

const request = (headers: Record<string, string>) => ({ headers: new Headers(headers) });

describe("getClientAddress", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("ignores forwarding headers without SKETCHBLOCK_TRUST_PROXY", () => {
    expect(getClientAddress(request({ "x-forwarded-for": "1.2.3.4" }))).toBe("direct");
  });

  it("honors forwarding headers when the proxy is trusted", () => {
    vi.stubEnv("SKETCHBLOCK_TRUST_PROXY", "true");
    expect(getClientAddress(request({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(getClientAddress(request({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(getClientAddress(request({}))).toBe("direct");
  });
});

describe("rejectCrossOriginRequest", () => {
  it("accepts same-origin requests and rejects missing or foreign origins", async () => {
    const { rejectCrossOriginRequest } = await import("./request-security");
    const base = process.env.APP_BASE_URL || "http://localhost:4512";
    expect(rejectCrossOriginRequest(new Request(`${base}/api/x`, { method: "POST", headers: { origin: base } }))).toBeNull();
    expect(rejectCrossOriginRequest(new Request(`${base}/api/x`, { method: "POST" }))?.status).toBe(403);
    expect(rejectCrossOriginRequest(new Request(`${base}/api/x`, { method: "POST", headers: { origin: "https://evil.example" } }))?.status).toBe(403);
  });
});

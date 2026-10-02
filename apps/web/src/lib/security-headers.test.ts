import { describe, expect, it } from "vitest";

import { buildSecurityHeaders } from "./security-headers";

const get = (h: { key: string; value: string }[], key: string) =>
  h.find((x) => x.key === key)?.value;

describe("buildSecurityHeaders", () => {
  it("sets HSTS only for https base URLs", () => {
    expect(
      get(
        buildSecurityHeaders({ APP_BASE_URL: "https://a.example" }),
        "Strict-Transport-Security",
      ),
    ).toBe("max-age=31536000; includeSubDomains");
    expect(
      get(
        buildSecurityHeaders({ APP_BASE_URL: "http://localhost:4512" }),
        "Strict-Transport-Security",
      ),
    ).toBeUndefined();
    expect(
      get(buildSecurityHeaders({}), "Strict-Transport-Security"),
    ).toBeUndefined();
  });

  it("allows the default collab origin with ws scheme", () => {
    const csp = get(
      buildSecurityHeaders({}),
      "Content-Security-Policy-Report-Only",
    );
    expect(csp).toContain(
      "connect-src 'self' http://localhost:4513 ws://localhost:4513;",
    );
  });

  it("derives wss for https collab URLs", () => {
    const csp = get(
      buildSecurityHeaders({
        NEXT_PUBLIC_COLLAB_SERVER_URL: "https://collab.example.com/x",
      }),
      "Content-Security-Policy-Report-Only",
    );
    expect(csp).toContain(
      "https://collab.example.com wss://collab.example.com;",
    );
  });

  it("sets the enforced minimal CSP and static headers", () => {
    const h = buildSecurityHeaders({});
    expect(get(h, "Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(get(h, "X-Frame-Options")).toBe("DENY");
    expect(get(h, "X-Content-Type-Options")).toBe("nosniff");
  });
});

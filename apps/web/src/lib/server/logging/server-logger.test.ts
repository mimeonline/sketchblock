import { afterEach, describe, expect, it, vi } from "vitest";

import { getRequestId, logServerError, withRequestId } from "./server-logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("server logger", () => {
  it("preserves safe request ids and exposes them on responses", () => {
    const request = new Request("http://localhost/api/repositories", {
      headers: { "x-request-id": "request-123" },
    });
    const requestId = getRequestId(request);
    const response = withRequestId(new Response(null), requestId);

    expect(requestId).toBe("request-123");
    expect(response.headers.get("x-request-id")).toBe("request-123");
  });

  it("replaces unsafe request ids", () => {
    const request = new Request("http://localhost/api/repositories", {
      headers: { "x-request-id": "invalid request id\n" },
    });

    expect(getRequestId(request)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("writes structured errors and redacts sensitive fields", () => {
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    logServerError("web.repositories.select.failed", new Error("GitHub unavailable"), {
      requestId: "request-123",
      accessToken: "secret-value",
      nested: { password: "secret-password", repository: "mimeonline/sketchblock" },
    });

    expect(write).toHaveBeenCalledOnce();
    const entry = JSON.parse(String(write.mock.calls[0]?.[0]));
    expect(entry).toMatchObject({
      service: "sketchblock-web",
      level: "error",
      event: "web.repositories.select.failed",
      requestId: "request-123",
      accessToken: "[redacted]",
      nested: {
        password: "[redacted]",
        repository: "mimeonline/sketchblock",
      },
      error: {
        name: "Error",
        message: "GitHub unavailable",
      },
    });
  });
});

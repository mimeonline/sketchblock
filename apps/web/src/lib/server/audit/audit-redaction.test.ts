import { describe, expect, it } from "vitest";

import { redactAuditMetadata } from "./audit-redaction";

describe("redactAuditMetadata", () => {
  it("redacts secrets and invite links recursively", () => {
    expect(redactAuditMetadata({
      repository: "mimeonline/sketchblock",
      password: "sensitive",
      nested: { accessToken: "token", collaboratorUrl: "https://example.test/join?invite=secret" },
    })).toEqual({
      repository: "mimeonline/sketchblock",
      password: "[redacted]",
      nested: { accessToken: "[redacted]", collaboratorUrl: "[redacted]" },
    });
  });

  it("limits untrusted strings, arrays and nesting", () => {
    const result = redactAuditMetadata({ long: "x".repeat(600), values: Array.from({ length: 60 }, (_, i) => i) });
    expect(result.long).toHaveLength(512);
    expect(result.values).toHaveLength(50);
  });
});

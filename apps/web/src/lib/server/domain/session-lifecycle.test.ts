import { afterEach, describe, expect, it } from "vitest";

import { adhocRetentionHours, isRepositorySession, isSessionClosed } from "./session-lifecycle";

describe("isSessionClosed", () => {
  const now = Date.parse("2026-10-02T12:00:00Z");

  it("is closed for status closed", () => {
    expect(isSessionClosed({ status: "closed" }, now)).toBe(true);
  });
  it("is open for active sessions without expiry", () => {
    expect(isSessionClosed({ status: "active", expiresAt: null }, now)).toBe(false);
    expect(isSessionClosed({ status: "saved" }, now)).toBe(false);
  });
  it("is closed once expiresAt has passed or equals now", () => {
    expect(isSessionClosed({ status: "active", expiresAt: "2026-10-02T11:59:59Z" }, now)).toBe(true);
    expect(isSessionClosed({ status: "active", expiresAt: "2026-10-02T12:00:00Z" }, now)).toBe(true);
  });
  it("is open while expiresAt is in the future", () => {
    expect(isSessionClosed({ status: "active", expiresAt: "2026-10-02T12:00:01Z" }, now)).toBe(false);
  });
});

describe("isRepositorySession", () => {
  it("requires repository kind and id", () => {
    expect(isRepositorySession({ sourceKind: "repository", repositoryId: "r1" })).toBe(true);
    expect(isRepositorySession({ sourceKind: "adhoc", repositoryId: null })).toBe(false);
    expect(isRepositorySession({ sourceKind: "repository", repositoryId: null })).toBe(false);
  });
});

describe("adhocRetentionHours", () => {
  afterEach(() => { delete process.env.SKETCHBLOCK_ADHOC_RETENTION_HOURS; });
  it("defaults to 24 and honours the env override", () => {
    expect(adhocRetentionHours()).toBe(24);
    process.env.SKETCHBLOCK_ADHOC_RETENTION_HOURS = "6";
    expect(adhocRetentionHours()).toBe(6);
    process.env.SKETCHBLOCK_ADHOC_RETENTION_HOURS = "junk";
    expect(adhocRetentionHours()).toBe(24);
  });
});

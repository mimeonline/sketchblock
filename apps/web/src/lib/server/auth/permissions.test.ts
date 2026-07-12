import { describe, expect, it } from "vitest";

import { assertSessionRoleAllowed, canUseSessionRole, hasRepositoryPermission } from "./permissions";

describe("repository permissions", () => {
  it("orders GitHub repository permissions", () => {
    expect(hasRepositoryPermission("admin", "write")).toBe(true);
    expect(hasRepositoryPermission("triage", "write")).toBe(false);
  });

  it("requires write permission for owner sessions", () => {
    expect(canUseSessionRole("read", "viewer")).toBe(true);
    expect(canUseSessionRole("read", "owner")).toBe(false);
    expect(canUseSessionRole("write", "owner")).toBe(true);
  });

  it("throws a readable error for disallowed session roles", () => {
    expect(() => assertSessionRoleAllowed("read", "owner")).toThrow("GitHub permission read is not allowed to use role owner");
  });
});

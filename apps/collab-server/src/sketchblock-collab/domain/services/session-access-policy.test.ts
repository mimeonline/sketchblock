import { SessionAccessPolicy } from "./session-access-policy.js";

describe("SessionAccessPolicy", () => {
  it("allows unauthenticated access only when auth is disabled", () => {
    expect(SessionAccessPolicy.canAccess(null, "session-1", false)).toBe(true);
    expect(SessionAccessPolicy.canAccess(null, "session-1", true)).toBe(false);
  });

  it("allows server role across sessions", () => {
    expect(SessionAccessPolicy.canAdmin({ sessionId: "*", role: "server" }, "session-1", true)).toBe(true);
    expect(SessionAccessPolicy.canEdit({ sessionId: "*", role: "server" }, "session-1", true)).toBe(true);
  });

  it("keeps viewers read-only", () => {
    const auth = { sessionId: "session-1", role: "viewer" } as const;

    expect(SessionAccessPolicy.canAccess(auth, "session-1", true)).toBe(true);
    expect(SessionAccessPolicy.canEdit(auth, "session-1", true)).toBe(false);
    expect(SessionAccessPolicy.canAdmin(auth, "session-1", true)).toBe(false);
  });
});

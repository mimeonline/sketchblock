import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentOwner: vi.fn(),
  getCurrentAuthUser: vi.fn(),
}));

vi.mock("@/lib/server/auth/owner-session", () => ({ getCurrentOwner: mocks.getCurrentOwner }));
vi.mock("@/lib/server/auth/session", () => ({ getCurrentAuthUser: mocks.getCurrentAuthUser }));

import { getCurrentSessionUser } from "./session-user";

describe("getCurrentSessionUser", () => {
  beforeEach(() => vi.resetAllMocks());

  it("prefers an active local identity with a stable negative participant id", async () => {
    mocks.getCurrentOwner.mockResolvedValue({
      id: "6f995baa-d474-4be8-af58-b3f05f604f1b",
      username: "user-b",
      displayName: "User B",
      sessionIdentityId: -17,
      mustChangePassword: false,
    });
    mocks.getCurrentAuthUser.mockResolvedValue({ id: 42, login: "github-b", permission: "write" });

    await expect(getCurrentSessionUser()).resolves.toEqual({
      id: -17,
      login: "local:6f995baa-d474-4be8-af58-b3f05f604f1b",
      name: "User B",
      avatarUrl: null,
      permission: "read",
      source: "local",
      localUserId: "6f995baa-d474-4be8-af58-b3f05f604f1b",
      mustChangePassword: false,
    });
  });

  it("retains the local password-change lock instead of falling through to GitHub", async () => {
    mocks.getCurrentOwner.mockResolvedValue({
      id: "local-user",
      username: "local",
      displayName: null,
      sessionIdentityId: -18,
      mustChangePassword: true,
    });
    mocks.getCurrentAuthUser.mockResolvedValue({ id: 42, login: "github-b", permission: "write" });

    await expect(getCurrentSessionUser()).resolves.toMatchObject({
      id: -18,
      source: "local",
      mustChangePassword: true,
    });
  });

  it("falls back to the existing GitHub participant identity", async () => {
    mocks.getCurrentOwner.mockResolvedValue(null);
    mocks.getCurrentAuthUser.mockResolvedValue({
      id: 42,
      login: "github-b",
      name: "GitHub B",
      avatarUrl: "https://avatars.example/42",
      permission: "write",
    });

    await expect(getCurrentSessionUser()).resolves.toMatchObject({
      id: 42,
      login: "github-b",
      source: "github",
      localUserId: null,
      mustChangePassword: false,
    });
  });
});

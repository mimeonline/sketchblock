import { describe, expect, it, vi } from "vitest";

const requireLinked = vi.hoisted(() => vi.fn(() => ({ id: 1, login: "gh", name: null, avatarUrl: null })));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/auth/owner-session", () => ({ requireLinkedOwnerGitHub: requireLinked }));

import { requireGitHubForRepository } from "./github-requirement";
import { instanceRepositoryFor } from "./instance-repository";
import type { AuthenticatedOwner } from "@/lib/server/auth/owner-session";

const owner = { id: "u1", username: "anna", githubUserId: null } as unknown as AuthenticatedOwner;

describe("requireGitHubForRepository", () => {
  it("is skipped for instance and demo repositories", () => {
    expect(requireGitHubForRepository(owner, instanceRepositoryFor(owner))).toBeNull();
    expect(requireGitHubForRepository(owner, { provider: "demo" })).toBeNull();
    expect(requireLinked).not.toHaveBeenCalled();
  });

  it("is enforced for GitHub repositories", () => {
    requireGitHubForRepository(owner, { provider: "github" });
    expect(requireLinked).toHaveBeenCalledWith(owner);
  });
});

describe("instanceRepositoryFor", () => {
  it("builds a ready pseudo repository per user", () => {
    expect(instanceRepositoryFor({ id: "u1", username: "anna" })).toMatchObject({
      id: "instance-u1",
      provider: "instance",
      owner: "anna",
      name: "Workspace",
      branch: "main",
      status: "ready",
    });
  });
});

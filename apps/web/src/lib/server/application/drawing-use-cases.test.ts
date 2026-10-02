import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isDemoAuthMode: vi.fn(),
  saveGitHubDrawing: vi.fn(),
  saveDemoDrawing: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/auth/auth-mode", () => ({ isDemoAuthMode: mocks.isDemoAuthMode }));
vi.mock("@/lib/server/demo/demo-store", () => ({
  listDemoDrawings: vi.fn(),
  getDemoDrawing: vi.fn(),
  saveDemoDrawing: mocks.saveDemoDrawing,
}));
vi.mock("@/lib/server/github/github-repository-adapter", () => {
  class GitHubApiError extends Error {
    constructor(public readonly status: number, message: string) {
      super(message);
    }
  }
  return {
    GitHubApiError,
    listGitHubDrawings: vi.fn(),
    readGitHubDrawing: vi.fn(),
    saveGitHubDrawing: mocks.saveGitHubDrawing,
  };
});

import { getDrawingStorage, saveDrawing } from "./drawing-use-cases";
import { StorageConflictError } from "./storage-errors";
import { DemoDrawingStorage } from "@/lib/server/demo/demo-drawing-storage";
import { GitHubDrawingStorage } from "@/lib/server/github/github-drawing-storage";
import { GitHubApiError } from "@/lib/server/github/github-repository-adapter";
import type { RepositoryRecord } from "@/types/sketchblock";

function repo(provider: RepositoryRecord["provider"]): RepositoryRecord {
  return {
    id: "r", provider, githubRepositoryId: 1, owner: "o", name: "n", branch: "main",
    htmlUrl: "", apiUrl: "", private: false, status: "ready",
  };
}

describe("drawing storage selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDemoAuthMode.mockReturnValue(false);
  });

  it("selects by repository provider", () => {
    expect(getDrawingStorage(repo("github"))).toBe(GitHubDrawingStorage);
    expect(getDrawingStorage(repo("demo"))).toBe(DemoDrawingStorage);
    expect(() => getDrawingStorage(repo("instance"))).toThrow();
  });

  it("falls back to demo storage in demo auth mode", () => {
    mocks.isDemoAuthMode.mockReturnValue(true);
    expect(getDrawingStorage(repo("github"))).toBe(DemoDrawingStorage);
  });

  it("maps GitHub 409 to StorageConflictError and keeps other errors", async () => {
    const input = { path: "a.excalidraw", sha: "x", content: {} };
    mocks.saveGitHubDrawing.mockRejectedValueOnce(new GitHubApiError(409, "conflict"));
    await expect(saveDrawing(repo("github"), input)).rejects.toBeInstanceOf(StorageConflictError);
    const other = new GitHubApiError(422, "bad");
    mocks.saveGitHubDrawing.mockRejectedValueOnce(other);
    await expect(saveDrawing(repo("github"), input)).rejects.toBe(other);
  });
});

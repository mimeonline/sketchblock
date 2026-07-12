import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth/session", () => ({
  requireGitHubAccessToken: vi.fn(async () => "gho_user_token"),
}));

import {
  listWritableGitHubRepositories,
  readGitHubDrawing,
  scanGitHubRepository,
} from "./github-repository-adapter";

const repositoryBase = {
  id: 101,
  name: "sketchblock",
  full_name: "mimeonline/sketchblock",
  private: true,
  html_url: "https://github.com/mimeonline/sketchblock",
  url: "https://api.github.com/repos/mimeonline/sketchblock",
  default_branch: "main",
  owner: { login: "mimeonline" },
};

const repositoryRecord = {
  id: "github-101",
  githubRepositoryId: 101,
  owner: "mimeonline",
  name: "software-factory",
  branch: "main",
  htmlUrl: "https://github.com/mimeonline/software-factory",
  apiUrl: "https://api.github.com/repos/mimeonline/software-factory",
  private: true,
  status: "ready" as const,
  drawingCount: 1,
};

describe("GitHub repository selection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns only repositories with write permission", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { ...repositoryBase, permissions: { push: true } },
        {
          ...repositoryBase,
          id: 202,
          name: "read-only",
          full_name: "mimeonline/read-only",
          permissions: { pull: true, push: false },
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(listWritableGitHubRepositories()).resolves.toEqual([
      expect.objectContaining({ githubRepositoryId: 101, fullName: "mimeonline/sketchblock" }),
    ]);
  });

  it("persists an empty scan state when no Excalidraw file exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ tree: [], truncated: false }),
      }),
    );

    const result = await scanGitHubRepository({
      githubRepositoryId: 101,
      owner: "mimeonline",
      name: "sketchblock",
      fullName: "mimeonline/sketchblock",
      branch: "main",
      htmlUrl: "https://github.com/mimeonline/sketchblock",
      apiUrl: "https://api.github.com/repos/mimeonline/sketchblock",
      private: true,
    });

    expect(result.drawings).toEqual([]);
    expect(result.repository).toEqual(
      expect.objectContaining({ id: "github-101", status: "empty", drawingCount: 0 }),
    );
  });

  it("decodes small Excalidraw files from the GitHub base64 response", async () => {
    const drawing = { type: "excalidraw", version: 2, elements: [], appState: {}, files: {} };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: Buffer.from(JSON.stringify(drawing)).toString("base64"),
        encoding: "base64",
        path: "Workshop/Board.excalidraw",
        sha: "small-file-sha",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(readGitHubDrawing(repositoryRecord, "Workshop/Board.excalidraw")).resolves.toEqual({
      path: "Workshop/Board.excalidraw",
      sha: "small-file-sha",
      content: drawing,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("loads Excalidraw files over 1 MB through the GitHub raw media type", async () => {
    const drawing = {
      type: "excalidraw",
      version: 2,
      elements: [],
      appState: {},
      files: { image: { mimeType: "image/png", dataURL: `data:image/png;base64,${"a".repeat(1_100_000)}` } },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: "",
          encoding: "none",
          path: "Workshop/Large Board.excalidraw",
          sha: "large-file-sha",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(drawing),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(readGitHubDrawing(repositoryRecord, "Workshop/Large Board.excalidraw")).resolves.toEqual({
      path: "Workshop/Large Board.excalidraw",
      sha: "large-file-sha",
      content: drawing,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/vnd.github.raw+json" }),
      }),
    );
  });
});

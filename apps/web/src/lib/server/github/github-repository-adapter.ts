import "server-only";

import { requireGitHubAccessToken } from "@/lib/server/auth/session";
import { validateDrawingPath } from "@/lib/server/domain/validate-drawing-path";
import type {
  AvailableGitHubRepository,
  DrawingContent,
  DrawingFile,
  RepositoryRecord,
  SaveDrawingInput,
  SaveDrawingResult,
} from "@/types/sketchblock";

type GitTreeEntry = {
  path?: string;
  type?: string;
  sha?: string;
};

type GitTreeResponse = {
  tree?: GitTreeEntry[];
  truncated?: boolean;
};

type ContentsResponse = {
  content?: string;
  encoding?: string;
  sha?: string;
  path?: string;
};

type SaveResponse = {
  content?: {
    sha?: string;
  };
  commit?: {
    sha?: string;
  };
};

type GitHubRepositoryResponse = {
  id?: number;
  name?: string;
  full_name?: string;
  private?: boolean;
  html_url?: string;
  url?: string;
  default_branch?: string;
  owner?: {
    login?: string;
  };
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
  };
};

export class GitHubApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function githubHeaders() {
  const accessToken = await requireGitHubAccessToken();

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await githubFetch(path, init);
  return response.json() as Promise<T>;
}

async function githubFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = await githubHeaders();
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      ...headers,
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new GitHubApiError(response.status, `GitHub API request failed with ${response.status}.`);
  }

  return response;
}

export async function listWritableGitHubRepositories(): Promise<AvailableGitHubRepository[]> {
  const repositories: AvailableGitHubRepository[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const payload = await githubApiFetch<GitHubRepositoryResponse[]>(
      `/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&direction=desc&per_page=100&page=${page}`,
    );
    repositories.push(
      ...payload
        .filter(hasWritePermission)
        .map(mapAvailableRepository)
        .filter((repository): repository is AvailableGitHubRepository => Boolean(repository)),
    );

    if (payload.length < 100) {
      break;
    }
  }

  return repositories;
}

export async function getWritableGitHubRepository(
  githubRepositoryId: number,
): Promise<AvailableGitHubRepository> {
  const payload = await githubApiFetch<GitHubRepositoryResponse>(
    `/repositories/${githubRepositoryId}`,
  );

  if (!hasWritePermission(payload)) {
    throw new GitHubApiError(403, "The selected repository does not grant write access.");
  }

  const repository = mapAvailableRepository(payload);
  if (!repository) {
    throw new Error("GitHub repository metadata was incomplete.");
  }

  return repository;
}

export async function scanGitHubRepository(
  selected: AvailableGitHubRepository,
): Promise<{ repository: RepositoryRecord; drawings: DrawingFile[] }> {
  const baseRepository = availableToRepositoryRecord(selected);
  const drawings = await listGitHubDrawings(baseRepository);

  return {
    repository: {
      ...baseRepository,
      status: drawings.length > 0 ? "ready" : "empty",
      drawingCount: drawings.length,
      lastScanAt: new Date().toISOString(),
    },
    drawings,
  };
}

export async function listGitHubDrawings(repository: RepositoryRecord): Promise<DrawingFile[]> {
  const data = await githubApiFetch<GitTreeResponse>(
    `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/git/trees/${encodeURIComponent(repository.branch)}?recursive=1`,
  );

  if (data.truncated) {
    throw new Error("GitHub tree response was truncated. Narrow the repository scope or add pagination handling.");
  }

  return (data.tree || [])
    .filter((entry) => entry.type === "blob" && entry.path?.endsWith(".excalidraw"))
    .map((entry) => ({
      path: entry.path || "",
      sha: entry.sha || "",
      lastCommit: "remote",
      status: "indexed" as const,
      repositoryId: repository.id,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function readGitHubDrawing(
  repository: RepositoryRecord,
  filePath: string,
): Promise<DrawingContent> {
  const drawingPath = validateDrawingPath(filePath);
  const data = await githubApiFetch<ContentsResponse>(
    drawingContentsPath(repository, drawingPath),
  );

  if (!data.sha) {
    throw new Error("GitHub response did not contain a file SHA.");
  }

  const serializedDrawing =
    data.content && data.encoding === "base64"
      ? decodeBase64(data.content)
      : await readRawGitHubDrawing(repository, drawingPath);

  return {
    path: data.path || drawingPath,
    sha: data.sha,
    content: JSON.parse(serializedDrawing),
  };
}

async function readRawGitHubDrawing(repository: RepositoryRecord, drawingPath: string) {
  const response = await githubFetch(drawingContentsPath(repository, drawingPath), {
    headers: {
      Accept: "application/vnd.github.raw+json",
    },
  });

  return response.text();
}

function drawingContentsPath(repository: RepositoryRecord, drawingPath: string) {
  return `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/contents/${encodeGitHubPath(drawingPath)}?ref=${encodeURIComponent(repository.branch)}`;
}

export async function saveGitHubDrawing(
  repository: RepositoryRecord,
  input: SaveDrawingInput,
): Promise<SaveDrawingResult> {
  const drawingPath = validateDrawingPath(input.path);
  const committerName = process.env.SKETCHBLOCK_GIT_AUTHOR_NAME?.trim();
  const committerEmail = process.env.SKETCHBLOCK_GIT_AUTHOR_EMAIL?.trim();
  const body = {
    message: input.message || `Update ${drawingPath} from Sketchblock`,
    content: encodeBase64(JSON.stringify(input.content, null, 2)),
    sha: input.sha,
    branch: repository.branch,
    ...(committerName && committerEmail
      ? {
          committer: {
            name: committerName,
            email: committerEmail,
          },
        }
      : {}),
  };

  const data = await githubApiFetch<SaveResponse>(
    `/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/contents/${encodeGitHubPath(drawingPath)}`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );

  if (!data.commit?.sha || !data.content?.sha) {
    throw new Error("GitHub response did not include commit or content SHA.");
  }

  return {
    path: drawingPath,
    commitSha: data.commit.sha,
    contentSha: data.content.sha,
  };
}

function hasWritePermission(repository: GitHubRepositoryResponse) {
  return Boolean(
    repository.permissions?.push ||
      repository.permissions?.maintain ||
      repository.permissions?.admin,
  );
}

function mapAvailableRepository(
  repository: GitHubRepositoryResponse,
): AvailableGitHubRepository | null {
  if (
    !repository.id ||
    !repository.owner?.login ||
    !repository.name ||
    !repository.full_name ||
    !repository.default_branch ||
    !repository.html_url ||
    !repository.url
  ) {
    return null;
  }

  return {
    githubRepositoryId: repository.id,
    owner: repository.owner.login,
    name: repository.name,
    fullName: repository.full_name,
    branch: repository.default_branch,
    htmlUrl: repository.html_url,
    apiUrl: repository.url,
    private: Boolean(repository.private),
  };
}

function availableToRepositoryRecord(
  repository: AvailableGitHubRepository,
): RepositoryRecord {
  return {
    id: `github-${repository.githubRepositoryId}`,
    githubRepositoryId: repository.githubRepositoryId,
    owner: repository.owner,
    name: repository.name,
    branch: repository.branch,
    htmlUrl: repository.htmlUrl,
    apiUrl: repository.apiUrl,
    private: repository.private,
    status: "syncing",
  };
}

function decodeBase64(value: string): string {
  return Buffer.from(value.replace(/\n/g, ""), "base64").toString("utf8");
}

function encodeBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function encodeGitHubPath(filePath: string): string {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

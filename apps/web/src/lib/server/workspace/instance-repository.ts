import type { RepositoryRecord } from "@/types/sketchblock";

export const INSTANCE_REPOSITORY_PREFIX = "instance-";

export function instanceRepositoryId(userId: string): string {
  return `${INSTANCE_REPOSITORY_PREFIX}${userId}`;
}

export function isInstanceRepositoryId(repositoryId: string): boolean {
  return repositoryId.startsWith(INSTANCE_REPOSITORY_PREFIX);
}

export function userIdFromInstanceRepositoryId(repositoryId: string): string {
  if (!isInstanceRepositoryId(repositoryId)) {
    throw new Error("Not an instance workspace repository.");
  }
  return repositoryId.slice(INSTANCE_REPOSITORY_PREFIX.length);
}

/** Pseudo repository describing a local user's instance workspace. */
export function instanceRepositoryFor(user: { id: string; username: string }): RepositoryRecord {
  return {
    id: instanceRepositoryId(user.id),
    provider: "instance",
    githubRepositoryId: 0,
    owner: user.username,
    name: "Workspace",
    branch: "main",
    htmlUrl: "",
    apiUrl: "",
    private: true,
    status: "ready",
  };
}

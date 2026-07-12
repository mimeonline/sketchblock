import "server-only";

import type { SessionRole } from "@/types/sketchblock";

export type GitHubRepositoryPermission = "read" | "triage" | "write" | "maintain" | "admin";

const permissionRank: Record<GitHubRepositoryPermission, number> = {
  read: 1,
  triage: 2,
  write: 3,
  maintain: 4,
  admin: 5,
};

export function hasRepositoryPermission(
  permission: GitHubRepositoryPermission,
  minimum: GitHubRepositoryPermission,
) {
  return permissionRank[permission] >= permissionRank[minimum];
}

export function canUseSessionRole(permission: GitHubRepositoryPermission, role: SessionRole) {
  if (role === "owner") {
    return hasRepositoryPermission(permission, "write");
  }

  return hasRepositoryPermission(permission, "read");
}

export function assertSessionRoleAllowed(permission: GitHubRepositoryPermission, role: SessionRole) {
  if (!canUseSessionRole(permission, role)) {
    throw new Error(`GitHub permission ${permission} is not allowed to use role ${role}.`);
  }
}

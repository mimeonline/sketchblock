import "server-only";

import type { GitHubRepositoryPermission } from "@/lib/server/auth/permissions";
import { getCurrentOwner } from "@/lib/server/auth/owner-session";
import { getCurrentAuthUser } from "@/lib/server/auth/session";

export type SessionUser = {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  permission: GitHubRepositoryPermission;
  source: "local" | "github";
  localUserId: string | null;
  mustChangePassword: boolean;
};

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  const localUser = await getCurrentOwner();
  if (localUser) {
    return {
      id: localUser.sessionIdentityId,
      login: `local:${localUser.id}`,
      name: localUser.displayName || localUser.username,
      avatarUrl: null,
      permission: "read",
      source: "local",
      localUserId: localUser.id,
      mustChangePassword: localUser.mustChangePassword,
    };
  }

  const githubUser = await getCurrentAuthUser();
  return githubUser ? {
    ...githubUser,
    name: githubUser.name ?? null,
    avatarUrl: githubUser.avatarUrl ?? null,
    source: "github",
    localUserId: null,
    mustChangePassword: false,
  } : null;
}

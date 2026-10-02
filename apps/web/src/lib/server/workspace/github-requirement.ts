import "server-only";

import { requireLinkedOwnerGitHub, type AuthenticatedOwner } from "@/lib/server/auth/owner-session";
import type { RepositoryRecord } from "@/types/sketchblock";

/**
 * A linked GitHub identity is only needed for GitHub repositories. Instance
 * workspace (and demo) repositories work without one.
 */
export function requireGitHubForRepository(owner: AuthenticatedOwner, repository: Pick<RepositoryRecord, "provider">) {
  return repository.provider === "github" ? requireLinkedOwnerGitHub(owner) : null;
}

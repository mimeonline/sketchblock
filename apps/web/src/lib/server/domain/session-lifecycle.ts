import type { CollaborationSession } from "@/types/sketchblock";

type LifecycleSession = Pick<CollaborationSession, "status"> & { expiresAt?: string | null };

/** A session is closed when explicitly ended or when its expiry time has passed. */
export function isSessionClosed(session: LifecycleSession, now: number = Date.now()): boolean {
  if (session.status === "closed") return true;
  if (!session.expiresAt) return false;
  const expires = Date.parse(session.expiresAt);
  return Number.isFinite(expires) && expires <= now;
}

export function isRepositorySession(
  session: Pick<CollaborationSession, "repositoryId" | "sourceKind">,
): session is { repositoryId: string; sourceKind: "repository" } & typeof session {
  return session.sourceKind === "repository" && session.repositoryId !== null;
}

export function adhocRetentionHours(): number {
  const parsed = Number(process.env.SKETCHBLOCK_ADHOC_RETENTION_HOURS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
}

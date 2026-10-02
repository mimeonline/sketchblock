import "server-only";

import type { CollaborationSession, CollaborationSessionSnapshot } from "@/types/sketchblock";
import {
  createPostgresAdhocSession,
  createPostgresSession,
  deletePostgresSessionsByIds,
  listPurgeablePostgresAdhocSessions,
  setPostgresParticipantDownload,
  setPostgresSessionPurgeAfter,
  deletePostgresSession,
  getPostgresSession,
  getOwnedPostgresSession,
  getPostgresSessionSnapshot,
  listPostgresSessions,
  updatePostgresSessionBaseSha,
  updatePostgresSessionStatus,
  upsertPostgresSessionSnapshot,
} from "@/lib/server/database/postgres-session-store";

export async function listSessions(userId: string | null, repositoryId?: string): Promise<CollaborationSession[]> {
  return listPostgresSessions(userId, repositoryId);
}

export async function createSession(repositoryId: string, drawingPath: string, ownerId: string | null, baseSha: string | null = null): Promise<CollaborationSession> {
  return createPostgresSession(repositoryId, drawingPath, ownerId, baseSha);
}

export async function getSession(sessionId: string): Promise<CollaborationSession | null> {
  return getPostgresSession(sessionId);
}

export async function getOwnedSession(sessionId: string, userId: string | null) {
  return getOwnedPostgresSession(sessionId, userId);
}

export async function deleteSession(sessionId: string, userId: string | null): Promise<CollaborationSession | null> {
  return deletePostgresSession(sessionId, userId);
}

export async function updateSessionStatus(
  sessionId: string,
  status: CollaborationSession["status"],
  userId: string | null,
): Promise<CollaborationSession | null> {
  return updatePostgresSessionStatus(sessionId, status, userId);
}

export async function getSessionSnapshot(sessionId: string): Promise<CollaborationSessionSnapshot | null> {
  return getPostgresSessionSnapshot(sessionId);
}

export async function upsertSessionSnapshot(input: {
  sessionId: string;
  drawingPath: string;
  content: unknown;
  updatedBy: string;
  revision?: number;
}): Promise<CollaborationSessionSnapshot> {
  return upsertPostgresSessionSnapshot(input);
}

export async function updateSessionBaseSha(
  sessionId: string,
  sha: string,
  userId: string | null,
): Promise<CollaborationSession | null> {
  return updatePostgresSessionBaseSha(sessionId, sha, userId);
}

export async function createAdhocSession(input: {
  title: string;
  ownerId: string | null;
  expiresAt: string;
}): Promise<CollaborationSession> {
  return createPostgresAdhocSession(input);
}

export async function setSessionPurgeAfter(sessionId: string, purgeAfter: string | null): Promise<void> {
  return setPostgresSessionPurgeAfter(sessionId, purgeAfter);
}

export async function listPurgeableAdhocSessions(now: Date, limit: number): Promise<string[]> {
  return listPurgeablePostgresAdhocSessions(now, limit);
}

export async function deleteSessionsByIds(ids: string[]): Promise<number> {
  return deletePostgresSessionsByIds(ids);
}

export async function setParticipantDownload(
  sessionId: string,
  value: boolean,
  userId: string | null,
): Promise<CollaborationSession | null> {
  return setPostgresParticipantDownload(sessionId, value, userId);
}

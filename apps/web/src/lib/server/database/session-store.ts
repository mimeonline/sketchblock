import "server-only";

import type { CollaborationSession, CollaborationSessionSnapshot } from "@/types/sketchblock";
import {
  createPostgresSession,
  deletePostgresSession,
  getPostgresSession,
  getOwnedPostgresSession,
  getPostgresSessionSnapshot,
  listPostgresSessions,
  updatePostgresSessionStatus,
  upsertPostgresSessionSnapshot,
} from "@/lib/server/database/postgres-session-store";

export async function listSessions(userId: string | null, repositoryId?: string): Promise<CollaborationSession[]> {
  return listPostgresSessions(userId, repositoryId);
}

export async function createSession(repositoryId: string, drawingPath: string, ownerId: string | null): Promise<CollaborationSession> {
  return createPostgresSession(repositoryId, drawingPath, ownerId);
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

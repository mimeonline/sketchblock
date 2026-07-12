import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { requireLinkedOwnerGitHub, requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { validateDrawingPath } from "@/lib/server/domain/validate-drawing-path";
import { openDrawing } from "@/lib/server/application/drawing-use-cases";
import {
  getCollabServerStatus,
  inspectCollabSession,
  registerCollabSession,
} from "@/lib/server/collab/collab-server-client";
import { getActiveRepository, requireActiveRepository } from "@/lib/server/database/repository-store";
import { createSession, listSessions } from "@/lib/server/database/session-store";
import { ensureSessionInvites, listSessionParticipants } from "@/lib/server/database/session-invite-store";

export const runtime = "nodejs";

const sessionSchema = z.object({
  path: z.string().min(1),
});

export async function GET() {
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response || !auth.owner) {
      return auth.response;
    }

    const userId = auth.owner.id === "dev-owner" ? null : auth.owner.id;
    const activeRepository = await getActiveRepository(auth.owner.id);
    const sessions = await listSessions(userId, activeRepository?.id);
    const participants = await listSessionParticipants(sessions.map((session) => session.id));
    const [collabServer, collabSessions] = await Promise.all([
      getCollabServerStatus(sessions.length),
      Promise.all(sessions.map(async (session) => {
        const invites = await ensureSessionInvites(session.id, userId);
        return {
          ...session,
          shareLinks: inviteLinks(session.id, invites),
          participants: participants.filter((participant) => participant.sessionId === session.id),
          collab: await inspectCollabSession(session),
        };
      })),
    ]);

    return NextResponse.json({ sessions: collabSessions, collabServer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response || !auth.owner) {
      return auth.response;
    }

    requireLinkedOwnerGitHub(auth.owner);
    const body = sessionSchema.parse(await request.json());
    const repository = await requireActiveRepository(auth.owner.id);

    const drawingPath = validateDrawingPath(body.path);
    const drawing = await openDrawing(repository, drawingPath);
    const userId = auth.owner.id === "dev-owner" ? null : auth.owner.id;
    const session = await createSession(repository.id, drawingPath, userId);
    const invites = await ensureSessionInvites(session.id, userId);
    const collab = await registerCollabSession(session, drawing.content);
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: auth.owner.role, action: "session.start", targetType: "session", targetId: session.id, outcome: "success", metadata: { repositoryId: repository.id, drawingPath }, requestId, sessionId: session.id });
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: auth.owner.role, action: "session.invite.create", targetType: "session", targetId: session.id, outcome: "success", metadata: { roles: ["collaborator", "viewer"] }, requestId, sessionId: session.id });
    return NextResponse.json({
      session: { ...session, shareLinks: inviteLinks(session.id, invites), participants: [], collab },
      url: `/join/${session.id}?owner=1`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}

function inviteLinks(
  sessionId: string,
  invites: Awaited<ReturnType<typeof ensureSessionInvites>>,
) {
  return {
    collaborator: `/join/${sessionId}?invite=${encodeURIComponent(invites.collaborator.token)}`,
    viewer: `/join/${sessionId}?invite=${encodeURIComponent(invites.viewer.token)}`,
  };
}

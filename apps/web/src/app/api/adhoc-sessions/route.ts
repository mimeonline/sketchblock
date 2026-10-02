import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { consumeAuthAttempt, rejectCrossOriginRequest } from "@/lib/server/auth/request-security";
import { purgeExpiredAdhocSessions } from "@/lib/server/application/purge-adhoc-sessions";
import { registerCollabSession } from "@/lib/server/collab/collab-server-client";
import { ensureSessionInvites } from "@/lib/server/database/session-invite-store";
import { createAdhocSession, deleteSession } from "@/lib/server/database/session-store";
import { BoardUploadError, validateBoardUpload } from "@/lib/server/domain/validate-board-upload";
import { getRequestId } from "@/lib/server/logging/server-logger";

export const runtime = "nodejs";

const RATE_LIMIT = 20;

const uploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  board: z.string(),
});

function adhocTtlHours() {
  const parsed = Number(process.env.SKETCHBLOCK_ADHOC_TTL_HOURS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 168;
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginRequest(request);
  if (originError) return originError;
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response || !auth.owner) {
      return auth.response;
    }

    const attempt = consumeAuthAttempt(request, `adhoc:${auth.owner.id}`, RATE_LIMIT);
    if (!attempt.allowed) {
      return NextResponse.json(
        { error: "Too many uploads. Try again later.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } },
      );
    }

    const parsedBody = uploadSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid request body.", code: "invalid_request" }, { status: 400 });
    }
    const { fileName, board: rawBoard } = parsedBody.data;

    let board: unknown;
    try {
      board = validateBoardUpload(rawBoard);
    } catch (error) {
      if (error instanceof BoardUploadError) {
        return NextResponse.json({ code: error.code, error: error.message }, { status: 400 });
      }
      throw error;
    }

    void purgeExpiredAdhocSessions({}).catch(() => undefined);

    const title = fileName.replace(/\.[^./\\]*$/, "").trim() || "board";
    const userId = auth.owner.id === "dev-owner" ? null : auth.owner.id;
    const expiresAt = new Date(Date.now() + adhocTtlHours() * 3_600_000).toISOString();
    const session = await createAdhocSession({ title, ownerId: userId, expiresAt });
    const collab = await registerCollabSession(session, board);
    if (collab.status === "error" || collab.status === "unreachable") {
      // Invites are removed via ON DELETE CASCADE (app_session_invites.session_id).
      await deleteSession(session.id, userId);
      return NextResponse.json(
        { error: "The collaboration server could not register the session.", code: "collab_unavailable" },
        { status: 503 },
      );
    }
    const invites = await ensureSessionInvites(session.id, userId);
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: auth.owner.role, action: "session.start", targetType: "session", targetId: session.id, outcome: "success", metadata: { sourceKind: "adhoc" }, requestId, sessionId: session.id });
    return NextResponse.json(
      {
        session: {
          ...session,
          shareLinks: {
            collaborator: `/join/${session.id}?invite=${encodeURIComponent(invites.collaborator.token)}`,
            viewer: `/join/${session.id}?invite=${encodeURIComponent(invites.viewer.token)}`,
            collaboratorExpiresAt: invites.collaborator.expiresAt,
            viewerExpiresAt: invites.viewer.expiresAt,
          },
        },
        url: `/join/${session.id}?owner=1`,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}

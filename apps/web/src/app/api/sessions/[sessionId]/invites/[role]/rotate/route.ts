import { NextRequest, NextResponse } from "next/server";

import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { rejectCrossOriginRequest } from "@/lib/server/auth/request-security";
import { rotateSessionInvite } from "@/lib/server/database/session-invite-store";
import { getOwnedSession } from "@/lib/server/database/session-store";
import { getRequestId } from "@/lib/server/logging/server-logger";

export const runtime = "nodejs";

type RotateRouteContext = {
  params: Promise<{
    sessionId: string;
    role: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RotateRouteContext) {
  const crossOrigin = rejectCrossOriginRequest(request);
  if (crossOrigin) return crossOrigin;

  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response) return auth.response;

    const { sessionId, role } = await params;
    if (role !== "collaborator" && role !== "viewer") {
      return NextResponse.json({ error: "Unknown invitation role." }, { status: 400 });
    }

    const userId = auth.owner?.id === "dev-owner" ? null : auth.owner?.id || null;
    const session = await getOwnedSession(sessionId, userId);
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    if (session.status === "closed") {
      return NextResponse.json({ error: "This session has ended.", code: "session_closed" }, { status: 409 });
    }

    const invite = await rotateSessionInvite(sessionId, role, userId);
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: auth.owner.role, action: "session.invite.rotate", targetType: "session", targetId: sessionId, outcome: "success", metadata: { role }, requestId, sessionId });

    return NextResponse.json({
      link: `/join/${sessionId}?invite=${encodeURIComponent(invite.token)}`,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not rotate the invitation." },
      { status: 500 },
    );
  }
}

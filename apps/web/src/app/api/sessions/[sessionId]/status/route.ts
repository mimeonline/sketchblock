import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { updateCollabSessionStatus } from "@/lib/server/collab/collab-server-client";
import { getOwnedSession, updateSessionStatus } from "@/lib/server/database/session-store";

export const runtime = "nodejs";

type SessionStatusRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

const statusSchema = z.object({
  status: z.enum(["active", "closed", "saved"]),
});

export async function PATCH(request: NextRequest, { params }: SessionStatusRouteContext) {
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response) {
      return auth.response;
    }

    const { sessionId } = await params;
    const userId = auth.owner?.id === "dev-owner" ? null : auth.owner?.id || null;
    const session = await getOwnedSession(sessionId, userId);

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const body = statusSchema.parse(await request.json());
    const collab = await updateCollabSessionStatus({
      sessionId,
      status: body.status,
      updatedBy: "web-api",
    });

    if (collab.status === "error" || collab.status === "unreachable") {
      return NextResponse.json(
        { error: collab.error || "Could not update session status.", collab },
        { status: collab.status === "unreachable" ? 503 : 400 },
      );
    }

    await updateSessionStatus(sessionId, body.status, userId);
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: auth.owner.role, action: body.status === "closed" ? "session.end" : "session.status.change", targetType: "session", targetId: sessionId, outcome: "success", metadata: { status: body.status }, requestId, sessionId });

    return NextResponse.json({ session: { ...session, status: body.status, collab }, collab });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid session status." },
      { status: 400 },
    );
  }
}

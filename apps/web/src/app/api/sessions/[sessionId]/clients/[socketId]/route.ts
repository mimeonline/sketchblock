import { NextResponse } from "next/server";

import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { kickCollabClient } from "@/lib/server/collab/collab-server-client";
import { getOwnedSession } from "@/lib/server/database/session-store";

export const runtime = "nodejs";

type SessionClientRouteContext = {
  params: Promise<{
    sessionId: string;
    socketId: string;
  }>;
};

export async function DELETE(_request: Request, { params }: SessionClientRouteContext) {
  const auth = await requireOwnerApiAuth();
  if (auth.response) {
    return auth.response;
  }

  const { sessionId, socketId } = await params;
  const session = await getOwnedSession(sessionId, auth.owner?.id === "dev-owner" ? null : auth.owner?.id || null);

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const collab = await kickCollabClient(sessionId, socketId);

  if (collab.status === "error") {
    return NextResponse.json(
      { error: collab.error || "Client not found.", collab },
      { status: collab.error === "client_not_found" ? 404 : 400 },
    );
  }

  if (collab.status === "unreachable") {
    return NextResponse.json(
      { error: collab.error || "Collab server unavailable.", collab },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, collab });
}

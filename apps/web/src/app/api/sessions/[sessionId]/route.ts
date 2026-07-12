import { NextRequest, NextResponse } from "next/server";

import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { closeCollabSession } from "@/lib/server/collab/collab-server-client";
import { deleteSession, getOwnedSession } from "@/lib/server/database/session-store";

export const runtime = "nodejs";

type SessionRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: SessionRouteContext) {
  const auth = await requireOwnerApiAuth();
  if (auth.response) {
    return auth.response;
  }

  const { sessionId } = await params;
  const session = await getOwnedSession(sessionId, auth.owner?.id === "dev-owner" ? null : auth.owner?.id || null);

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({ session });
}

export async function DELETE(_request: NextRequest, { params }: SessionRouteContext) {
  const auth = await requireOwnerApiAuth();
  if (auth.response) {
    return auth.response;
  }

  const { sessionId } = await params;
  const session = await deleteSession(sessionId, auth.owner?.id === "dev-owner" ? null : auth.owner?.id || null);

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const collab = await closeCollabSession(sessionId);
  return NextResponse.json({ session, collab });
}

import { NextResponse } from "next/server";

import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { rejectCrossOriginRequest } from "@/lib/server/auth/request-security";
import { inspectCollabSession, kickCollabClient } from "@/lib/server/collab/collab-server-client";
import { markGuestRemoved } from "@/lib/server/database/session-guest-store";
import { findParticipantUserIdByLogin, markParticipantRemoved } from "@/lib/server/database/session-invite-store";
import { getOwnedSession } from "@/lib/server/database/session-store";

export const runtime = "nodejs";

type SessionClientRouteContext = {
  params: Promise<{
    sessionId: string;
    socketId: string;
  }>;
};

export async function DELETE(request: Request, { params }: SessionClientRouteContext) {
  const crossOrigin = rejectCrossOriginRequest(request);
  if (crossOrigin) return crossOrigin;

  const auth = await requireOwnerApiAuth();
  if (auth.response) {
    return auth.response;
  }

  const { sessionId, socketId } = await params;
  const ownerId = auth.owner?.id === "dev-owner" ? null : auth.owner?.id || null;
  const session = await getOwnedSession(sessionId, ownerId);

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  // Removal is an exclusion: resolve the participant behind the socket and block
  // re-entry before disconnecting, so a reconnect cannot win the race.
  // Owner sockets (e.g. a stale second tab) are only disconnected, never excluded.
  const runtime = await inspectCollabSession(session);
  const target = runtime.presence?.find((client) => client.socketId === socketId);
  const excludeParticipant = Boolean(target && target.role !== "owner");
  if (target && excludeParticipant) {
    // GitHub logins may also start with "guest-", so fall back to the participant lookup.
    const guestRemoved = target.userId.startsWith("guest-")
      && await markGuestRemoved(sessionId, target.userId.slice("guest-".length));
    if (!guestRemoved) {
      const githubUserId = await findParticipantUserIdByLogin(sessionId, target.userId);
      if (githubUserId !== null) {
        await markParticipantRemoved(sessionId, githubUserId, ownerId);
      }
    }
  }

  const collab = await kickCollabClient(sessionId, socketId, { excludeActor: excludeParticipant });

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

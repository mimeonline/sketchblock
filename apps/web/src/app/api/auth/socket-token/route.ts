import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createCollabTicket } from "@/lib/server/auth/collab-ticket";
import { getCurrentOwner } from "@/lib/server/auth/owner-session";
import { getValidSessionGrant } from "@/lib/server/auth/session-grant";
import { getCurrentAuthUser } from "@/lib/server/auth/session";
import { getOwnedSession, getSession } from "@/lib/server/database/session-store";
import { recordSessionParticipant, validateSessionInvite } from "@/lib/server/database/session-invite-store";

export const runtime = "nodejs";

const socketTokenSchema = z.object({
  sessionId: z.string().min(1),
  role: z.enum(["owner", "collaborator", "viewer"]),
  clientId: z.string().min(1),
  inviteToken: z.string().min(1).max(256).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = socketTokenSchema.parse(await request.json());
    const session = await getSession(body.sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (body.role === "owner") {
      const owner = await getCurrentOwner();
      if (!owner) {
        return NextResponse.json({ error: "Instance Owner login required." }, { status: 401 });
      }
      if (owner.mustChangePassword) {
        return NextResponse.json({ error: "Password change required.", code: "password_change_required" }, { status: 423 });
      }
      const ownedSession = await getOwnedSession(body.sessionId, owner.id === "dev-owner" ? null : owner.id);
      if (!ownedSession) {
        return NextResponse.json({ error: "Session not found for the authenticated user." }, { status: 404 });
      }
      return NextResponse.json({
        token: createCollabTicket({
          sessionId: body.sessionId,
          clientId: body.clientId,
          actor: owner.githubLogin || owner.username,
          displayName: owner.githubName || owner.username,
          avatarUrl: owner.githubAvatarUrl,
          role: "owner",
          permission: "admin",
        }),
      });
    }

    const authUser = await getCurrentAuthUser();
    const access = authUser
      ? body.inviteToken
        ? await validateSessionInvite(body.sessionId, body.inviteToken)
        : await getValidSessionGrant(body.sessionId, authUser.id)
      : null;
    if (!authUser || !access) {
      return NextResponse.json({ error: "Valid session invitation and GitHub login required." }, { status: 401 });
    }
    await recordSessionParticipant({
      sessionId: body.sessionId,
      role: access.role,
      githubUserId: authUser.id,
      githubLogin: authUser.login,
      displayName: authUser.name || authUser.login,
      avatarUrl: authUser.avatarUrl,
    });

    return NextResponse.json({
      token: createCollabTicket({
        sessionId: body.sessionId,
        clientId: body.clientId,
        actor: authUser.login,
        displayName: authUser.name || authUser.login,
        avatarUrl: authUser.avatarUrl,
        role: access.role,
        permission: "read",
      }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create socket auth token." },
      { status: 400 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createCollabTicket } from "@/lib/server/auth/collab-ticket";
import { getCurrentOwner } from "@/lib/server/auth/owner-session";
import { getCurrentAuthUser } from "@/lib/server/auth/session";
import { getSession } from "@/lib/server/database/session-store";
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

    const [authUser, invite] = await Promise.all([
      getCurrentAuthUser(),
      body.inviteToken ? validateSessionInvite(body.sessionId, body.inviteToken) : Promise.resolve(null),
    ]);
    if (!authUser || !invite) {
      return NextResponse.json({ error: "Valid session invitation and GitHub login required." }, { status: 401 });
    }
    await recordSessionParticipant({
      sessionId: body.sessionId,
      role: invite.role,
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
        role: invite.role,
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

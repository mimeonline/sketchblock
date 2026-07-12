import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentOwner } from "@/lib/server/auth/owner-session";
import { getCurrentAuthUser } from "@/lib/server/auth/session";
import {
  recordSessionParticipant,
  validateSessionInvite,
} from "@/lib/server/database/session-invite-store";
import { getOwnedSession } from "@/lib/server/database/session-store";
import type { SessionRole } from "@/types/sketchblock";

export type SessionAccess = {
  role: SessionRole;
  actor: string;
  displayName: string;
  permission: "read" | "admin";
  localUserId?: string | null;
};

export async function authorizeSessionRequest(
  request: NextRequest,
  sessionId: string,
  required: "view" | "edit" | "owner" = "view",
): Promise<{ access: SessionAccess | null; response: NextResponse | null }> {
  const inviteToken = request.nextUrl.searchParams.get("invite");

  if (!inviteToken) {
    const owner = await getCurrentOwner();
    if (!owner) {
      return {
        access: null,
        response: NextResponse.json({ error: "Instance Owner login required." }, { status: 401 }),
      };
    }
    const ownedSession = await getOwnedSession(sessionId, owner.id === "dev-owner" ? null : owner.id);
    if (!ownedSession) {
      return {
        access: null,
        response: NextResponse.json({ error: "Session not found for the authenticated user." }, { status: 404 }),
      };
    }
    return {
      access: {
        role: "owner",
        actor: owner.githubLogin || owner.username,
        displayName: owner.githubName || owner.username,
        permission: "admin",
        localUserId: owner.id === "dev-owner" ? null : owner.id,
      },
      response: null,
    };
  }

  const [invite, user] = await Promise.all([
    validateSessionInvite(sessionId, inviteToken),
    getCurrentAuthUser(),
  ]);
  if (!invite || !user) {
    return {
      access: null,
      response: NextResponse.json({ error: "Valid session invitation and GitHub login required." }, { status: 401 }),
    };
  }
  if (required === "owner" || (required === "edit" && invite.role !== "collaborator")) {
    return {
      access: null,
      response: NextResponse.json({ error: "Session role does not allow this action." }, { status: 403 }),
    };
  }

  await recordSessionParticipant({
    sessionId,
    role: invite.role,
    githubUserId: user.id,
    githubLogin: user.login,
    displayName: user.name || user.login,
    avatarUrl: user.avatarUrl,
  });

  return {
    access: {
      role: invite.role,
      actor: user.login,
      displayName: user.name || user.login,
      permission: "read",
    },
    response: null,
  };
}

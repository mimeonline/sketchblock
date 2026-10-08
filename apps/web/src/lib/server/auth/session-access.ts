import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentOwner } from "@/lib/server/auth/owner-session";
import { getValidGuestGrant } from "@/lib/server/auth/guest-grant";
import { getValidSessionGrant } from "@/lib/server/auth/session-grant";
import { getCurrentSessionUser } from "@/lib/server/auth/session-user";
import { touchSessionGuest } from "@/lib/server/database/session-guest-store";
import {
  isParticipantRemoved,
  recordSessionParticipant,
  validateSessionInvite,
} from "@/lib/server/database/session-invite-store";
import { getOwnedSession, getSession } from "@/lib/server/database/session-store";
import type { SessionRole } from "@/types/sketchblock";
import { isSessionClosed } from "@/lib/server/domain/session-lifecycle";

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
  const session = await getSession(sessionId);
  const sessionClosed = session ? isSessionClosed(session) : false;

  if (!inviteToken) {
    const owner = await getCurrentOwner();
    let ownerPasswordChangeRequired = false;
    if (owner) {
      const ownedSession = await getOwnedSession(sessionId, owner.id === "dev-owner" ? null : owner.id);
      ownerPasswordChangeRequired = Boolean(ownedSession && owner.mustChangePassword);
      if (ownedSession && !ownerPasswordChangeRequired && sessionClosed && required !== "view") {
        return { access: null, response: sessionClosedResponse() };
      }
      if (ownedSession && !ownerPasswordChangeRequired) return {
        access: {
          role: "owner",
          actor: owner.githubLogin || owner.username,
          displayName: owner.githubName || owner.username,
          permission: "admin",
          localUserId: owner.id === "dev-owner" ? null : owner.id,
        },
        response: null,
      };
      if (required === "owner") {
        return {
          access: null,
          response: ownerPasswordChangeRequired
            ? NextResponse.json({ error: "Password change required.", code: "password_change_required" }, { status: 423 })
            : NextResponse.json({ error: "Session not found for the authenticated user." }, { status: 404 }),
        };
      }
    }

    if (sessionClosed) {
      return { access: null, response: sessionClosedResponse() };
    }

    const user = await getCurrentSessionUser();
    if (user?.mustChangePassword) {
      return { access: null, response: passwordChangeRequiredResponse() };
    }
    const grant = user ? await getValidSessionGrant(sessionId, user.id) : null;
    if (!user || !grant) {
      const guestResult = ownerPasswordChangeRequired ? null : await authorizeGuest(sessionId, required);
      if (guestResult) return guestResult;
      return {
        access: null,
        response: ownerPasswordChangeRequired
          ? NextResponse.json({ error: "Password change required.", code: "password_change_required" }, { status: 423 })
          : NextResponse.json({ error: "Valid session access required." }, { status: 401 }),
      };
    }
    if (await isParticipantRemoved(sessionId, user.id)) return { access: null, response: participantRemovedResponse() };
    if (required === "owner" || (required === "edit" && grant.role !== "collaborator")) {
      return {
        access: null,
        response: NextResponse.json({ error: "Session role does not allow this action." }, { status: 403 }),
      };
    }

    return {
      access: {
        role: grant.role,
        actor: user.login,
        displayName: user.name || user.login,
        permission: "read",
        localUserId: user.localUserId,
      },
      response: null,
    };
  }

  if (sessionClosed) {
    return { access: null, response: sessionClosedResponse() };
  }

  const [invite, user] = await Promise.all([
    validateSessionInvite(sessionId, inviteToken),
    getCurrentSessionUser(),
  ]);
  if (user?.mustChangePassword) {
    return { access: null, response: passwordChangeRequiredResponse() };
  }
  if (!invite || !user) {
    if (!user) {
      const guestResult = await authorizeGuest(sessionId, required);
      if (guestResult) return guestResult;
    }
    return {
      access: null,
      response: NextResponse.json({ error: "Valid session invitation and GitHub login required." }, { status: 401 }),
    };
  }
  if (await isParticipantRemoved(sessionId, user.id)) return { access: null, response: participantRemovedResponse() };
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
      localUserId: user.localUserId,
    },
    response: null,
  };
}

async function authorizeGuest(
  sessionId: string,
  required: "view" | "edit" | "owner",
): Promise<{ access: SessionAccess | null; response: NextResponse | null } | null> {
  const guest = await getValidGuestGrant(sessionId);
  if (!guest) return null;
  if (required !== "view") {
    return {
      access: null,
      response: NextResponse.json({ error: "Session role does not allow this action." }, { status: 403 }),
    };
  }
  await touchSessionGuest(sessionId, guest.guestId).catch(() => undefined);
  return {
    access: {
      role: "viewer",
      actor: `guest-${guest.guestId}`,
      displayName: guest.displayName,
      permission: "read",
    },
    response: null,
  };
}

function sessionClosedResponse() {
  return NextResponse.json({ error: "This session has ended.", code: "session_closed" }, { status: 410 });
}

function participantRemovedResponse() {
  return NextResponse.json({ error: "You were removed from this session.", code: "participant_removed" }, { status: 403 });
}

function passwordChangeRequiredResponse() {
  return NextResponse.json({ error: "Password change required.", code: "password_change_required" }, { status: 423 });
}

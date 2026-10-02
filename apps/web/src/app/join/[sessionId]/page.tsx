import { notFound, redirect } from "next/navigation";

import { drawingTitle } from "@/lib/drawing-title";

import { JoinSessionTemplate } from "@/features/home/templates/HomeTemplate";
import { GuestJoinForm } from "@/features/join/organisms/GuestJoinForm";
import { SessionEndedNotice } from "@/features/join/organisms/SessionEndedNotice";
import { getCurrentOwner, requireOwnerPageAuth } from "@/lib/server/auth/owner-session";
import { getValidGuestGrant } from "@/lib/server/auth/guest-grant";
import { getValidSessionGrant } from "@/lib/server/auth/session-grant";
import { getCurrentAuthUser, requirePageAuth } from "@/lib/server/auth/session";
import { isParticipantRemoved, validateSessionInvite } from "@/lib/server/database/session-invite-store";
import { getOwnedSession, getSession } from "@/lib/server/database/session-store";
import { isSessionClosed } from "@/lib/server/domain/session-lifecycle";

type JoinSessionPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
  searchParams: Promise<{
    invite?: string;
    owner?: string;
  }>;
};

export default async function JoinSessionPage({ params, searchParams }: JoinSessionPageProps) {
  const { sessionId } = await params;
  const { invite, owner: ownerMode } = await searchParams;
  const session = await getSession(sessionId);
  if (!session) {
    const owner = await getCurrentOwner();
    if (owner) {
      redirect("/sessions");
    }
    notFound();
  }

  if (isSessionClosed(session) && ownerMode !== "1") {
    const owner = await getCurrentOwner();
    if (owner && await getOwnedSession(sessionId, owner.id === "dev-owner" ? null : owner.id)) {
      redirect(`/join/${sessionId}?owner=1`);
    }
    return <SessionEndedNotice showSessionsLink={false} />;
  }

  if (ownerMode === "1") {
    const owner = await requireOwnerPageAuth(`/join/${sessionId}?owner=1`);
    const ownedSession = await getOwnedSession(sessionId, owner.id === "dev-owner" ? null : owner.id);
    if (!ownedSession) notFound();
    return (
      <JoinSessionTemplate
        identity={{ login: owner.githubLogin || owner.username, displayName: owner.githubName || owner.username }}
        sessionId={sessionId}
        role="owner"
      />
    );
  }

  if (!invite) {
    const user = await getCurrentAuthUser();
    const grant = user ? await getValidSessionGrant(sessionId, user.id) : null;
    if (user && grant) {
      if (await isParticipantRemoved(sessionId, user.id)) notFound();
      return (
        <JoinSessionTemplate
          identity={{ login: user.login, displayName: user.name || user.login }}
          sessionId={sessionId}
          role={grant.role}
        />
      );
    }
    const guest = user ? null : await getValidGuestGrant(sessionId);
    if (guest) {
      return (
        <JoinSessionTemplate
          identity={{ login: `guest-${guest.guestId}`, displayName: guest.displayName }}
          sessionId={sessionId}
          role="viewer"
        />
      );
    }
    const owner = await getCurrentOwner();
    if (owner && await getOwnedSession(sessionId, owner.id === "dev-owner" ? null : owner.id)) {
      redirect(`/join/${sessionId}?owner=1`);
    }
    notFound();
  }

  const validatedInvite = await validateSessionInvite(sessionId, invite);
  if (!validatedInvite) notFound();

  const currentUser = await getCurrentAuthUser();
  if (!currentUser) {
    const guest = await getValidGuestGrant(sessionId);
    if (guest) {
      return (
        <JoinSessionTemplate
          identity={{ login: `guest-${guest.guestId}`, displayName: guest.displayName }}
          sessionId={sessionId}
          role="viewer"
        />
      );
    }
    if (validatedInvite.role === "viewer" && session.allowAnonymousViewers) {
      return <GuestJoinForm sessionId={sessionId} inviteToken={invite} boardTitle={session.title ? drawingTitle(session.title) : undefined} />;
    }
  }

  const returnTo = `/join/${sessionId}?invite=${encodeURIComponent(invite)}`;
  const authUser = await requirePageAuth(returnTo, "read");
  if (await isParticipantRemoved(sessionId, authUser.id)) notFound();
  redirect(`/api/sessions/${sessionId}/claim?invite=${encodeURIComponent(invite)}`);
}

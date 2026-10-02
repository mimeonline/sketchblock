import { notFound, redirect } from "next/navigation";

import { JoinSessionTemplate } from "@/features/home/templates/HomeTemplate";
import { SessionEndedNotice } from "@/features/join/organisms/SessionEndedNotice";
import { getCurrentOwner, requireOwnerPageAuth } from "@/lib/server/auth/owner-session";
import { getValidSessionGrant } from "@/lib/server/auth/session-grant";
import { getCurrentAuthUser, requirePageAuth } from "@/lib/server/auth/session";
import { isParticipantRemoved, validateSessionInvite } from "@/lib/server/database/session-invite-store";
import { getOwnedSession, getSession } from "@/lib/server/database/session-store";

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

  if (session.status === "closed" && ownerMode !== "1") {
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
    const owner = await getCurrentOwner();
    if (owner && await getOwnedSession(sessionId, owner.id === "dev-owner" ? null : owner.id)) {
      redirect(`/join/${sessionId}?owner=1`);
    }
    notFound();
  }

  const validatedInvite = await validateSessionInvite(sessionId, invite);
  if (!validatedInvite) notFound();

  const returnTo = `/join/${sessionId}?invite=${encodeURIComponent(invite)}`;
  const authUser = await requirePageAuth(returnTo, "read");
  if (await isParticipantRemoved(sessionId, authUser.id)) notFound();
  redirect(`/api/sessions/${sessionId}/claim?invite=${encodeURIComponent(invite)}`);
}

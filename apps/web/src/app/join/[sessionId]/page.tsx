import { notFound } from "next/navigation";

import { JoinSessionTemplate } from "@/features/home/templates/HomeTemplate";
import { requireOwnerPageAuth } from "@/lib/server/auth/owner-session";
import { requirePageAuth } from "@/lib/server/auth/session";
import { recordSessionParticipant, validateSessionInvite } from "@/lib/server/database/session-invite-store";
import { getSession } from "@/lib/server/database/session-store";

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
  if (!session) notFound();

  if (ownerMode === "1") {
    const owner = await requireOwnerPageAuth(`/join/${sessionId}?owner=1`);
    return (
      <JoinSessionTemplate
        identity={{ login: owner.githubLogin || owner.username, displayName: owner.githubName || owner.username }}
        sessionId={sessionId}
        role="owner"
      />
    );
  }

  const validatedInvite = invite ? await validateSessionInvite(sessionId, invite) : null;
  if (!validatedInvite) notFound();

  const returnTo = `/join/${sessionId}?invite=${encodeURIComponent(invite || "")}`;
  const user = await requirePageAuth(returnTo, "read");
  await recordSessionParticipant({
    sessionId,
    role: validatedInvite.role,
    githubUserId: user.id,
    githubLogin: user.login,
    displayName: user.name || user.login,
    avatarUrl: user.avatarUrl,
  });

  return (
    <JoinSessionTemplate
      identity={{ login: user.login, displayName: user.name || user.login }}
      inviteToken={invite}
      sessionId={sessionId}
      role={validatedInvite.role}
    />
  );
}

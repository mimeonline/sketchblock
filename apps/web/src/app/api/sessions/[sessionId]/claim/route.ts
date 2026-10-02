import { NextRequest, NextResponse } from "next/server";

import { createSessionGrantCookie } from "@/lib/server/auth/session-grant";
import { getAppBaseUrl, getCurrentAuthUser, getLoginPath } from "@/lib/server/auth/session";
import { recordSessionParticipant, validateSessionInvite } from "@/lib/server/database/session-invite-store";
import { getSession } from "@/lib/server/database/session-store";
import { isSessionClosed } from "@/lib/server/domain/session-lifecycle";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const inviteToken = request.nextUrl.searchParams.get("invite") || "";
  const returnTo = `/join/${sessionId}?invite=${encodeURIComponent(inviteToken)}`;
  const [session, invite, user] = await Promise.all([
    getSession(sessionId),
    validateSessionInvite(sessionId, inviteToken),
    getCurrentAuthUser(),
  ]);

  if (session && isSessionClosed(session)) {
    return NextResponse.redirect(new URL(`/join/${sessionId}`, getAppBaseUrl()));
  }
  if (!session || !invite) {
    return NextResponse.json({ error: "Valid session invitation required." }, { status: 404 });
  }
  if (!user) {
    return NextResponse.redirect(new URL(getLoginPath(returnTo), getAppBaseUrl()));
  }

  await recordSessionParticipant({
    sessionId,
    role: invite.role,
    githubUserId: user.id,
    githubLogin: user.login,
    displayName: user.name || user.login,
    avatarUrl: user.avatarUrl,
  });

  const response = NextResponse.redirect(new URL(`/join/${sessionId}`, getAppBaseUrl()));
  const grantCookie = createSessionGrantCookie({ sessionId, invite, githubUserId: user.id });
  response.cookies.set(grantCookie.name, grantCookie.value, grantCookie.options);
  return response;
}

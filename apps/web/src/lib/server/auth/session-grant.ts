import "server-only";

import { createHash } from "node:crypto";

import { cookies } from "next/headers";

import { signPayload, verifySignedPayload } from "@/lib/server/auth/crypto";
import { validateSessionInviteGrant, type SessionInvite } from "@/lib/server/database/session-invite-store";

const SESSION_GRANT_COOKIE_PREFIX = "sketchblock_session_";
const SESSION_GRANT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

type SessionGrantPayload = {
  version: 1;
  sessionId: string;
  inviteId: string;
  role: SessionInvite["role"];
  githubUserId: number;
  expiresAt: number;
};

export type ValidSessionGrant = Pick<SessionGrantPayload, "sessionId" | "inviteId" | "role" | "githubUserId" | "expiresAt">;

export function createSessionGrantCookie(input: {
  sessionId: string;
  invite: SessionInvite;
  githubUserId: number;
}) {
  const maximumExpiresAt = Date.now() + SESSION_GRANT_MAX_AGE_SECONDS * 1000;
  const inviteExpiresAt = input.invite.expiresAt ? new Date(input.invite.expiresAt).getTime() : maximumExpiresAt;
  const expiresAt = Math.min(maximumExpiresAt, inviteExpiresAt);
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const payload: SessionGrantPayload = {
    version: 1,
    sessionId: input.sessionId,
    inviteId: input.invite.id,
    role: input.invite.role,
    githubUserId: input.githubUserId,
    expiresAt,
  };

  return {
    name: sessionGrantCookieName(input.sessionId),
    value: signPayload(payload, "session-grant"),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: (process.env.APP_BASE_URL || "http://localhost:4512").startsWith("https://"),
      path: "/",
      maxAge,
    },
  };
}

export async function getValidSessionGrant(sessionId: string, githubUserId: number): Promise<ValidSessionGrant | null> {
  const cookieStore = await cookies();
  const payload = verifySignedPayload<SessionGrantPayload>(
    cookieStore.get(sessionGrantCookieName(sessionId))?.value,
    "session-grant",
  );

  if (!isSessionGrantPayload(payload, sessionId, githubUserId) || payload.expiresAt <= Date.now()) {
    return null;
  }

  const inviteIsActive = await validateSessionInviteGrant(
    payload.sessionId,
    payload.inviteId,
    payload.role,
  );
  return inviteIsActive ? payload : null;
}

export async function clearSessionGrantCookies() {
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith(SESSION_GRANT_COOKIE_PREFIX)) {
      cookieStore.delete(cookie.name);
    }
  }
}

function sessionGrantCookieName(sessionId: string) {
  const suffix = createHash("sha256").update(sessionId).digest("hex").slice(0, 24);
  return `${SESSION_GRANT_COOKIE_PREFIX}${suffix}`;
}

function isSessionGrantPayload(
  payload: SessionGrantPayload | null,
  sessionId: string,
  githubUserId: number,
): payload is SessionGrantPayload {
  return Boolean(
    payload
      && payload.version === 1
      && payload.sessionId === sessionId
      && typeof payload.inviteId === "string"
      && (payload.role === "collaborator" || payload.role === "viewer")
      && payload.githubUserId === githubUserId
      && typeof payload.expiresAt === "number",
  );
}

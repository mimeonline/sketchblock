import "server-only";

import { createHash } from "node:crypto";

import { cookies } from "next/headers";

import { signPayload, verifySignedPayload } from "@/lib/server/auth/crypto";
import { getSessionGuest } from "@/lib/server/database/session-guest-store";
import { validateSessionInviteGrant, type SessionInvite } from "@/lib/server/database/session-invite-store";
import { getSession } from "@/lib/server/database/session-store";
import { isSessionClosed } from "@/lib/server/domain/session-lifecycle";

const GUEST_GRANT_COOKIE_PREFIX = "sketchblock_guest_";
const GUEST_GRANT_MAX_AGE_SECONDS = 12 * 60 * 60;

type GuestGrantPayload = {
  version: 1;
  sessionId: string;
  inviteId: string;
  guestId: string;
  expiresAt: number;
};

export type ValidGuestGrant = { guestId: string; displayName: string; inviteId: string };

export function createGuestGrantCookie(input: { sessionId: string; invite: SessionInvite; guestId: string }) {
  const maximumExpiresAt = Date.now() + GUEST_GRANT_MAX_AGE_SECONDS * 1000;
  const inviteExpiresAt = input.invite.expiresAt ? new Date(input.invite.expiresAt).getTime() : maximumExpiresAt;
  const expiresAt = Math.min(maximumExpiresAt, inviteExpiresAt);
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const payload: GuestGrantPayload = {
    version: 1,
    sessionId: input.sessionId,
    inviteId: input.invite.id,
    guestId: input.guestId,
    expiresAt,
  };

  return {
    name: guestGrantCookieName(input.sessionId),
    value: signPayload(payload, "guest-grant"),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: (process.env.APP_BASE_URL || "http://localhost:4512").startsWith("https://"),
      path: "/",
      maxAge,
    },
  };
}

export async function getValidGuestGrant(sessionId: string): Promise<ValidGuestGrant | null> {
  const cookieStore = await cookies();
  const payload = verifySignedPayload<GuestGrantPayload>(
    cookieStore.get(guestGrantCookieName(sessionId))?.value,
    "guest-grant",
  );
  if (
    !payload
    || payload.version !== 1
    || payload.sessionId !== sessionId
    || typeof payload.inviteId !== "string"
    || typeof payload.guestId !== "string"
    || typeof payload.expiresAt !== "number"
    || payload.expiresAt <= Date.now()
  ) {
    return null;
  }

  if (!(await validateSessionInviteGrant(sessionId, payload.inviteId, "viewer"))) return null;
  const session = await getSession(sessionId);
  if (!session || isSessionClosed(session) || !session.allowAnonymousViewers) return null;
  const guest = await getSessionGuest(sessionId, payload.guestId);
  if (!guest || guest.removedAt) return null;

  return { guestId: guest.id, displayName: guest.displayName, inviteId: payload.inviteId };
}

export async function clearGuestGrantCookies() {
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith(GUEST_GRANT_COOKIE_PREFIX)) {
      cookieStore.delete(cookie.name);
    }
  }
}

function guestGrantCookieName(sessionId: string) {
  const suffix = createHash("sha256").update(sessionId).digest("hex").slice(0, 24);
  return `${GUEST_GRANT_COOKIE_PREFIX}${suffix}`;
}

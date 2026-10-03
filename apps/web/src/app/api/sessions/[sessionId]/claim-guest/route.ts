import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { createGuestGrantCookie } from "@/lib/server/auth/guest-grant";
import { consumeAuthAttempt, rejectCrossOriginRequest } from "@/lib/server/auth/request-security";
import { createSessionGuest } from "@/lib/server/database/session-guest-store";
import { validateSessionInvite } from "@/lib/server/database/session-invite-store";
import { getSession } from "@/lib/server/database/session-store";
import { isSessionClosed } from "@/lib/server/domain/session-lifecycle";
import { getRequestId } from "@/lib/server/logging/server-logger";

export const runtime = "nodejs";

const RATE_LIMIT = 30;
const bodySchema = z.object({ invite: z.string().min(1).max(256), displayName: z.string().max(400) });

function normalizeGuestName(value: string) {
  const cleaned = value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, "").trim();
  return cleaned.length >= 1 && cleaned.length <= 40 ? cleaned : null;
}

export async function POST(request: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const originError = rejectCrossOriginRequest(request);
  if (originError) return originError;

  const { sessionId } = await context.params;
  const attempt = consumeAuthAttempt(request, `guest:${sessionId}`, RATE_LIMIT);
  if (!attempt.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body.", code: "invalid_request" }, { status: 400 });
  }
  const displayName = normalizeGuestName(parsed.data.displayName);
  if (!displayName) {
    return NextResponse.json({ error: "Enter a name with 1 to 40 characters.", code: "invalid_name" }, { status: 400 });
  }

  const [session, invite] = await Promise.all([
    getSession(sessionId),
    validateSessionInvite(sessionId, parsed.data.invite),
  ]);
  if (!session || !invite || invite.role !== "viewer") {
    return NextResponse.json({ error: "Valid viewer invitation required.", code: "invalid_invite" }, { status: 404 });
  }
  if (isSessionClosed(session)) {
    return NextResponse.json({ error: "This session has ended.", code: "session_closed" }, { status: 410 });
  }
  if (!session.allowAnonymousViewers) {
    return NextResponse.json({ error: "Guest access is not enabled for this session.", code: "guests_disabled" }, { status: 403 });
  }

  const guest = await createSessionGuest({ sessionId, inviteId: invite.id, displayName });
  await safeRecordAuditEvent({
    actorId: null,
    actorUsername: `guest-${guest.id}`,
    actorRole: "anonymous",
    action: "session.guest.join",
    targetType: "session",
    targetId: sessionId,
    sessionId,
    outcome: "success",
    requestId: getRequestId(request),
    metadata: { guestId: guest.id, inviteId: invite.id },
  });

  const response = NextResponse.json({ ok: true, redirect: `/join/${sessionId}` });
  const cookie = createGuestGrantCookie({ sessionId, invite, guestId: guest.id });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}

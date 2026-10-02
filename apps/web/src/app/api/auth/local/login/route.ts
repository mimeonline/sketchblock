import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { setOwnerAuthCookie } from "@/lib/server/auth/owner-session";
import { PasswordHashBusyError, verifyPassword, verifyPasswordAgainstDummy } from "@/lib/server/auth/password";
import { clearGitHubAccessTokenCookie, clearParticipantAndOAuthCookies } from "@/lib/server/auth/session";
import {
  clearAuthAttempts,
  consumeAuthAttempt,
  hasValidRequestOrigin,
} from "@/lib/server/auth/request-security";
import {
  getAppUserByUsername,
  markAppUserLogin,
} from "@/lib/server/database/user-store";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  let attemptedUsername = "anonymous";
  try {
    if (!hasValidRequestOrigin(request)) {
      return NextResponse.json({ error: "Ungültiger Request-Ursprung." }, { status: 403 });
    }
    const input = loginSchema.parse(await request.json());
    attemptedUsername = input.username.toLowerCase();
    const attempt = consumeAuthAttempt(request, input.username);
    if (!attempt.allowed) {
      return NextResponse.json(
        { error: "Zu viele Anmeldeversuche. Bitte warte kurz." },
        { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } },
      );
    }
    const user = await getAppUserByUsername(input.username);
    const valid = user && user.status === "active"
      ? await verifyPassword(input.password, user.passwordHash)
      : await verifyPasswordAgainstDummy(input.password);
    if (!user || user.status !== "active" || !valid) {
      await safeRecordAuditEvent({ actorUsername: attemptedUsername, actorRole: "anonymous", action: "auth.login", targetType: "user", outcome: "failure", requestId });
      return NextResponse.json({ error: "Benutzername oder Passwort ist ungültig." }, { status: 401 });
    }

    await markAppUserLogin(user.id);
    clearAuthAttempts(request, input.username);
    await clearGitHubAccessTokenCookie();
    await clearParticipantAndOAuthCookies();
    await setOwnerAuthCookie(user.id);
    await safeRecordAuditEvent({ actorId: user.id, actorUsername: user.username, actorRole: user.role, action: "auth.login", targetType: "user", targetId: user.id, outcome: "success", requestId });
    return NextResponse.json({
      ok: true,
      mustChangePassword: user.mustChangePassword,
      redirectTo: user.mustChangePassword ? "/change-password" : "/",
    });
  } catch (error) {
    if (error instanceof PasswordHashBusyError) {
      return NextResponse.json(
        { error: "Server ausgelastet. Bitte versuche es gleich erneut." },
        { status: 429, headers: { "Retry-After": "5" } },
      );
    }
    await safeRecordAuditEvent({ actorUsername: attemptedUsername, actorRole: "anonymous", action: "auth.login", targetType: "user", outcome: "failure", requestId });
    return NextResponse.json({ error: "Benutzername oder Passwort ist ungültig." }, { status: 401 });
  }
}

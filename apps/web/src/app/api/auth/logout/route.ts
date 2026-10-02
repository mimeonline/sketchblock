import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { clearAuthCookie, getAppBaseUrl } from "@/lib/server/auth/session";
import { clearOwnerAuthCookie, getCurrentOwner } from "@/lib/server/auth/owner-session";
import { clearGuestGrantCookies } from "@/lib/server/auth/guest-grant";
import { clearSessionGrantCookies } from "@/lib/server/auth/session-grant";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";
import { rejectCrossOriginRequest } from "@/lib/server/auth/request-security";

export const runtime = "nodejs";

async function logout(request?: NextRequest) {
  const requestId = request ? getRequestId(request) : randomUUID();
  const user = await getCurrentOwner();
  await clearAuthCookie();
  await clearOwnerAuthCookie();
  await clearSessionGrantCookies();
  await clearGuestGrantCookies();
  if (user) await safeRecordAuditEvent({ actorId: user.id, actorUsername: user.username, actorRole: user.role, action: "auth.logout", targetType: "user", targetId: user.id, outcome: "success", requestId });
  return NextResponse.redirect(new URL("/login", getAppBaseUrl()));
}

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginRequest(request);
  if (originError) return originError;

  return logout(request);
}

export async function GET() {
  return NextResponse.redirect(new URL("/login", getAppBaseUrl()));
}

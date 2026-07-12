import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { clearAuthCookie, getAppBaseUrl } from "@/lib/server/auth/session";
import { clearOwnerAuthCookie, getCurrentOwner } from "@/lib/server/auth/owner-session";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

export const runtime = "nodejs";

async function logout(request?: NextRequest) {
  const requestId = request ? getRequestId(request) : randomUUID();
  const user = await getCurrentOwner();
  await clearAuthCookie();
  await clearOwnerAuthCookie();
  if (user) await safeRecordAuditEvent({ actorId: user.id, actorUsername: user.username, actorRole: user.role, action: "auth.logout", targetType: "user", targetId: user.id, outcome: "success", requestId });
  return NextResponse.redirect(new URL("/login", getAppBaseUrl()));
}

export async function POST(request?: NextRequest) { return logout(request); }
export async function GET(request?: NextRequest) { return logout(request); }

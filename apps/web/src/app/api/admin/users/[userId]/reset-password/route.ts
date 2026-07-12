import { NextRequest, NextResponse } from "next/server";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { requireInstanceOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { hashPassword } from "@/lib/server/auth/password";
import { hasValidRequestOrigin } from "@/lib/server/auth/request-security";
import { generateStartPassword } from "@/lib/server/auth/start-password";
import { getAppPostgresPool } from "@/lib/server/database/postgres";
import { getAppUserById, replaceAppUserPassword } from "@/lib/server/database/user-store";
import { revokeAllUserSessions } from "@/lib/server/database/user-session-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const requestId = getRequestId(request);
  const auth = await requireInstanceOwnerApiAuth();
  if (auth.response) return auth.response;
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Ungültiger Request-Ursprung." }, { status: 403 });
  const { userId } = await context.params;
  const target = await getAppUserById(userId);
  if (!target) return NextResponse.json({ error: "User wurde nicht gefunden." }, { status: 404 });
  if (target.role === "instance_owner") return NextResponse.json({ error: "Der Instance-Owner-Zugang wird hier nicht zurückgesetzt." }, { status: 409 });
  const startPassword = generateStartPassword();
  const client = await getAppPostgresPool().connect();
  try {
    await client.query("BEGIN");
    await replaceAppUserPassword({ id: userId, passwordHash: await hashPassword(startPassword), mustChangePassword: true, client });
    await revokeAllUserSessions(userId, client);
    await client.query("COMMIT");
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: "instance_owner", action: "user.password.reset", targetType: "user", targetId: userId, outcome: "success", requestId });
    return NextResponse.json({ startPassword });
  } catch {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Zugang konnte nicht zurückgesetzt werden." }, { status: 500 });
  } finally { client.release(); }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { clearOwnerAuthCookie, getCurrentOwner, setOwnerAuthCookie } from "@/lib/server/auth/owner-session";
import { hashPassword, verifyPassword } from "@/lib/server/auth/password";
import { hasValidRequestOrigin } from "@/lib/server/auth/request-security";
import { getAppPostgresPool } from "@/lib/server/database/postgres";
import { getAppUserById, replaceAppUserPassword } from "@/lib/server/database/user-store";
import { revokeAllUserSessions } from "@/lib/server/database/user-session-store";

export const runtime = "nodejs";
const schema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) });

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const authUser = await getCurrentOwner();
  if (!authUser) return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Ungültiger Request-Ursprung." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    const user = await getAppUserById(authUser.id);
    if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Das aktuelle Passwort ist ungültig." }, { status: 401 });
    }
    const client = await getAppPostgresPool().connect();
    try {
      await client.query("BEGIN");
      await replaceAppUserPassword({ id: user.id, passwordHash: await hashPassword(input.newPassword), mustChangePassword: false, client });
      await revokeAllUserSessions(user.id, client);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    await clearOwnerAuthCookie();
    await setOwnerAuthCookie(user.id);
    await safeRecordAuditEvent({ actorId: user.id, actorUsername: user.username, actorRole: user.role, action: "user.password.change", targetType: "user", targetId: user.id, outcome: "success", requestId });
    return NextResponse.json({ ok: true, redirectTo: "/" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Das neue Passwort erfüllt die Anforderungen nicht." : "Passwort konnte nicht geändert werden." }, { status: 400 });
  }
}

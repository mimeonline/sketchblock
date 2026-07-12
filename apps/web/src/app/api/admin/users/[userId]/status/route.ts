import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { requireInstanceOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { hasValidRequestOrigin } from "@/lib/server/auth/request-security";
import { getAppPostgresPool } from "@/lib/server/database/postgres";
import { getAppUserById, setAppUserStatus } from "@/lib/server/database/user-store";
import { revokeAllUserSessions } from "@/lib/server/database/user-session-store";

export const runtime = "nodejs";
const schema = z.object({ status: z.enum(["active", "disabled"]) });

export async function PATCH(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const requestId = getRequestId(request);
  const auth = await requireInstanceOwnerApiAuth();
  if (auth.response) return auth.response;
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Ungültiger Request-Ursprung." }, { status: 403 });
  try {
    const { userId } = await context.params;
    const input = schema.parse(await request.json());
    const target = await getAppUserById(userId);
    if (!target) return NextResponse.json({ error: "User wurde nicht gefunden." }, { status: 404 });
    if (target.role === "instance_owner") return NextResponse.json({ error: "Der Instance Owner kann nicht deaktiviert werden." }, { status: 409 });
    const client = await getAppPostgresPool().connect();
    try {
      await client.query("BEGIN");
      const user = await setAppUserStatus(userId, input.status, client);
      if (input.status === "disabled") await revokeAllUserSessions(userId, client);
      await client.query("COMMIT");
      if (!user) return NextResponse.json({ error: "User wurde nicht gefunden." }, { status: 404 });
      await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: "instance_owner", action: input.status === "active" ? "user.activate" : "user.disable", targetType: "user", targetId: userId, outcome: "success", requestId });
      return NextResponse.json({ user: {
        id: user.id, username: user.username, displayName: user.displayName,
        role: user.role, status: user.status, mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt, updatedAt: user.updatedAt, lastLoginAt: user.lastLoginAt,
      } });
    } catch (error) {
      await client.query("ROLLBACK"); throw error;
    } finally { client.release(); }
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Ungültiger Status." : "Status konnte nicht geändert werden." }, { status: 400 });
  }
}

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { verifyBootstrapToken } from "@/lib/server/auth/bootstrap";
import { hashPassword } from "@/lib/server/auth/password";
import { setOwnerAuthCookie } from "@/lib/server/auth/owner-session";
import { consumeAuthAttempt, hasValidRequestOrigin } from "@/lib/server/auth/request-security";
import {
  createInstanceOwner,
  hasInstanceOwner,
} from "@/lib/server/database/instance-owner-store";

export const runtime = "nodejs";

const setupSchema = z.object({
  bootstrapToken: z.string().min(24).max(512),
  username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(12).max(128),
});

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    if (!hasValidRequestOrigin(request)) {
      return NextResponse.json({ error: "Ungültiger Request-Ursprung." }, { status: 403 });
    }
    if (await hasInstanceOwner()) {
      return NextResponse.json({ error: "Sketchblock ist bereits eingerichtet." }, { status: 409 });
    }

    const input = setupSchema.parse(await request.json());
    const attempt = consumeAuthAttempt(request, "first-run-setup", 5);
    if (!attempt.allowed) {
      return NextResponse.json(
        { error: "Zu viele Setup-Versuche. Bitte warte kurz." },
        { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } },
      );
    }
    if (!verifyBootstrapToken(input.bootstrapToken)) {
      return NextResponse.json({ error: "Der Setup-Code ist ungültig." }, { status: 403 });
    }

    const passwordHash = await hashPassword(input.password);
    const owner = await createInstanceOwner({
      id: randomUUID(),
      username: input.username,
      passwordHash,
    });
    if (!owner) {
      return NextResponse.json({ error: "Sketchblock wurde bereits eingerichtet." }, { status: 409 });
    }

    await setOwnerAuthCookie(owner.id);
    await safeRecordAuditEvent({ actorId: owner.id, actorUsername: owner.username, actorRole: "instance_owner", action: "instance.setup", targetType: "instance", targetId: "sketchblock", outcome: "success", requestId });
    return NextResponse.json({ ok: true, redirectTo: "/repositories" }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof z.ZodError ? "Prüfe Benutzername, Setup-Code und Passwort." : "Setup fehlgeschlagen." },
      { status: 400 },
    );
  }
}

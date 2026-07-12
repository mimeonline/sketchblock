import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { getRequestId } from "@/lib/server/logging/server-logger";

import { requireInstanceOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { hashPassword } from "@/lib/server/auth/password";
import { hasValidRequestOrigin } from "@/lib/server/auth/request-security";
import { generateStartPassword } from "@/lib/server/auth/start-password";
import { createAppUser, listAppUsers, type AppUser } from "@/lib/server/database/user-store";

export const runtime = "nodejs";

const createSchema = z.object({
  username: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/),
  displayName: z.string().trim().min(1).max(120).optional(),
});

const publicUser = (user: AppUser) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  role: user.role,
  status: user.status,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt,
});

export async function GET() {
  const auth = await requireInstanceOwnerApiAuth();
  if (auth.response) return auth.response;
  return NextResponse.json({ users: (await listAppUsers()).map(publicUser) });
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const auth = await requireInstanceOwnerApiAuth();
  if (auth.response) return auth.response;
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: "Ungültiger Request-Ursprung." }, { status: 403 });
  try {
    const input = createSchema.parse(await request.json());
    const startPassword = generateStartPassword();
    const user = await createAppUser({
      id: randomUUID(), username: input.username, displayName: input.displayName,
      passwordHash: await hashPassword(startPassword), role: "user", mustChangePassword: true,
    });
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: "instance_owner", action: "user.create", targetType: "user", targetId: user.id, outcome: "success", requestId });
    return NextResponse.json({ user: publicUser(user), startPassword }, { status: 201 });
  } catch (error) {
    await safeRecordAuditEvent({ actorId: auth.owner.id, actorUsername: auth.owner.username, actorRole: "instance_owner", action: "user.create", targetType: "user", outcome: "failure", requestId });
    if (isUniqueViolation(error)) return NextResponse.json({ error: "Der Benutzername ist bereits vergeben." }, { status: 409 });
    return NextResponse.json({ error: error instanceof z.ZodError ? "Prüfe Benutzername und Anzeigename." : "User konnte nicht angelegt werden." }, { status: 400 });
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

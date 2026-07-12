import { NextRequest, NextResponse } from "next/server";

import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import {
  activateOwnedRepository,
  disconnectOwnedRepository,
} from "@/lib/server/database/repository-store";
import { getRequestId, withRequestId } from "@/lib/server/logging/server-logger";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ repositoryId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response) {
      return withRequestId(auth.response, requestId);
    }
    if (!auth.owner) {
      return withRequestId(NextResponse.json({ error: "Login required." }, { status: 401 }), requestId);
    }
    const { repositoryId } = await context.params;
    const repository = await activateOwnedRepository(auth.owner.id, repositoryId);
    await safeRecordAuditEvent({
      actorId: auth.owner.id,
      actorUsername: auth.owner.username,
      actorRole: auth.owner.role,
      action: "repository.switch",
      targetType: "repository",
      targetId: repository.id,
      outcome: "success",
      requestId,
    });
    return withRequestId(NextResponse.json({ repository }), requestId);
  } catch (error) {
    return withRequestId(
      NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 }),
      requestId,
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response) {
      return withRequestId(auth.response, requestId);
    }
    if (!auth.owner) {
      return withRequestId(NextResponse.json({ error: "Login required." }, { status: 401 }), requestId);
    }
    const { repositoryId } = await context.params;
    await disconnectOwnedRepository(auth.owner.id, repositoryId);
    await safeRecordAuditEvent({
      actorId: auth.owner.id,
      actorUsername: auth.owner.username,
      actorRole: auth.owner.role,
      action: "repository.disconnect",
      targetType: "repository",
      targetId: repositoryId,
      outcome: "success",
      requestId,
    });
    return withRequestId(NextResponse.json({ success: true }), requestId);
  } catch (error) {
    return withRequestId(
      NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400 }),
      requestId,
    );
  }
}

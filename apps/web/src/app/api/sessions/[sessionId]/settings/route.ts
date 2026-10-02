import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";
import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { rejectCrossOriginRequest } from "@/lib/server/auth/request-security";
import { getRequestId } from "@/lib/server/logging/server-logger";
import {
  getOwnedSession,
  setAllowAnonymousViewers,
  setParticipantDownload,
} from "@/lib/server/database/session-store";

export const runtime = "nodejs";

type Context = { params: Promise<{ sessionId: string }> };

const settingsSchema = z
  .object({ participantDownload: z.boolean().optional(), allowAnonymousViewers: z.boolean().optional() })
  .refine((value) => value.participantDownload !== undefined || value.allowAnonymousViewers !== undefined);

export async function PATCH(request: NextRequest, { params }: Context) {
  const originError = rejectCrossOriginRequest(request);
  if (originError) return originError;

  const auth = await requireOwnerApiAuth();
  if (auth.response || !auth.owner) {
    return auth.response;
  }

  const { sessionId } = await params;
  const userId = auth.owner.id === "dev-owner" ? null : auth.owner.id;
  const owned = await getOwnedSession(sessionId, userId);
  if (!owned) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const body = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request body.", code: "invalid_request" }, { status: 400 });
  }

  let session = owned;
  if (body.data.participantDownload !== undefined) {
    const updated = await setParticipantDownload(sessionId, body.data.participantDownload, userId);
    if (!updated) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    session = updated;
  }
  if (body.data.allowAnonymousViewers !== undefined) {
    const updated = await setAllowAnonymousViewers(sessionId, body.data.allowAnonymousViewers, userId);
    if (!updated) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    session = updated;
    await safeRecordAuditEvent({
      actorId: auth.owner.id,
      actorUsername: auth.owner.username,
      actorRole: "instance_owner",
      action: body.data.allowAnonymousViewers ? "session.guests.enable" : "session.guests.disable",
      targetType: "session",
      targetId: sessionId,
      sessionId,
      outcome: "success",
      requestId: getRequestId(request),
    });
  }
  return NextResponse.json({ session });
}

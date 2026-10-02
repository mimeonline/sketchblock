import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { rejectCrossOriginRequest } from "@/lib/server/auth/request-security";
import { getOwnedSession, setParticipantDownload } from "@/lib/server/database/session-store";

export const runtime = "nodejs";

type Context = { params: Promise<{ sessionId: string }> };

const settingsSchema = z.object({ participantDownload: z.boolean() });

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

  const session = await setParticipantDownload(sessionId, body.data.participantDownload, userId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  return NextResponse.json({ session });
}

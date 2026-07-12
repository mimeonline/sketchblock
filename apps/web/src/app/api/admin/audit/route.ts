import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listAuditEvents } from "@/lib/server/audit/audit-service";
import { requireInstanceOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { getRequestId, withRequestId } from "@/lib/server/logging/server-logger";

export const runtime = "nodejs";

const querySchema = z.object({
  actorId: z.string().uuid().optional(),
  action: z.string().trim().min(1).max(128).regex(/^[a-z0-9._:-]+$/i).optional(),
  outcome: z.enum(["success", "failure"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const auth = await requireInstanceOwnerApiAuth();
  if (auth.response || !auth.owner) return withRequestId(auth.response!, requestId);
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return withRequestId(NextResponse.json({ error: "Ungültige Audit-Filter." }, { status: 400 }), requestId);
  }
  const result = await listAuditEvents(parsed.data);
  return withRequestId(NextResponse.json({ ...result, limit: parsed.data.limit, offset: parsed.data.offset }), requestId);
}

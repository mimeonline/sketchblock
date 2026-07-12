import { NextRequest, NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/server/audit/audit-service";
import { requireInstanceOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { getSystemDiagnostics } from "@/lib/server/diagnostics/system-diagnostics";
import { getRequestId, withRequestId } from "@/lib/server/logging/server-logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const auth = await requireInstanceOwnerApiAuth();
  if (auth.response || !auth.owner) return withRequestId(auth.response!, requestId);

  const diagnostics = await getSystemDiagnostics();
  await recordAuditEvent({
    actorId: auth.owner.id,
    actorUsername: auth.owner.username,
    actorRole: "instance_owner",
    action: "admin.diagnostics.view",
    targetType: "system",
    targetId: "sketchblock",
    outcome: "success",
    requestId,
  });
  return withRequestId(NextResponse.json({ diagnostics }), requestId);
}

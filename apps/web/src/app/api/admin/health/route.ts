import { NextResponse } from "next/server";

import { requireInstanceOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { summarizeSystemHealth } from "@/lib/server/diagnostics/system-health";
import { getSystemDiagnostics } from "@/lib/server/diagnostics/system-diagnostics";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireInstanceOwnerApiAuth();
  if (auth.response || !auth.owner) return auth.response!;

  const diagnostics = await getSystemDiagnostics();
  return NextResponse.json({ health: summarizeSystemHealth(diagnostics), checkedAt: diagnostics.checkedAt });
}

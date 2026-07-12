import { NextResponse } from "next/server";

import { isDemoAuthMode } from "@/lib/server/auth/auth-mode";
import { requireInstanceOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { resetDemoDrawing } from "@/lib/server/demo/demo-store";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireInstanceOwnerApiAuth();
  if (auth.response || !auth.owner) return auth.response!;
  if (!isDemoAuthMode()) {
    return NextResponse.json({ error: "Demo mode is not active." }, { status: 409 });
  }
  await resetDemoDrawing();
  return NextResponse.json({ reset: true });
}

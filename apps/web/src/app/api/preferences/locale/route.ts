import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rejectCrossOriginRequest } from "@/lib/server/auth/request-security";

const schema = z.object({ locale: z.enum(["en", "de"]) });

export async function POST(request: NextRequest) {
  const originError = rejectCrossOriginRequest(request);
  if (originError) return originError;

  const { locale } = schema.parse(await request.json());
  const response = NextResponse.json({ locale });
  response.cookies.set("sketchblock_locale", locale, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { getAppBaseUrl } from "@/lib/server/auth/session";

type AttemptWindow = { count: number; resetAt: number };
const attempts = new Map<string, AttemptWindow>();
const WINDOW_MS = 15 * 60 * 1000;

export function hasValidRequestOrigin(request: Pick<Request, "headers">) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(getAppBaseUrl()).origin;
  } catch {
    return false;
  }
}

/**
 * CSRF guard for state-changing route handlers: returns a 403 response unless the
 * request carries an Origin header that matches APP_BASE_URL.
 */
export function rejectCrossOriginRequest(request: Pick<Request, "headers">): NextResponse | null {
  if (hasValidRequestOrigin(request)) return null;
  return NextResponse.json({ error: "Invalid request origin.", code: "invalid_origin" }, { status: 403 });
}

export function isProxyTrusted() {
  const value = process.env.SKETCHBLOCK_TRUST_PROXY?.trim().toLowerCase();
  return value === "true" || value === "1";
}

export function getClientAddress(request: Pick<NextRequest, "headers">) {
  if (!isProxyTrusted()) return "direct";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "direct";
}

export function consumeAuthAttempt(request: NextRequest, subject: string, limit = 10) {
  const now = Date.now();
  if (attempts.size > 10_000) {
    for (const [storedKey, window] of attempts) {
      if (window.resetAt <= now) attempts.delete(storedKey);
    }
  }
  const address = getClientAddress(request);
  const key = `${address}:${subject.toLowerCase()}`;
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearAuthAttempts(request: NextRequest, subject: string) {
  const address = getClientAddress(request);
  attempts.delete(`${address}:${subject.toLowerCase()}`);
}

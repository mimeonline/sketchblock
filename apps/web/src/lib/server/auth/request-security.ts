import "server-only";

import type { NextRequest } from "next/server";

import { getAppBaseUrl } from "@/lib/server/auth/session";

type AttemptWindow = { count: number; resetAt: number };
const attempts = new Map<string, AttemptWindow>();
const WINDOW_MS = 15 * 60 * 1000;

export function hasValidRequestOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(getAppBaseUrl()).origin;
  } catch {
    return false;
  }
}

export function consumeAuthAttempt(request: NextRequest, subject: string, limit = 10) {
  const now = Date.now();
  if (attempts.size > 10_000) {
    for (const [storedKey, window] of attempts) {
      if (window.resetAt <= now) attempts.delete(storedKey);
    }
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
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
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  attempts.delete(`${address}:${subject.toLowerCase()}`);
}

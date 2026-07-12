import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { getDevAuthUser, isDemoAuthMode, isDevAuthMode } from "@/lib/server/auth/auth-mode";
import {
  decryptSecret,
  encryptSecret,
  signPayload,
  verifySignedPayload,
} from "@/lib/server/auth/crypto";
import {
  hasRepositoryPermission,
  type GitHubRepositoryPermission,
} from "@/lib/server/auth/permissions";

const AUTH_COOKIE = "sketchblock_auth";
const GITHUB_ACCESS_COOKIE = "sketchblock_github_access";
const OAUTH_STATE_COOKIE = "sketchblock_oauth_state";
const AUTH_MAX_AGE_SECONDS = 60 * 60 * 8;
const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

export type AuthUser = {
  id: number;
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  permission: GitHubRepositoryPermission;
  expiresAt: number;
};

export type OAuthState = {
  state: string;
  returnTo: string;
  intent: "participant" | "owner_connect";
  expiresAt: number;
};

export function getAppBaseUrl() {
  return (process.env.APP_BASE_URL || "http://localhost:4512").replace(/\/$/, "");
}

export function sanitizeReturnTo(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/sessions";
  }

  return value;
}

export function getLoginPath(returnTo?: string | null, error?: string) {
  const params = new URLSearchParams({ returnTo: sanitizeReturnTo(returnTo) });

  if (error) {
    params.set("error", error);
  }

  return `/login?${params.toString()}`;
}

export async function getCurrentAuthUser(): Promise<AuthUser | null> {
  const storedUser = await getStoredAuthUser();
  if (isDevAuthMode()) {
    return isDemoAuthMode() ? getDevAuthUser() : storedUser || getDevAuthUser();
  }

  return storedUser;
}

export async function getStoredAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const payload = verifySignedPayload<AuthUser>(cookieStore.get(AUTH_COOKIE)?.value);

  if (!payload || payload.expiresAt < Date.now()) {
    return null;
  }

  return payload;
}

export async function setAuthCookie(user: Omit<AuthUser, "expiresAt">) {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + AUTH_MAX_AGE_SECONDS * 1000;

  cookieStore.set(AUTH_COOKIE, signPayload({ ...user, expiresAt }), {
    httpOnly: true,
    sameSite: "lax",
    secure: getAppBaseUrl().startsWith("https://"),
    path: "/",
    maxAge: AUTH_MAX_AGE_SECONDS,
  });
}

export async function setGitHubAccessTokenCookie(accessToken: string) {
  const cookieStore = await cookies();

  cookieStore.set(GITHUB_ACCESS_COOKIE, encryptSecret(accessToken), {
    httpOnly: true,
    sameSite: "lax",
    secure: getAppBaseUrl().startsWith("https://"),
    path: "/",
    maxAge: AUTH_MAX_AGE_SECONDS,
  });
}

export async function getGitHubAccessToken() {
  const cookieStore = await cookies();
  return decryptSecret(cookieStore.get(GITHUB_ACCESS_COOKIE)?.value);
}

export async function requireGitHubAccessToken() {
  const accessToken = await getGitHubAccessToken();

  if (!accessToken) {
    throw new Error("GitHub repository access requires a fresh GitHub OAuth login.");
  }

  return accessToken;
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  cookieStore.delete(GITHUB_ACCESS_COOKIE);
  cookieStore.delete(OAUTH_STATE_COOKIE);
}

export async function setOAuthStateCookie(input: Pick<OAuthState, "state" | "returnTo" | "intent">) {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + OAUTH_STATE_MAX_AGE_SECONDS * 1000;

  cookieStore.set(OAUTH_STATE_COOKIE, signPayload({ ...input, expiresAt }), {
    httpOnly: true,
    sameSite: "lax",
    secure: getAppBaseUrl().startsWith("https://"),
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });
}

export async function consumeOAuthStateCookie(): Promise<OAuthState | null> {
  const cookieStore = await cookies();
  const payload = verifySignedPayload<OAuthState>(cookieStore.get(OAUTH_STATE_COOKIE)?.value);
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!payload || payload.expiresAt < Date.now()) {
    return null;
  }

  return payload;
}

export async function requirePageAuth(
  returnTo: string,
  minimumPermission: GitHubRepositoryPermission = "read",
) {
  const user = await getCurrentAuthUser();

  if (!user) {
    redirect(getLoginPath(returnTo));
  }

  if (!hasRepositoryPermission(user.permission, minimumPermission)) {
    redirect(getLoginPath(returnTo, "repository_permission"));
  }

  return user;
}

export async function requireApiAuth(minimumPermission: GitHubRepositoryPermission = "read") {
  const user = await getCurrentAuthUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "GitHub login required." }, { status: 401 }),
    };
  }

  if (!hasRepositoryPermission(user.permission, minimumPermission)) {
    return {
      user: null,
      response: NextResponse.json({ error: "GitHub repository permission denied." }, { status: 403 }),
    };
  }

  return { user, response: null };
}

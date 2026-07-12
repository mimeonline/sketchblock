import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { getDevAuthUser, isDemoAuthMode, isDevAuthMode } from "@/lib/server/auth/auth-mode";
import { signPayload, verifySignedPayload } from "@/lib/server/auth/crypto";
import { getAppBaseUrl, getStoredAuthUser, sanitizeReturnTo } from "@/lib/server/auth/session";
import {
  getInstanceOwnerById,
  hasInstanceOwner,
  type InstanceOwner,
} from "@/lib/server/database/instance-owner-store";
import {
  getAppUserById,
  getAppUserGitHubIdentity,
  getInstanceOwnerAppUser,
  type AppUserRole,
} from "@/lib/server/database/user-store";
import {
  createUserSession,
  getActiveUserSession,
  revokeUserSession,
} from "@/lib/server/database/user-session-store";

const OWNER_AUTH_COOKIE = "sketchblock_owner_auth";
const OWNER_AUTH_MAX_AGE_SECONDS = 60 * 60 * 8;

type OwnerCookiePayload = {
  sessionId: string;
  token: string;
  expiresAt: number;
};

export type AuthenticatedOwner = Omit<InstanceOwner, "passwordHash"> & {
  displayName: string | null;
  role: AppUserRole;
  mustChangePassword: boolean;
};

export type LinkedOwnerGitHubIdentity = {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string | null;
};

export async function getCurrentOwner(): Promise<AuthenticatedOwner | null> {
  if (isDevAuthMode()) {
    const storedUser = await getStoredAuthUser();
    const devUser = isDemoAuthMode() ? getDevAuthUser() : storedUser || getDevAuthUser();
    if (isDemoAuthMode()) {
      const now = new Date().toISOString();
      return {
        id: "demo-owner",
        username: devUser.login,
        githubUserId: -1,
        githubLogin: devUser.login,
        githubName: devUser.name || devUser.login,
        githubAvatarUrl: null,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        displayName: devUser.name || devUser.login,
        role: "instance_owner",
        mustChangePassword: false,
      };
    }
    const persistedOwner = await getInstanceOwnerAppUser().catch(() => null);
    const persistedGitHub = persistedOwner
      ? await getAppUserGitHubIdentity(persistedOwner.id).catch(() => null)
      : null;
    const now = new Date().toISOString();
    if (persistedOwner) {
      return {
        id: persistedOwner.id,
        username: persistedOwner.username,
        githubUserId: storedUser?.id ?? persistedGitHub?.githubUserId ?? devUser.id,
        githubLogin: storedUser?.login ?? persistedGitHub?.login ?? devUser.login,
        githubName: storedUser?.name ?? persistedGitHub?.name ?? devUser.name ?? devUser.login,
        githubAvatarUrl: storedUser?.avatarUrl ?? persistedGitHub?.avatarUrl ?? devUser.avatarUrl ?? null,
        createdAt: persistedOwner.createdAt,
        updatedAt: persistedOwner.updatedAt,
        lastLoginAt: persistedOwner.lastLoginAt,
        displayName: persistedOwner.displayName,
        role: "instance_owner",
        mustChangePassword: false,
      };
    }
    return {
      id: "dev-owner",
      username: devUser.login,
      githubUserId: devUser.id,
      githubLogin: devUser.login,
      githubName: devUser.name || devUser.login,
      githubAvatarUrl: devUser.avatarUrl || null,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      displayName: devUser.name || devUser.login,
      role: "instance_owner",
      mustChangePassword: false,
    };
  }

  const cookieStore = await cookies();
  const payload = verifySignedPayload<OwnerCookiePayload>(cookieStore.get(OWNER_AUTH_COOKIE)?.value);
  if (!payload || payload.expiresAt < Date.now()) {
    return null;
  }

  const session = await getActiveUserSession(payload.sessionId, payload.token);
  const user = session ? await getAppUserById(session.user_id) : null;
  if (!user || user.status !== "active") {
    return null;
  }
  const [owner, github] = await Promise.all([
    user.role === "instance_owner" ? getInstanceOwnerById(user.id) : Promise.resolve(null),
    getAppUserGitHubIdentity(user.id),
  ]);

  return {
    id: user.id,
    username: user.username,
    githubUserId: github?.githubUserId ?? owner?.githubUserId ?? null,
    githubLogin: github?.login ?? owner?.githubLogin ?? null,
    githubName: github?.name ?? owner?.githubName ?? null,
    githubAvatarUrl: github?.avatarUrl ?? owner?.githubAvatarUrl ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function setOwnerAuthCookie(ownerId: string) {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + OWNER_AUTH_MAX_AGE_SECONDS * 1000;
  const sessionId = randomUUID();
  const token = randomBytes(32).toString("base64url");
  await createUserSession({ id: sessionId, userId: ownerId, token, expiresAt: new Date(expiresAt) });
  cookieStore.set(OWNER_AUTH_COOKIE, signPayload({ sessionId, token, expiresAt }), {
    httpOnly: true,
    sameSite: "lax",
    secure: getAppBaseUrl().startsWith("https://"),
    path: "/",
    maxAge: OWNER_AUTH_MAX_AGE_SECONDS,
  });
}

export async function clearOwnerAuthCookie() {
  const cookieStore = await cookies();
  const payload = verifySignedPayload<OwnerCookiePayload>(cookieStore.get(OWNER_AUTH_COOKIE)?.value);
  if (payload) await revokeUserSession(payload.sessionId);
  cookieStore.delete(OWNER_AUTH_COOKIE);
}

export function getOwnerLoginPath(returnTo?: string | null, error?: string) {
  const params = new URLSearchParams({ returnTo: sanitizeReturnTo(returnTo) });
  if (error) params.set("error", error);
  return `/login?${params.toString()}`;
}

export async function requireOwnerPageAuth(returnTo: string) {
  if (!isDevAuthMode() && !(await hasInstanceOwner())) {
    redirect("/setup");
  }

  const owner = await getCurrentOwner();
  if (!owner) {
    redirect(getOwnerLoginPath(returnTo));
  }
  if (owner.mustChangePassword && returnTo !== "/change-password") {
    redirect("/change-password");
  }
  return owner;
}

export async function requireInstanceOwnerPageAuth(returnTo: string) {
  const user = await requireOwnerPageAuth(returnTo);
  if (user.role !== "instance_owner") {
    redirect("/");
  }
  return user;
}

type LocalApiAuthResult =
  | { user: AuthenticatedOwner; response: null }
  | { user: null; response: NextResponse };

type OwnerApiAuthResult =
  | { owner: AuthenticatedOwner; response: null }
  | { owner: null; response: NextResponse };

export async function requireLocalApiAuth(): Promise<LocalApiAuthResult> {
  const user = await getCurrentOwner();
  if (!user) return { user: null, response: NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 }) };
  if (user.mustChangePassword) {
    return { user: null, response: NextResponse.json({ error: "Passwortwechsel erforderlich.", code: "password_change_required" }, { status: 403 }) };
  }
  return { user, response: null };
}

export async function requireInstanceOwnerApiAuth(): Promise<OwnerApiAuthResult> {
  const auth = await requireLocalApiAuth();
  if (auth.response) return { owner: null, response: auth.response };
  if (auth.user.role !== "instance_owner") {
    return { owner: null, response: NextResponse.json({ error: "Instance-Owner-Rechte erforderlich." }, { status: 403 }) };
  }
  return { owner: auth.user, response: null };
}

export async function requireOwnerApiAuth(): Promise<OwnerApiAuthResult> {
  if (!isDevAuthMode() && !(await hasInstanceOwner())) {
    return {
      owner: null,
      response: NextResponse.json({ error: "Sketchblock setup required." }, { status: 503 }),
    };
  }

  const auth = await requireLocalApiAuth();
  return auth.response
    ? { owner: null, response: auth.response }
    : { owner: auth.user, response: null };
}

export function requireLinkedOwnerGitHub(owner: AuthenticatedOwner): LinkedOwnerGitHubIdentity {
  if (!owner.githubUserId || !owner.githubLogin) {
    throw new Error("Connect the Instance Owner to GitHub first.");
  }
  return {
    id: owner.githubUserId,
    login: owner.githubLogin,
    name: owner.githubName,
    avatarUrl: owner.githubAvatarUrl,
  };
}

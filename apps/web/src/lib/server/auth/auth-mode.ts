import "server-only";

import type { AuthUser } from "@/lib/server/auth/session";
import type { GitHubRepositoryPermission } from "@/lib/server/auth/permissions";

export type SketchblockAuthMode = "github" | "dev" | "demo";
type SketchblockDeploymentEnv = "local" | "production";

const DEFAULT_DEV_USER_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const repositoryPermissions = ["read", "triage", "write", "maintain", "admin"] as const;

function readAuthMode() {
  const configuredMode = process.env.SKETCHBLOCK_AUTH_MODE?.trim();
  const mode = configuredMode || (readDeploymentEnv() === "local" ? "dev" : "github");

  if (mode !== "github" && mode !== "dev" && mode !== "demo") {
    throw new Error("Invalid SKETCHBLOCK_AUTH_MODE. Use github, demo or dev.");
  }

  return mode;
}

function readDevPermission(): GitHubRepositoryPermission {
  const permission = (process.env.SKETCHBLOCK_DEV_USER_PERMISSION || "admin").trim();

  if (!repositoryPermissions.includes(permission as GitHubRepositoryPermission)) {
    throw new Error("Invalid SKETCHBLOCK_DEV_USER_PERMISSION. Use read, triage, write, maintain or admin.");
  }

  return permission as GitHubRepositoryPermission;
}

function readDeploymentEnv(): SketchblockDeploymentEnv {
  const value = process.env.SKETCHBLOCK_DEPLOYMENT_ENV?.trim();

  if (!value) {
    return process.env.NODE_ENV === "production" ? "production" : "local";
  }

  if (value !== "local" && value !== "production") {
    throw new Error("Invalid SKETCHBLOCK_DEPLOYMENT_ENV. Use local or production.");
  }

  return value;
}

export function getSketchblockAuthMode(): SketchblockAuthMode {
  const mode = readAuthMode();

  if (mode !== "github" && readDeploymentEnv() === "production") {
    throw new Error(`SKETCHBLOCK_AUTH_MODE=${mode} is not allowed when SKETCHBLOCK_DEPLOYMENT_ENV=production.`);
  }

  return mode;
}

export function isDevAuthMode() {
  return getSketchblockAuthMode() !== "github";
}

export function isDemoAuthMode() {
  return getSketchblockAuthMode() === "demo";
}

export function getDevAuthUser(): AuthUser {
  if (!isDevAuthMode()) {
    throw new Error("Local auth user requested while SKETCHBLOCK_AUTH_MODE is github.");
  }

  const demoMode = isDemoAuthMode();
  return {
    id: Number.parseInt(process.env.SKETCHBLOCK_DEV_USER_ID || "1", 10),
    login: demoMode ? "demo" : process.env.SKETCHBLOCK_DEV_USER_LOGIN?.trim() || "local-dev",
    name: demoMode ? "Demo User" : process.env.SKETCHBLOCK_DEV_USER_NAME?.trim() || "Local Dev User",
    avatarUrl: null,
    permission: readDevPermission(),
    expiresAt: Date.now() + DEFAULT_DEV_USER_MAX_AGE_MS,
  };
}

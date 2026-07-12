import { NextRequest, NextResponse } from "next/server";
import { safeRecordAuditEvent } from "@/lib/server/audit/audit-service";

import {
  exchangeGitHubCode,
  getGitHubUser,
} from "@/lib/server/auth/github-oauth";
import { getCurrentOwner } from "@/lib/server/auth/owner-session";
import { linkInstanceOwnerGitHub } from "@/lib/server/database/instance-owner-store";
import { linkAppUserGitHubIdentity } from "@/lib/server/database/user-store";
import {
  consumeOAuthStateCookie,
  getAppBaseUrl,
  getLoginPath,
  sanitizeReturnTo,
  setAuthCookie,
  setGitHubAccessTokenCookie,
} from "@/lib/server/auth/session";
import {
  getRequestId,
  logServerError,
  withRequestId,
} from "@/lib/server/logging/server-logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  let returnTo = "/sessions";

  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const storedState = await consumeOAuthStateCookie();

    if (storedState) {
      returnTo = sanitizeReturnTo(storedState.returnTo);
    }

    if (!code || !state || !storedState || storedState.state !== state) {
      throw new Error("Invalid GitHub OAuth state.");
    }

    const accessToken = await exchangeGitHubCode({
      code,
      redirectUri: `${getAppBaseUrl()}/api/auth/github/callback`,
    });
    const user = await getGitHubUser(accessToken);
    if (storedState.intent === "owner_connect") {
      const owner = await getCurrentOwner();
      if (!owner) {
        throw new Error("Instance Owner login expired during GitHub connection.");
      }
      if (owner.id === "dev-owner") {
        await setAuthCookie({ ...user, permission: "admin" });
      } else {
        await linkAppUserGitHubIdentity(owner.id, user);
        if (owner.role === "instance_owner") {
          await linkInstanceOwnerGitHub(owner.id, user);
        }
      }
      await setGitHubAccessTokenCookie(accessToken);
      await safeRecordAuditEvent({ actorId: owner.id, actorUsername: owner.username, actorRole: owner.role, action: "github.identity.connect", targetType: "github_user", targetId: String(user.id), outcome: "success", requestId });
    } else {
      await setAuthCookie({ ...user, permission: "read" });
    }

    return withRequestId(
      NextResponse.redirect(new URL(returnTo, getAppBaseUrl())),
      requestId,
    );
  } catch (error) {
    logServerError("web.github.oauth.callback.failed", error, {
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      returnTo,
      statusCode: 302,
    });
    return withRequestId(
      NextResponse.redirect(
        new URL(getLoginPath(returnTo, "github_oauth_failed"), getAppBaseUrl()),
      ),
      requestId,
    );
  }
}

import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { isDevAuthMode } from "@/lib/server/auth/auth-mode";
import { getGitHubAuthorizeUrl } from "@/lib/server/auth/github-oauth";
import { getCurrentOwner } from "@/lib/server/auth/owner-session";
import {
  getAppBaseUrl,
  getLoginPath,
  sanitizeReturnTo,
  setOAuthStateCookie,
} from "@/lib/server/auth/session";
import {
  getRequestId,
  logServerError,
  withRequestId,
} from "@/lib/server/logging/server-logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const intent = request.nextUrl.searchParams.get("intent") === "owner_connect" ? "owner_connect" : "participant";

  try {
    if (isDevAuthMode() && intent !== "owner_connect") {
      return withRequestId(NextResponse.redirect(new URL(returnTo, getAppBaseUrl())), requestId);
    }

    if (intent === "owner_connect" && !(await getCurrentOwner())) {
      return withRequestId(
        NextResponse.redirect(new URL(getLoginPath(returnTo), getAppBaseUrl())),
        requestId,
      );
    }
    if (intent === "participant" && !returnTo.startsWith("/join/")) {
      return withRequestId(
        NextResponse.redirect(new URL(getLoginPath("/", "github_oauth_failed"), getAppBaseUrl())),
        requestId,
      );
    }

    const state = randomBytes(24).toString("hex");
    const redirectUri = `${getAppBaseUrl()}/api/auth/github/callback`;

    await setOAuthStateCookie({ state, returnTo, intent });

    return withRequestId(
      NextResponse.redirect(getGitHubAuthorizeUrl({
        state,
        redirectUri,
        scope: intent === "owner_connect" ? "read:user repo" : "read:user",
      })),
      requestId,
    );
  } catch (error) {
    logServerError("web.github.oauth.start.failed", error, {
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      intent,
      returnTo,
      statusCode: 302,
    });
    return withRequestId(
      NextResponse.redirect(
        new URL(getLoginPath(returnTo, "github_oauth_unavailable"), getAppBaseUrl()),
      ),
      requestId,
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

import { requireLinkedOwnerGitHub, requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import { listWritableGitHubRepositories } from "@/lib/server/github/github-repository-adapter";
import {
  getRequestId,
  logServerError,
  withRequestId,
} from "@/lib/server/logging/server-logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response) {
      return withRequestId(auth.response, requestId);
    }
    if (!auth.owner) {
      return withRequestId(
        NextResponse.json({ error: "Instance owner login required." }, { status: 401 }),
        requestId,
      );
    }
    requireLinkedOwnerGitHub(auth.owner);

    const repositories = await listWritableGitHubRepositories();
    return withRequestId(NextResponse.json({ repositories }), requestId);
  } catch (error) {
    logServerError("web.repositories.available.failed", error, {
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      statusCode: 400,
    });
    return withRequestId(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error", requestId },
        { status: 400 },
      ),
      requestId,
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { openDrawing } from "@/lib/server/application/drawing-use-cases";
import { authorizeSessionRequest } from "@/lib/server/auth/session-access";
import {
  getCollabSessionSnapshot,
  registerCollabSession,
  upsertCollabSessionSnapshot,
} from "@/lib/server/collab/collab-server-client";
import { getSession } from "@/lib/server/database/session-store";
import { requireOwnedRepositoryById, requireRepositoryById } from "@/lib/server/database/repository-store";

export const runtime = "nodejs";

type SessionStateRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

const snapshotSchema = z.object({
  clientId: z.string().min(1),
  content: z.unknown(),
});

async function ensureSessionSnapshot(sessionId: string, allowGitHubInitialization: boolean, localUserId?: string | null) {
  const session = await getSession(sessionId);

  if (!session) {
    return null;
  }

  const existingState = await getCollabSessionSnapshot(sessionId);
  if (existingState.snapshot) {
    return {
      session: {
        ...session,
        status: existingState.status,
      },
      snapshot: existingState.snapshot,
      audit: existingState.audit,
    };
  }

  if (!allowGitHubInitialization) {
    return {
      session: {
        ...session,
        status: existingState.status,
      },
      snapshot: null,
      audit: [],
    };
  }

  const repository = localUserId
    ? await requireOwnedRepositoryById(session.repositoryId, localUserId)
    : await requireRepositoryById(session.repositoryId);
  const drawing = await openDrawing(repository, session.drawingPath);
  await registerCollabSession(session, drawing.content);
  const initializedState = await getCollabSessionSnapshot(sessionId);

  return {
    session,
    snapshot: initializedState.snapshot,
    audit: initializedState.audit,
  };
}

export async function GET(_request: NextRequest, { params }: SessionStateRouteContext) {
  try {
    const { sessionId } = await params;
    const auth = await authorizeSessionRequest(_request, sessionId, "view");
    if (auth.response || !auth.access) {
      return auth.response || NextResponse.json({ error: "Session access could not be resolved." }, { status: 500 });
    }
    const state = await ensureSessionSnapshot(sessionId, auth.access.role === "owner", auth.access.localUserId);

    if (!state) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    return NextResponse.json({
      ...state,
      audit: auth.access.role === "owner" ? state.audit : [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: SessionStateRouteContext) {
  try {
    const { sessionId } = await params;
    const auth = await authorizeSessionRequest(request, sessionId, "edit");
    if (auth.response || !auth.access) {
      return auth.response || NextResponse.json({ error: "Session access could not be resolved." }, { status: 500 });
    }
    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const body = snapshotSchema.parse(await request.json());
    const snapshot = await upsertCollabSessionSnapshot({
      sessionId: session.id,
      drawingPath: session.drawingPath,
      content: body.content,
      updatedBy: auth.access.actor,
    });

    return NextResponse.json({ session, snapshot });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 },
    );
  }
}

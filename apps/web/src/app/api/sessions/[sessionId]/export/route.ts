import { NextRequest, NextResponse } from "next/server";

import { authorizeSessionRequest } from "@/lib/server/auth/session-access";
import { getCollabSessionSnapshot } from "@/lib/server/collab/collab-server-client";
import { getSession } from "@/lib/server/database/session-store";

export const runtime = "nodejs";

type Context = { params: Promise<{ sessionId: string }> };

function safeBaseName(title: string | null | undefined, drawingPath: string) {
  const fromPath = drawingPath.split("/").pop()?.replace(/\.excalidraw$/i, "") ?? "";
  const raw = (title && title.trim()) || fromPath || "board";
  const cleaned = raw.replace(/[\u0000-\u001f\u007f"\\/:*?<>|;]/g, "").trim().slice(0, 100).trim();
  return cleaned || "board";
}

function contentDisposition(baseName: string) {
  const full = `${baseName}.excalidraw`;
  const ascii = full.replace(/[^\x20-\x7e]/g, "_").replace(/%/g, "_");
  const encoded = encodeURIComponent(full).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: NextRequest, { params }: Context) {
  const { sessionId } = await params;
  const { access, response } = await authorizeSessionRequest(request, sessionId, "view");
  if (response || !access) {
    return response ?? NextResponse.json({ error: "Valid session access required." }, { status: 401 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  if (access.role !== "owner" && session.participantDownload === false) {
    return NextResponse.json({ error: "Downloads are disabled for participants.", code: "download_disabled" }, { status: 403 });
  }

  try {
    const snapshot = await getCollabSessionSnapshot(sessionId);
    const content = snapshot.materializedContent ?? snapshot.snapshot?.content ?? null;
    if (content === null || content === undefined) {
      return NextResponse.json({ error: "No board content available." }, { status: 404 });
    }
    return new NextResponse(JSON.stringify(content), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": contentDisposition(safeBaseName(session.title, session.drawingPath)),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export unavailable.", code: "collab_unavailable" },
      { status: 503 },
    );
  }
}

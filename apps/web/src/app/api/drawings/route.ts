import { NextResponse } from "next/server";

import { listDrawings } from "@/lib/server/application/drawing-use-cases";
import { requireLinkedOwnerGitHub, requireOwnerApiAuth } from "@/lib/server/auth/owner-session";
import {
  getActiveRepository,
  saveActiveRepository,
} from "@/lib/server/database/repository-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireOwnerApiAuth();
    if (auth.response || !auth.owner) {
      return auth.response;
    }

    if (!auth.owner.githubUserId) {
      return NextResponse.json({ configured: false, repository: null, drawings: [], githubConnected: false });
    }
    const github = requireLinkedOwnerGitHub(auth.owner);
    const repository = await getActiveRepository(auth.owner.id);
    const drawings = repository ? await listDrawings(repository) : [];
    const scannedRepository = repository
      ? {
          ...repository,
          status: drawings.length > 0 ? ("ready" as const) : ("empty" as const),
          drawingCount: drawings.length,
          lastScanAt: new Date().toISOString(),
          error: undefined,
        }
      : null;

    if (scannedRepository) {
      await saveActiveRepository({
        userId: auth.owner.id,
        githubUserId: github.id,
        login: github.login,
        name: github.name,
        avatarUrl: github.avatarUrl,
      }, scannedRepository);
    }

    return NextResponse.json({
      configured: Boolean(scannedRepository),
      repository: scannedRepository,
      drawings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: false,
        drawings: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 200 },
    );
  }
}

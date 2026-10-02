import "server-only";

import type {
  DrawingContent,
  DrawingFile,
  RepositoryRecord,
  SaveDrawingInput,
  SaveDrawingResult,
} from "@/types/sketchblock";
import type { DrawingStoragePort } from "@/lib/server/application/drawing-storage-port";
import { isDemoAuthMode } from "@/lib/server/auth/auth-mode";
import { DemoDrawingStorage } from "@/lib/server/demo/demo-drawing-storage";
import { GitHubDrawingStorage } from "@/lib/server/github/github-drawing-storage";
import { InstanceDrawingStorage } from "@/lib/server/workspace/instance-drawing-storage";

export function getDrawingStorage(repository: RepositoryRecord): DrawingStoragePort {
  // Demo auth mode always uses the demo store, regardless of the repository record.
  const provider = isDemoAuthMode() ? "demo" : repository.provider;
  if (provider === "demo") return DemoDrawingStorage;
  if (provider === "github") return GitHubDrawingStorage;
  if (provider === "instance") return InstanceDrawingStorage;
  throw new Error(`No storage available for provider "${provider}".`);
}

export async function listDrawings(repository: RepositoryRecord): Promise<DrawingFile[]> {
  return getDrawingStorage(repository).list(repository);
}

export async function openDrawing(repository: RepositoryRecord, path: string): Promise<DrawingContent> {
  return getDrawingStorage(repository).open(repository, path);
}

export async function saveDrawing(
  repository: RepositoryRecord,
  input: SaveDrawingInput,
): Promise<SaveDrawingResult> {
  return getDrawingStorage(repository).save(repository, input);
}

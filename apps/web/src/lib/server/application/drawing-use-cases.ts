import "server-only";

import type {
  DrawingContent,
  DrawingFile,
  RepositoryRecord,
  SaveDrawingInput,
  SaveDrawingResult,
} from "@/types/sketchblock";
import {
  listGitHubDrawings,
  readGitHubDrawing,
  saveGitHubDrawing,
} from "@/lib/server/github/github-repository-adapter";
import { isDemoAuthMode } from "@/lib/server/auth/auth-mode";
import { getDemoDrawing, listDemoDrawings, saveDemoDrawing } from "@/lib/server/demo/demo-store";

export async function listDrawings(repository: RepositoryRecord): Promise<DrawingFile[]> {
  if (isDemoAuthMode()) return listDemoDrawings();
  return listGitHubDrawings(repository);
}

export async function openDrawing(repository: RepositoryRecord, path: string): Promise<DrawingContent> {
  if (isDemoAuthMode()) return getDemoDrawing(path);
  return readGitHubDrawing(repository, path);
}

export async function saveDrawing(
  repository: RepositoryRecord,
  input: SaveDrawingInput,
): Promise<SaveDrawingResult> {
  if (isDemoAuthMode()) return saveDemoDrawing(input);
  return saveGitHubDrawing(repository, input);
}

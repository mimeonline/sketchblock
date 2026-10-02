import "server-only";

import type { DrawingStoragePort } from "@/lib/server/application/drawing-storage-port";
import { StorageConflictError } from "@/lib/server/application/storage-errors";
import {
  GitHubApiError,
  listGitHubDrawings,
  readGitHubDrawing,
  saveGitHubDrawing,
} from "@/lib/server/github/github-repository-adapter";

export const GitHubDrawingStorage: DrawingStoragePort = {
  list: (repository) => listGitHubDrawings(repository),
  open: (repository, path) => readGitHubDrawing(repository, path),
  async save(repository, input) {
    try {
      return await saveGitHubDrawing(repository, input);
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 409) {
        throw new StorageConflictError(error.message);
      }
      throw error;
    }
  },
};

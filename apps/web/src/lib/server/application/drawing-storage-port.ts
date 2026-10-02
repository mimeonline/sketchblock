import type {
  DrawingContent,
  DrawingFile,
  RepositoryRecord,
  SaveDrawingInput,
  SaveDrawingResult,
} from "@/types/sketchblock";

export type CreateDrawingInput = { path: string; content: unknown; message?: string };
export type RenameDrawingInput = { path: string; newPath: string; message?: string };
export type DeleteDrawingInput = { path: string; sha: string; message?: string };

/**
 * Storage backend for boards. `sha` is a generic version id; `save` uses it for
 * optimistic locking and throws StorageConflictError on a version mismatch.
 */
export interface DrawingStoragePort {
  list(repository: RepositoryRecord): Promise<DrawingFile[]>;
  open(repository: RepositoryRecord, path: string): Promise<DrawingContent>;
  save(repository: RepositoryRecord, input: SaveDrawingInput): Promise<SaveDrawingResult>;
  create?(repository: RepositoryRecord, input: CreateDrawingInput): Promise<SaveDrawingResult>;
  rename?(repository: RepositoryRecord, input: RenameDrawingInput): Promise<SaveDrawingResult>;
  delete?(repository: RepositoryRecord, input: DeleteDrawingInput): Promise<void>;
}

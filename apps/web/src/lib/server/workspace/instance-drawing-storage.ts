import "server-only";

import type {
  CreateDrawingInput,
  DeleteDrawingInput,
  DrawingStoragePort,
  RenameDrawingInput,
} from "@/lib/server/application/drawing-storage-port";
import { StorageConflictError } from "@/lib/server/application/storage-errors";
import {
  createWorkspaceBoard,
  deleteWorkspaceBoard,
  getWorkspaceBoardByPath,
  listWorkspaceBoards,
  renameWorkspaceBoard,
  revisionToSha,
  saveWorkspaceBoard,
} from "@/lib/server/database/workspace-board-store";
import { validateDrawingPath } from "@/lib/server/domain/validate-drawing-path";
import { userIdFromInstanceRepositoryId } from "@/lib/server/workspace/instance-repository";
import type { RepositoryRecord } from "@/types/sketchblock";

function ownerOf(repository: RepositoryRecord): string {
  return userIdFromInstanceRepositoryId(repository.id);
}

function titleFromPath(path: string): string {
  return path.replace(/^.*\//, "").replace(/\.excalidraw$/, "") || "board";
}

export const InstanceDrawingStorage: DrawingStoragePort = {
  async list(repository) {
    const boards = await listWorkspaceBoards(ownerOf(repository));
    return boards.map((board) => ({
      path: board.path,
      sha: revisionToSha(board.revision),
      lastCommit: `Revision ${board.revision}`,
      status: "indexed" as const,
      repositoryId: repository.id,
      boardId: board.id,
    }));
  },

  async open(repository, path) {
    const board = await getWorkspaceBoardByPath(ownerOf(repository), validateDrawingPath(path));
    return { path: board.path, sha: revisionToSha(board.revision), content: board.content, boardId: board.id };
  },

  async save(repository, input) {
    const path = validateDrawingPath(input.path);
    const { revision } = await saveWorkspaceBoard(ownerOf(repository), {
      path,
      sha: input.sha,
      content: input.content,
      updatedBy: ownerOf(repository),
      message: input.message,
    });
    const sha = revisionToSha(revision);
    return { path, commitSha: sha, contentSha: sha };
  },

  async create(repository, input: CreateDrawingInput) {
    const path = validateDrawingPath(input.path);
    const board = await createWorkspaceBoard(ownerOf(repository), {
      title: titleFromPath(path),
      content: input.content,
      createdBy: ownerOf(repository),
      message: input.message,
    });
    const sha = revisionToSha(board.revision);
    return { path: board.path, commitSha: sha, contentSha: sha };
  },

  async rename(repository, input: RenameDrawingInput) {
    const owner = ownerOf(repository);
    const current = await getWorkspaceBoardByPath(owner, validateDrawingPath(input.path));
    const newPath = validateDrawingPath(input.newPath);
    const renamed = await renameWorkspaceBoard(owner, current.id, { title: titleFromPath(newPath), newPath });
    const sha = revisionToSha(renamed.revision);
    return { path: renamed.path, commitSha: sha, contentSha: sha };
  },

  async delete(repository, input: DeleteDrawingInput) {
    const owner = ownerOf(repository);
    const current = await getWorkspaceBoardByPath(owner, validateDrawingPath(input.path));
    if (revisionToSha(current.revision) !== input.sha) {
      throw new StorageConflictError("The board was changed after it was opened.");
    }
    await deleteWorkspaceBoard(owner, current.id);
  },
};

/** Resolve a board only inside the currently loaded repository/branch listing. */
export function resolveBoardPath(drawings: readonly { path: string }[], requestedPath: string): string {
  return drawings.some((drawing) => drawing.path === requestedPath)
    ? requestedPath
    : requestedPath ? "" : drawings[0]?.path || "";
}

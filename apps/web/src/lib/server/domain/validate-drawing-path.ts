import "server-only";

export function validateDrawingPath(path: string): string {
  if (!path.endsWith(".excalidraw")) {
    throw new Error("Only .excalidraw files are supported.");
  }

  if (path.startsWith("/") || path.includes("..")) {
    throw new Error("Invalid drawing path.");
  }

  return path;
}

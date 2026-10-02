/** Human-readable board title derived from an `.excalidraw` file path. */
export function drawingTitle(path: string, fallback = "Unbenanntes Board") {
  const fileName = path.split("/").pop() || path;
  const title = fileName.replace(/\.excalidraw$/i, "").replace(/[-_]+/g, " ").trim();
  return title ? `${title.charAt(0).toUpperCase()}${title.slice(1)}` : fallback;
}

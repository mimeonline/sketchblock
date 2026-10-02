type BoardElement = { id?: unknown; index?: unknown };

function compareElements(a: BoardElement, b: BoardElement) {
  // Excalidraw fractional indices are ASCII-ordered keys; compare by code unit, not locale.
  if (typeof a.index === "string" && typeof b.index === "string" && a.index !== b.index) {
    return a.index < b.index ? -1 : 1;
  }
  const left = String(a.id ?? "");
  const right = String(b.id ?? "");
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Builds the board content to persist: live elements from the collaborative
 * document combined with app state and binary files of the latest checkpoint.
 */
export function materializeBoardContent(checkpointContent: unknown, liveElements: unknown[]): unknown {
  if (liveElements.length === 0) {
    return checkpointContent;
  }

  const base = checkpointContent && typeof checkpointContent === "object" && !Array.isArray(checkpointContent)
    ? (checkpointContent as Record<string, unknown>)
    : { type: "excalidraw", version: 2, source: "sketchblock" };
  const elements = liveElements
    .filter((element): element is BoardElement => Boolean(element) && typeof element === "object")
    .sort(compareElements);

  return { ...base, elements };
}

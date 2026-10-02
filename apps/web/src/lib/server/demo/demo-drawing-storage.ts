import "server-only";

import type { DrawingStoragePort } from "@/lib/server/application/drawing-storage-port";
import { getDemoDrawing, listDemoDrawings, saveDemoDrawing } from "@/lib/server/demo/demo-store";

// The demo store has no sha check on save, so no conflict mapping is needed.
export const DemoDrawingStorage: DrawingStoragePort = {
  list: () => listDemoDrawings(),
  open: (_repository, path) => getDemoDrawing(path),
  save: (_repository, input) => saveDemoDrawing(input),
};

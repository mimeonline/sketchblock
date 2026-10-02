"use client";

import type { AppState } from "@excalidraw/excalidraw/types";
import { useEffect, useState } from "react";

export type SceneToViewport = (point: { sceneX: number; sceneY: number }, appState: AppState) => { x: number; y: number };

/** Lazily loads Excalidraw's coordinate helper (the package must not be imported during SSR). */
export function useSceneToViewport() {
  const [helper, setHelper] = useState<SceneToViewport | null>(null);
  useEffect(() => {
    let active = true;
    void import("@excalidraw/excalidraw").then((mod) => {
      if (active) setHelper(() => mod.sceneCoordsToViewportCoords as SceneToViewport);
    });
    return () => { active = false; };
  }, []);
  return helper;
}

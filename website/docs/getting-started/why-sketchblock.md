---
title: Why Sketchblock
description: Open Excalidraw files from GitHub, edit them together in the browser, and save the result directly as a commit.
slug: /getting-started/why-sketchblock
---

import {ScreenshotFigure, StarterCards, WorkflowRail} from '@site/src/components/GettingStartedVisuals';

# Why Sketchblock

Sketchblock keeps an Excalidraw file beside the code it explains, gives people a live canvas for reviewing it together, and returns the agreed result to the repository.

The local demo shows this workflow without GitHub credentials. Instance workspaces support private local boards; GitHub mode adds repository-backed selection and saves for the owner.

<ScreenshotFigure
  src="/img/docs/getting-started/collaboration.png"
  alt="Local Sketchblock collaboration demo showing a shared canvas, participant presence, and session controls"
  caption="A local demo collaboration workspace keeps the canvas, presence, and session controls in one focused room. Open the image for the full-size view."
/>

<WorkflowRail />

<details>
  <summary>The manual round trip, in brief</summary>

  Without a repository-connected workspace, a diagram moves from Git to a separate editor, through export and file replacement, and back into a commit. Each handoff can leave an outdated file or unclear ownership. Sketchblock keeps repository context, live collaboration, role-specific access, and the durable save path together.

</details>

<StarterCards />

## Try the complete flow

The credential-free demo lets you edit an included board, start a live session, and verify collaborator and viewer access locally. Use the quickstart for the first run.

[Run the quickstart](./quickstart.md)

# Boards

import {ScreenshotFigure} from '@site/src/components/GettingStartedVisuals';
import {GuideFlow} from '@site/src/components/GuideVisuals';

Sketchblock discovers `.excalidraw` files in the active source. The gallery provides previews and the file view exposes the exact path and revision. Text and long labels remain fully readable in the canvas and board surfaces.

<ScreenshotFigure
  src="/img/docs/getting-started/editor.png"
  alt="Local Sketchblock demo editor showing an Excalidraw board and save state"
  caption="Local demo editor: open the board, make the change, and use the save state to confirm where it is stored."
/>

<GuideFlow
  label="Board lifecycle"
  steps={[
    {title: 'Discover', description: 'Scan the active source and choose a board from the gallery or exact file path.'},
    {title: 'Edit', description: 'Open the current content in the canvas and work alone or with an invited session.'},
    {title: 'Check', description: 'Use the revision or conflict state to understand which source version you loaded.'},
    {title: 'Save', description: 'Write a Git commit, local workspace version, or demo-local save according to the active provider.'},
  ]}
  caption="The same editor supports GitHub-backed, instance-workspace, and demo-local board flows."
/>

## Where a save goes

For a GitHub-backed board, opening loads its GitHub file SHA as the conflict baseline and saving writes the current Excalidraw document back as a Git commit. If the remote SHA changed, Sketchblock blocks the save and asks you to reload.

In the instance workspace, saving creates a new Postgres-backed version and keeps version history available in the editor. The editor uses local-workspace save labels and hints. In demo mode, the included board is persisted locally in Postgres and never sent to GitHub.

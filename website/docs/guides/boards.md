# Boards

Sketchblock discovers `.excalidraw` files in the active source. The gallery provides previews and the file view exposes the exact path and revision. Text and long labels remain fully readable in the canvas and board surfaces.

Opening a board loads its GitHub file SHA as the conflict baseline. Saving writes the current Excalidraw document back as a Git commit. If the remote SHA changed, Sketchblock blocks the save and asks you to reload.

In the instance workspace, saving creates a new Postgres-backed version and keeps version history available in the editor. The editor uses local-workspace save labels and hints. In demo mode, the included board is persisted locally in Postgres and never sent to GitHub.

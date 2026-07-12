# Boards

Sketchblock discovers `.excalidraw` files in the active repository. The gallery provides previews and the file view exposes the exact path and revision.

Opening a board loads its GitHub file SHA as the conflict baseline. Saving writes the current Excalidraw document back as a Git commit. If the remote SHA changed, Sketchblock blocks the save and asks you to reload.

In demo mode, the included board is persisted locally in Postgres and never sent to GitHub.

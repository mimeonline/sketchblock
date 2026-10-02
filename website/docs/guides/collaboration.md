# Collaboration

Start a live session from a board in the active repository. Sketchblock creates three access paths:

- **Owner** opens and controls the board.
- **Collaborator** can edit the shared canvas.
- **Viewer** follows the session without editing.

The invite dialog provides role-specific links and a QR code, defaults to viewer access, and shows invitation expiry. Owners can renew links and remove participants. Removing a participant disconnects their GitHub account and excludes it from the session. Ending a session revokes invitations and disconnects the live room while preserving its audit trail.

## Saving and reconnecting

The live-session header shows the repository and file where the owner saves. Saving commits the live collaborative board to GitHub using the file's session base SHA. Changes committed upstream during the session produce a conflict instead of being overwritten. Export the current board before resolving an upstream conflict or starting a replacement session.

The socket attempts to reconnect after a connection interruption and merges session state with pending local edits. Keep the tab open until the connection and synchronization indicators recover. Browser reloads and closing a tab can lose unsent edits; offline editing is not a durable backup. A rejected or oversized update requires attention before saving or leaving.

## Checking a two-user workflow

Use separate browser profiles to keep cookies and GitHub identities independent. Open the session as owner in one profile and follow a collaborator invitation in the other. Edit in both profiles, check that changes appear on both canvases, reconnect one profile, and save as owner. Verify the resulting GitHub file and commit. Repeat with a viewer invitation to check read-only access, then test removal and session end.

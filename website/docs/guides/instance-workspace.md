# Instance Workspace

Every local user has a private workspace in the repository switcher. Create boards without GitHub—store sketches in the Sketchblock database, edit them live, and manage versions. Ideal for ad-hoc collaboration and local exploration.

## Creating and Uploading

Create a new board or upload an Excalidraw file (`.excalidraw`, `.json`, or image with embedded scene) directly in the workspace. The board opens in the editor ready to work.

## Live Sessions

Start a live session from within the editor. Invite collaborators and viewers using the share dialog; presence, live editing, and role-based access work as usual. Sessions work like repository boards—owner, collaborator, and viewer roles apply.

## Version History

Every save creates a new version. Access version history in the board menu to:

- List all saved versions
- Restore an older version (creates a new version from the restored state)
- View when each version was saved

At most `SKETCHBLOCK_WORKSPACE_MAX_VERSIONS` (default 50) versions are kept per board; older versions are pruned automatically.

## Managing Boards

Rename a board only when it has no active sessions. Delete a board to end any running sessions and remove it permanently.

## Storage

Workspace boards are stored in the application Postgres database. Include the database in your backups. Requires database migration V15.

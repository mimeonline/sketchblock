# Ad-hoc Rooms

Upload an Excalidraw file (`.excalidraw`, `.json`, or image with embedded scene) from Overview or Collaboration. A temporary live session starts immediately with no GitHub repository required.

## Uploading

Use **Upload a file and collaborate** (drag and drop or **Choose file**) to import:

- Excalidraw files (`.excalidraw` or `.json`)
- PNG or SVG images exported from Excalidraw with an embedded scene

The upload size limit is 10 MB, with a maximum of 20,000 elements. Embedded images are limited to PNG, JPEG, GIF, WebP, or SVG data URLs. Uploads are rate-limited per user.

Alternatively, use **Start an empty room** to create a blank board for immediate collaboration without uploading a file.

## Sharing and Access

Invite collaborators and viewers using the same dialog as a regular session. Presence, live editing, and role-based access work as usual—owner, collaborator, and viewer roles apply.

The default export setting permits participants to download results. When disabled, only the owner can download.

## Downloads and Export

Export the live board as:

- **Excalidraw** — the native format, preserving all properties
- **PNG** or **SVG** — image snapshots

GitHub save is not available for ad-hoc rooms.

## Lifecycle

A room expires after `SKETCHBLOCK_ADHOC_TTL_HOURS` (default 168 hours / 7 days). After expiry or when the owner closes the session, content is deleted after `SKETCHBLOCK_ADHOC_RETENTION_HOURS` (default 24 hours) from web and collaboration storage. Cleanup runs opportunistically at most every 10 minutes when sessions are listed or new rooms are created.

## Database

Ad-hoc rooms are managed by application database migration V13.

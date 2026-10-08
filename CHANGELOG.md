# Changelog

## Unreleased

## 0.3.1 - 2026-10-08

### Changed

- Expand Getting Started and Guides with visual workflows and product screenshots.
- Clarify configuration, backup and restore, updates, troubleshooting, development, contribution, security, and privacy documentation.
- Document the system context, runtime building blocks, and the roles of Yjs and Socket.IO with reproducible architecture diagrams and accessible zoom controls.
- Add a prominent Meierhoff Systems website link to the project profile.

### Fixed

- Keep demo boards and dashboard actions available without a GitHub connection; apply the reconnect requirement to GitHub-backed repositories.

## 0.3.0 - 2026-10-08

### Added

- Facilitation: owners moderate live sessions with viewport following, edit locks, timer presets, voting (1–10 votes per person), emoji reactions, and top-voted elements summary. State clears when sessions end or the server restarts.
- Guest viewers: enable "Allow viewing without an account" per session in the share dialog; guests enter a display name and watch live boards read-only.
- Ad-hoc rooms: start with an empty board or upload an Excalidraw file or image with embedded scene to create a temporary live session without GitHub; participants download results as Excalidraw, PNG, or SVG.
- Instance workspace: every local user has a private workspace for creating boards and managing versions without GitHub integration.
- A valid role-specific invitation lets collaborators and viewers join any session with a local account or an existing GitHub sign-in. The owner connects GitHub for GitHub-backed repository access and saves.
- Configuration for ad-hoc room lifetime, retention, and upload size limits (`SKETCHBLOCK_ADHOC_TTL_HOURS`, `SKETCHBLOCK_ADHOC_RETENTION_HOURS`, `SKETCHBLOCK_MAX_UPLOAD_BYTES`), plus a configurable workspace version limit (`SKETCHBLOCK_WORKSPACE_MAX_VERSIONS`).

### Changed

- Refresh compatible dependencies and pin patched transitive packages; document remaining upstream audit findings and their build/runtime scope.
- Upgrade application persistence through migrations V13–V16 and collaboration migration V2.
- Extract dashboard rendering into a route-local component to keep the home template easier to maintain, preserving existing behavior.
- Large board previews can be loaded on demand while the gallery keeps its automatic rendering limit. Board status filters use the same translated labels as badges; the file list has striped rows and accessible full-path tooltips.
- Build release images on native AMD64 and ARM64 runners and merge their manifests, avoiding ARM emulation failures. Existing release tags can be rebuilt through a validated manual workflow dispatch.

### Fixed

- Disabling anonymous viewing disconnects connected guests and revokes their existing collaboration tickets, including after collaboration-server restarts (collab migration V2).
- Reconnecting clients fetch fresh collaboration tickets and replay interrupted live edits without requiring another edit.
- Closed-session and removed-participant states remain visible when reconnect authorization fails.
- Guest claim routes expose only supported Next.js route exports.
- Workspace version history refreshes after saving, and boards display their stored titles.
- Instance saves keep the version history visible and report the instance workspace as the save target.
- Long text and labels remain fully readable in the canvas and board surfaces.
- Instance editor hints and save labels describe local versioning instead of GitHub commits.
- Realtime snapshot persistence deduplicates repeated state and skips stale out-of-order mirrors.
- Removed the obsolete read-only hint from editable workspace views.
- Moderation switches expose their visible labels to assistive technologies.

## 0.2.0 - 2026-10-02

### Security

- Ending a session now ends access: invitations are revoked, connected clients are disconnected, and socket tickets, joins, state writes and Yjs updates for ended sessions are rejected.
- Owners can renew collaborator and viewer links; removing a person excludes their GitHub account from the session.
- Signed cookies and collaboration tickets are bound to their purpose. Upgrading signs everyone out once.
- The collaboration server refuses to start without an auth secret (opt-in `COLLAB_ALLOW_INSECURE_NO_AUTH=true` outside production), and production rejects short or example secrets. `COLLAB_AUTH_SECRET` can separate the ticket secret from `APP_AUTH_SECRET`.
- GitHub access tokens are bound to the local user that connected them; local sign-in clears foreign GitHub and participant cookies.
- State-changing API routes require a same-origin request; signing out only works via POST.
- Rate limits only trust forwarded client addresses with `SKETCHBLOCK_TRUST_PROXY` / `COLLAB_TRUST_PROXY`; login timing no longer reveals unknown usernames and password hashing is bounded.
- Baseline security headers (frame protection, nosniff, referrer and permissions policies, HSTS on https, report-only CSP).
- `/metrics` on the collaboration server requires a server ticket, the API docs UI is opt-in (`COLLAB_EXPOSE_API_DOCS`), and session audit trails are only returned to owners.
- Only owners and the web server may seed initial board content; session ids use a CSPRNG.
- Upgraded Next.js to 16.3.8 and patched Socket.IO, Engine.IO, multer and further transitive dependencies.
- Docker Compose binds to `127.0.0.1` by default (`SKETCHBLOCK_BIND_ADDRESS`).

### Fixed

- Saving a session no longer overwrites changes committed to GitHub during the session; conflicts return a clear message.
- Saving uses the live collaborative board instead of the last checkpoint; checkpoint races are retried and no longer block saving.
- Participants no longer linger in presence lists after leaving (ghost participants).
- Repository records are kept per local user, so a second user connecting the same repository no longer takes it over.
- Starting a session is rolled back when the collaboration server cannot register it.
- Text is re-measured with loaded fonts in live sessions.
- Idle live documents are released from memory; oversized Yjs documents are rejected (`COLLAB_MAX_YJS_DOCUMENT_BYTES`).
- Participant removal immediately disconnects the removed account and rejects later socket updates.
- Concurrent first updates share one live document; eviction preserves updates arriving during persistence.
- Reconnecting clients merge session state with pending edits, and metadata loading no longer interrupts the live socket.

### Changed

- Start or open a live session directly from the board editor.
- The live session header shows where the owner saves the board and links back to collaboration; ended sessions show a clear ended state.
- The share dialog defaults to the viewer link, shows link expiry and offers link renewal.
- Session history shows readable actors; board titles are consistent across views.
- Documented single-instance operation.
- Database migrations V10 to V12 (per-user repository records, session base SHA, participant removal).
- Expanded authentication, repository ownership, session lifecycle, realtime, and persistence regression coverage.
- A missing GitHub connection now offers a direct reconnect action while keeping the selected repository; repository scans show boards as Found instead of Indexed.

## 0.1.0 - 2026-07-12

- Initial public release of the Sketchblock web app and collaboration server.
- Self-contained Docker Compose quickstart with Postgres and Flyway migrations.
- Credential-free demo workspace with a resettable example board.
- GitHub repository integration, Excalidraw editing, live sessions, roles and presence.
- English public landing page, documentation, CI, GitHub Pages and multi-architecture container releases.
- Apache 2.0 licensing, security and contribution guidance, and a public product roadmap.

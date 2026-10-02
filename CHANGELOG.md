# Changelog

## Unreleased

- Build release images on native AMD64 and ARM64 runners and merge their manifests, avoiding ARM emulation failures. Existing release tags can be rebuilt through a validated manual workflow dispatch.

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

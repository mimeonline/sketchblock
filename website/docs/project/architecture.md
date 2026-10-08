# Architecture

import ArchitectureDiagram from '@site/src/components/ArchitectureDiagram';

Sketchblock combines a browser-based Excalidraw editor, a Next.js application, and a NestJS collaboration service. The browser uses the web application for identity, board management, session access, and explicit saves. It connects directly to the collaboration service for live editing and presence.

Board storage is selected by provider. GitHub repositories are one option; local users can use instance workspaces backed by the application database. Demo mode uses a demo store. Ad-hoc rooms support a temporary shared canvas and file export.

## System context · C4 level 1

<ArchitectureDiagram title="System context" src="/img/docs/architecture/system-context.svg" alt="C4 system context: board owners manage and save in Sketchblock; invited participants join as collaborators or viewers. Sketchblock optionally uses GitHub for OAuth and repository board reads and commits." />

The **board owner** opens a board, creates a session, manages invitations, and saves the result. An **invited participant** joins with a collaborator or viewer role; session participation does not grant repository credentials. **Sketchblock** controls these access and save boundaries. **GitHub** provides linked identity and repository-backed board storage when that provider is used. Instance workspaces and ad-hoc rooms can operate without GitHub.

## Runtime building blocks · C4 level 2

<ArchitectureDiagram title="Runtime building blocks" src="/img/docs/architecture/building-blocks.svg" alt="C4 container view: the React Excalidraw and Yjs browser editor calls the Next.js web application over HTTP and the NestJS collaboration server over Socket.IO. Next.js reads application Postgres, calls the collaboration HTTP API, and optionally calls GitHub. NestJS persists snapshots and Yjs state in a separate collaboration Postgres database." />

A C4 container is a logical application or data store with a runtime responsibility. It is independent of a Docker container: the two database nodes here share one Postgres service in Compose.

The browser runs on participant devices. The web application, collaboration server, and both databases belong to the self-hosted deployment; GitHub is external.

The arrows show the caller or writer initiating each relationship. Live synchronization carries updates in both directions after the browser establishes its Socket.IO connection. The diagram shows runtime relationships; schema migrations run during deployment startup.

| Building block | Responsibility | Source location |
| --- | --- | --- |
| Browser editor | Excalidraw canvas, local Yjs document, editor interaction, connection state and presence | `apps/web/src/features` |
| Next.js web application | Authentication, board providers, owner checks, invitations, session lifecycle, signed collaboration tickets, and saves | `apps/web/src/app/api`, `apps/web/src/lib/server` |
| NestJS collaboration server | Ticket verification, room membership, editing permissions, realtime events, snapshots, and Yjs document state | `apps/collab-server/src/sketchblock-collab` |
| Application database | Users and application sessions, repository metadata, session invitations and participants, instance workspace boards and revisions | `db/flyway/app/sql` |
| Collaboration database | Collaboration sessions, checkpoints, and encoded Yjs state used to restore documents | `db/flyway/collab/sql` |
| GitHub, optional | OAuth for linked accounts, repository discovery, file reads, and explicit board commits | `apps/web/src/lib/server/github` |

The default Compose deployment runs one Postgres service with two logical databases: `sketchblock_app` and `sketchblock_collab`. Each application owns its database access and connection pool. The browser accesses both services through their public endpoints; database access stays on the server side.

## Yjs and Socket.IO, explained

**Yjs keeps the shared drawing consistent.** Each browser holds a local copy of the drawing data. Yjs represents changes as updates that can be merged across those copies, including concurrent edits. It uses a *CRDT* (Conflict-free Replicated Data Type): a data structure designed to reach the same state once every copy has received the same updates.

**Socket.IO carries the live messages.** It provides two-way, event-based communication between browsers and the collaboration server. Sketchblock uses it to exchange Yjs updates and session events such as participant presence. Socket.IO also provides connection and reconnection mechanisms; Sketchblock handles room admission and state synchronization around those connections.

For example, Alice adds a rectangle while Bob adds a circle. Sketchblock maps those drawing changes into Yjs updates, sends them through Socket.IO to the collaboration server, and distributes them to the other participants. After the updates arrive and are applied, both drawings contain the rectangle and the circle.

**Remember: Yjs merges the data; Socket.IO moves the messages.** Excalidraw supplies the drawing interface. Sketchblock supplies permissions, session lifecycle, recovery, and explicit board saves. Editing the same property at the same time follows the data model's conflict rules; a consistent result does not preserve every competing value.

Further reading: [Yjs introduction](https://docs.yjs.dev/) and [Socket.IO introduction](https://socket.io/docs/v4/).

## Live editing and explicit saves

Live collaboration and a saved board have separate lifecycles:

1. The web application opens the provider's board and creates or registers the collaboration session. It records the starting content revision or SHA for later conflict checks.
2. The browser obtains a session-scoped collaboration ticket and connects to the collaboration server. An admitted editor exchanges Yjs updates; viewers receive the board according to their role. Presence is distributed through realtime events.
3. The collaboration server holds each active Yjs document in memory. It applies accepted updates and schedules encoded state persistence with a short debounce. Stored Yjs state can rehydrate a document after it has been released or the process has restarted. Snapshot checkpoints also carry drawing content, app state, and files.
4. The owner requests **Save** through the Next.js API. The web application fetches the current collaboration state, uses materialized Yjs content for the elements and checkpoint data for the remaining drawing content, and calls the selected drawing storage adapter.
5. A successful save updates the board revision and session status. GitHub storage creates a repository commit; instance storage creates a database-backed board revision.

A persisted collaboration document supports session recovery. The owner save establishes the board's durable provider revision. Collaborators edit the shared session through their role without performing repository commits themselves.

Repository-backed saves use the revision recorded at session start for optimistic concurrency. A conflicting provider update produces a storage conflict instead of silently overwriting a newer board. The demo storage adapter has simpler save behavior and does not implement the same SHA conflict check.

Ad-hoc sessions use a separate lifecycle. Their save endpoint directs users to download the drawing; their collaboration state remains subject to room cleanup and retention. Export produces an Excalidraw file that the user can keep independently of the room.

## Board providers and identity

`DrawingStoragePort` defines list, open, and save operations, with additional board-management operations where supported. `getDrawingStorage` selects an adapter by the repository record's provider. Demo authentication mode explicitly selects the demo store.

| Provider or room type | Board destination | Access model |
| --- | --- | --- |
| `github` | `.excalidraw` files in the selected repository and branch | Owner has a linked GitHub account and repository access; participants join the Sketchblock session |
| `instance` | Owner-scoped workspace boards and revisions in application Postgres | Local instance identity; provider access is scoped to the workspace owner |
| `demo` | Demo drawing store | Demo identity and sample board behavior |
| Ad-hoc room | Downloaded Excalidraw file for long-term retention | Room owner and invited participants; session state supports collaboration until cleanup |

Authentication mode and storage provider describe different concerns. Linking GitHub supplies credentials for GitHub-backed operations. Session invitations and signed collaboration tickets supply access to a specific collaboration session. Invited participants authenticate with a local account or an existing GitHub sign-in. The anonymous guest role is a viewer and is available when the owner explicitly enables guest access. An instance workspace is represented by a pseudo-repository record so the same drawing use cases can select its storage adapter.

## Trust boundaries

The web application verifies owner identity and ownership before sensitive session management and save operations. Invitation claims establish participant session access. The web application issues signed, expiring collaboration tickets containing session and role information; the collaboration service verifies those tickets and enforces room permissions at its HTTP and realtime adapters.

GitHub credentials stay in the web-side integration. The collaboration server receives session authorization rather than repository credentials. Its authenticated HTTP API lets the web application register and manage rooms and obtain current state. Browser Socket.IO admission uses the session ticket, followed by checks on incoming events.

The configured origins, shared collaboration signing secret, endpoint URLs, and deployment mode therefore form part of the runtime contract. See [Security](./security.md) for the security model and [Operations](../operations/configuration.md) for configuration and deployment guidance.

## Internal structure and schema ownership

The collaboration server follows hexagonal architecture:

- **Domain** entities and policies describe session roles, lifecycle, snapshots, and access rules.
- **Application** use cases orchestrate registration, state updates, closure, inspection, and purge through ports.
- **Infrastructure** adapters implement HTTP, Socket.IO, signed-ticket verification, Postgres persistence, configuration, and logging.

Domain and application rules remain independent of transport and persistence details. NestJS controllers and gateways validate and map requests before invoking use cases.

The web application separates API route handling from server-side drawing use cases, authentication helpers, database stores, and provider adapters. Provider selection sits behind the drawing storage port rather than in browser code.

Flyway SQL migrations are the schema source of truth. Compose runs separate `flyway-app` and `flyway-collab` jobs after Postgres becomes healthy. Each service waits for its corresponding migration job to finish before starting. Flyway participates in deployment and schema evolution; it is outside the live canvas update path.

## Current deployment constraint

The current deployment assumes one web application instance and one collaboration-server instance. Web-side rate limits and bootstrap coordination are process-local. Active Yjs documents, socket room membership, participant exclusions, and persistence queues live in that process. Postgres supplies stored recovery state; it does not distribute active rooms between replicas. Multiple collaboration replicas require an explicit cross-instance synchronization and room-coordination design.

This view describes the current source and default Compose stack. It deliberately keeps reverse proxies, TLS termination, monitoring, and deployment-specific networking in the operations documentation so the two core paths—live collaboration and explicit board saves—remain visible.

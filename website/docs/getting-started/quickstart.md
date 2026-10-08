---
title: Quickstart
description: Run Sketchblock locally without GitHub credentials.
---

import Admonition from '@theme/Admonition';

import {ScreenshotFigure} from '@site/src/components/GettingStartedVisuals';

# Quickstart

The fastest path to Sketchblock is the built-in demo workspace. It runs locally, needs no GitHub credentials, and exercises the real editor and collaboration runtime.

## Requirements

- Docker Desktop or Docker Engine with Compose v2
- Git
- `curl` and `openssl`

## Start the stack

```bash
git clone https://github.com/mimeonline/sketchblock.git
cd sketchblock
./scripts/start.sh
```

Open [http://localhost:4512](http://localhost:4512). The script starts Postgres, runs both Flyway schemas, launches the web and collaboration services, and waits for their health checks.

## Try the core flow

The screenshots use an example architecture diagram in the local demo; the included welcome board starts with different content.

<ol>
  <li>
    <strong>Open the board.</strong> Open <strong>Boards</strong> and choose the included <strong>Getting started</strong> board.
    <ScreenshotFigure
      src="/img/docs/getting-started/overview.png"
      alt="Sketchblock local overview showing the Getting started board ready to open"
      caption="The Boards gallery shows the available boards and active collaboration."
    />
  </li>
  <li>
    <strong>Edit and save.</strong> Change the board in the editor and save it to the local demo workspace.
    <ScreenshotFigure
      src="/img/docs/getting-started/editor.png"
      alt="Sketchblock editor showing an Excalidraw board with the local save status"
      caption="The editor is the same real canvas used by the collaboration flow."
    />
  </li>
  <li>
    <strong>Invite the room.</strong> Open <strong>Collaboration</strong>, start a live session, and copy the collaborator link into a second browser window. Use a private window for the viewer link.
    <ScreenshotFigure
      src="/img/docs/getting-started/invitations.png"
      alt="Sketchblock invitation panel with separate collaborator and viewer links"
      caption="Role-specific links make the expected access visible before anyone joins."
    />
  </li>
</ol>

<Admonition type="tip" title="Expected start">

Open [http://localhost:4512](http://localhost:4512). You should see the Sketchblock workspace with the Getting started board available and the collaboration controls ready to use.

</Admonition>

The built-in demo uses one shared identity. It is useful for learning the workflow; test real owner, collaborator, viewer, and private-workspace boundaries with separate local accounts.

## Stop or reset

```bash
./scripts/stop.sh
./scripts/reset.sh
```

Stopping keeps the Postgres volume. Resetting asks for explicit confirmation and removes all local Sketchblock data.

## Diagnose startup

```bash
./scripts/doctor.sh
docker compose logs -f web collab-server
```

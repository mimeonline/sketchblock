---
title: Quickstart
description: Run Sketchblock locally without GitHub credentials.
---

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

1. Open the included **Getting started** board.
2. Change the board and save it to the local demo workspace.
3. Open **Collaboration** and start a live session.
4. Copy the collaborator link into a second browser window.
5. Open the viewer link in another private window to verify read-only access.

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

# Architecture

Sketchblock consists of:

- a Next.js web application for authentication, repositories, boards, sessions, administration, and the editor shell,
- a NestJS and Socket.IO collaboration server,
- Postgres databases for application and collaboration persistence,
- Flyway migrations as the schema source of truth,
- GitHub as the production board source.

The collaboration server follows hexagonal architecture. Domain and application code do not depend on Socket.IO, HTTP, Postgres, or filesystem implementations.

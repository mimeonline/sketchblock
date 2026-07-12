# Contributing to Sketchblock

Sketchblock is preparing its first public release. The contribution and licensing model will be finalized before `v0.1.0`.

## Before opening a pull request

1. Open or reference a focused issue.
2. Keep changes scoped to one product or technical concern.
3. Preserve the documented Next.js route-first UI structure and NestJS hexagonal boundaries.
4. Add or update tests for changed behavior.
5. Update public documentation when user-facing behavior changes.

## Validation

Run the relevant checks:

```bash
cd apps/web && pnpm run check
cd apps/collab-server && pnpm run check
cd website && pnpm run typecheck && pnpm run build
docker compose config --quiet
```

## Security

Follow [SECURITY.md](SECURITY.md) for vulnerability reports. Never include secrets, private repository content, personal data, or production logs in issues or pull requests.

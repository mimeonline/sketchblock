# Releasing Sketchblock

Sketchblock releases are immutable SemVer tags. A pushed tag builds the Web and Collaboration container images, attaches provenance, and creates a GitHub Release from the matching `CHANGELOG.md` section.

## Prepare a release

1. Choose the next version according to SemVer.
2. Update every package version that represents the release.
3. Add a dated section to `CHANGELOG.md` using `## X.Y.Z - YYYY-MM-DD`.
4. Update user-facing documentation and `ROADMAP.md` when direction or supported behavior changed.
5. Run the complete verification:

   ```bash
   cd apps/web && pnpm run check && pnpm audit
   cd ../collab-server && pnpm run check && pnpm audit
   cd ../../website && pnpm run check && pnpm audit
   cd ..
   docker compose config --quiet
   ./scripts/changelog-section.sh vX.Y.Z
   ```

6. Run `./scripts/start.sh` from a clean local Docker volume and complete the documented smoke checks.
7. Commit the release preparation and verify a clean working tree.

## Publish a release

```bash
git tag -a vX.Y.Z -m "Sketchblock vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

The tag push triggers `.github/workflows/release-images.yml`. Do not create or move a release tag until the CI workflow on `main` is green.

## Verify after publishing

- GitHub Release notes match the version section in `CHANGELOG.md`.
- `ghcr.io/<owner>/sketchblock-web:X.Y.Z` exists for `linux/amd64` and `linux/arm64`.
- `ghcr.io/<owner>/sketchblock-collab-server:X.Y.Z` exists for both platforms.
- Image attestations are present.
- GitHub Pages serves the landing page, documentation, sitemap, robots file, and `llms.txt`.
- A clean checkout starts in demo mode with `./scripts/start.sh`.

If publication fails after the tag was pushed, keep the tag immutable, fix the workflow on `main`, and rerun the failed GitHub Actions job. Publish a new patch version when release contents must change.

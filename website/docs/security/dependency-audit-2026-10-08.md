# Dependency audit — 2026-10-08

This note records the remaining advisories after compatible dependency updates
for the v0.3.0 release. Each audit was run against its package-local lockfile
with `pnpm audit --json` after the update. The final audit counts are:

| Package | Remaining advisories |
| --- | --- |
| Web | 2: 1 high, 1 low |
| Collaboration server | 0 |
| Website | 4: 2 critical, 1 high, 1 moderate |

The web typecheck, lint, tests, and production build pass. The website build
passes with `pnpm run check`. These retained, documented findings mean the
release audit result is conditional rather than zero-risk.

## Web findings

### `braces@3.0.3` — high

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
describes stack exhaustion from deeply nested brace patterns. The exact paths
in the final web audit are:

- `@excalidraw/excalidraw > sass > chokidar > braces`
- `eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch > braces`
- `shadcn > @shadcn/registry > fast-glob > micromatch > braces`
- `shadcn > @shadcn/registry > ts-morph > @ts-morph/common > fast-glob > micromatch > braces`
- `shadcn > fast-glob > micromatch > braces`
- `shadcn > ts-morph > @ts-morph/common > fast-glob > micromatch > braces`

These paths process local source trees, watched files, and glob expressions in
the development and build toolchain. Sketchblock's HTTP and realtime
interfaces accept application data under their defined contracts; glob
expressions remain local toolchain inputs. Excalidraw's Sass path is bundled at
build time, while the remaining paths belong to linting or the shadcn
development CLI. Builds and development commands therefore remain limited to
trusted repository inputs and controlled environments.

The advisory identifies `3.0.4` as patched, but that version was not published
in the npm registry during this audit. A forced override cannot provide the
missing artifact. The next action is to update the lockfile as soon as a
patched `braces` release is published and accepted by the upstream ranges, then
repeat the web typecheck, lint, tests, build, and audit.

### `katex@0.16.47` — low, conditional

[GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7)
describes a bypass of KaTeX trust restrictions when an existing prototype
pollution condition is already present. The exact web path is:

- `@excalidraw/excalidraw > @excalidraw/mermaid-to-excalidraw > mermaid > katex`

The finding is retained because the prerequisite prototype-pollution state is
conditional and the installed KaTeX version remains in the affected range.
The reviewed evidence covers the dependency path and advisory precondition;
runtime confirmation of that precondition remains outstanding. Repository
content and Mermaid conversion input remain subject to the application's
existing authenticated workspace and repository boundaries.

The advisory's patched version is `0.18.2`. That release lies outside the
current Excalidraw/Mermaid dependency range, so a direct override would cross
an upstream compatibility boundary. The next action is to take the compatible
KaTeX update through an Excalidraw or Mermaid release, then verify Mermaid
conversion, editor rendering, tests, and the production build. Any newly found
prototype-pollution path in the web runtime raises this finding for immediate
reassessment.

## Website scope and reachability

The affected packages are build and development dependencies of Docusaurus.
The generated `website/build/` directory is static output: it does not ship
the Node.js dependency tree, and these packages are not browser runtime code.

The `braces` path is reached through Docusaurus' webpack development server,
watcher, and glob tooling. The `postcss-selector-parser` path is reached by
the webpack CSS minimization stack. Both paths are exercised by the local or
CI build toolchain rather than by requests to the published static site.

The two `tinypool` advisories are reached through
`@docusaurus/core@3.10.2 > tinypool@1.1.1`. This website sets `future: {v4:
true}`. Docusaurus resolves that flag to `fasterByDefault: true`, which
enables the SSG worker-thread pool during production builds. The pool options
and worker entry point are supplied by Docusaurus; the website does not pass
request data or document content into Tinypool options.

The build boundary remains material: Docusaurus executes configuration,
plugins, and MDX processing as part of a build. Builds therefore use trusted
repository source, configuration, and dependency inputs. The development
server is for local or controlled environments and must not be exposed as a
public application service.

## Website findings

| Package and version | Severity | Dependency path | Advisory |
| --- | --- | --- | --- |
| `braces@3.0.3` | High | `@docusaurus/core > webpack-dev-server > http-proxy-middleware > micromatch > braces` | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |
| `postcss-selector-parser@6.1.4` | Moderate | `@docusaurus/core > webpack-dev-server > webpack-dev-middleware > webpack > minimizer-webpack-plugin > cssnano > cssnano-preset-default > postcss-merge-longhand > stylehacks > postcss-selector-parser` | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) |
| `tinypool@1.1.1` | Critical | `@docusaurus/core > tinypool` | [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) |
| `tinypool@1.1.1` | Critical | `@docusaurus/core > tinypool` | [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) |

The audit reports `postcss-selector-parser` fixes from `7.1.6` onward and
Tinypool fixes from `2.1.1`/`2.1.2` onward. These are major-version jumps
relative to the Docusaurus 3.10.2 dependency graph. The audit reports no
patched version for `braces@3.0.3`.

## Website upstream constraint and decision

The website uses the current stable Docusaurus 3.10.2 line. Its package
metadata declares `tinypool` as `^1.0.2`; the reachable installation is
`1.1.1`. Docusaurus' CSS toolchain currently resolves the affected parser as
`6.1.4`, while a patched advisory version starts at major 7. A direct override
would cross those upstream compatibility boundaries without a Docusaurus
compatibility guarantee, so this release keeps the lockfile coherent and does
not add a blind override.

`@docusaurus/faster` is actively used here. It is an optional peer of
Docusaurus core, but `future.v4: true` enables the faster defaults, including
the Rspack and SSG worker-thread paths. Removing the direct package would
change the configured build mode and does not provide a safe advisory fix.

## Website mitigation and next action

- Build and serve the generated static directory with a static host; do not
  expose `docusaurus start` or another development server to untrusted users.
- Run website builds from trusted repository source and review dependency or
  plugin changes before execution. Do not feed untrusted repositories,
  configuration, glob patterns, or CSS into the build process.
- Keep the lockfile and audit check in CI. Re-evaluate these findings when a
  Docusaurus release updates the Tinypool and PostCSS dependency constraints,
  or when a patched `braces` release becomes available.
- Treat a future Docusaurus major upgrade as a compatibility task: test the
  `future.v4`/Faster build path and the generated static output before taking
  the advisory fixes.

The current evidence supports shipping the static website with these
toolchain findings documented and controlled by the build boundary. It does
not support claiming a clean dependency audit or a runtime vulnerability
fix.

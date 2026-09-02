# 0026 — Splitting `simply-node` into `simply-node` + `simply-plugins`

**Status:** Draft
**Package:** repo-wide (`pnpm-workspace.yaml`, `lerna.json`, `.github/`, every `packages/*`, `site/`)
**Date:** 2026-09-02

## Problem

`simply-node` currently holds two kinds of packages with different audiences and different release
cadences:

- **Library packages** (`simply-core`, `simply-aep-core`, `simply-apex-core`,
  `simply-document-core`, `simply-report`) — plain Node/TypeScript logic with no oclif dependency,
  meant to be consumed directly (editor tooling, CI scripts, or other future non-CLI callers) as
  well as by our own plugins.
- **oclif plugin packages** (`simply`, `simply-aep`, `simply-apex`, `simply-cicd`,
  `simply-community`, `simply-data`, `simply-document`, `simply-flow`, `simply-package`,
  `simply-permissions`, `simply-project`, `simply-schema`, `simply-sobject`) plus `simply-plugin-kit`
  (shared oclif `Command` building blocks) and `site/` (the docs site that documents the plugins'
  commands) — all inherently tied to the Salesforce CLI / oclif plugin framework.

Keeping both in one repo means every plugin-only concern (oclif version bumps, CLI-specific CI,
plugin release cadence, the docs site) sits on top of the library packages, and vice versa. It also
means anyone who only wants to consume the libraries (e.g. editor tooling embedding
`simply-apex-core`) has to clone/watch a repo that's mostly CLI commands.

## Decision

Split `simply-node` into two repositories:

- **`simply-node`** (existing repo, existing GitHub URL) keeps the underlying, non-oclif library
  packages.
- **`simply-plugins`** (new repo) gets the oclif plugin packages, `simply-plugin-kit`, and `site/`.

The two repos are joined only by npm: packages in `simply-plugins` depend on the `simply-node`
libraries as ordinary published `^x.y.z` npm dependencies instead of `workspace:^x.y.z`. No other
runtime coupling exists — confirmed below.

### Final package placement

| Repo             | Packages                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `simply-node`    | `simply-core`, `simply-aep-core`, `simply-apex-core`, `simply-document-core`, `simply-report`                                                                                                                                                        |
| `simply-plugins` | `simply`, `simply-plugin-kit`, `simply-aep`, `simply-apex`, `simply-cicd`, `simply-community`, `simply-data`, `simply-document`, `simply-flow`, `simply-package`, `simply-permissions`, `simply-project`, `simply-schema`, `simply-sobject`, `site/` |

`simply-plugin-kit` moves with the plugins: it wraps `@oclif/core`'s `Command` class and ships no
independent value outside an oclif plugin, so it's meaningless as a `simply-node` library the way
`simply-core` (plain utilities) or `simply-report` (HTML scaffolding, no oclif dep) are.
`site/` moves too, since `site/scripts/sync-command-reference.mjs` already walks the plugin
packages' READMEs to build the command reference — it moves with what it documents.

### Confirmed dependency graph (why the split is clean)

Checked every `packages/*/package.json`:

- The five library packages have **zero** `@oclif/*` dependencies and **zero** dependencies on each
  other except `simply-apex-core → simply-core`. Both stay in `simply-node`, so that edge stays
  intra-repo.
- Every plugin package depends on one or more of the five libraries via `workspace:^` — these become
  the only cross-repo edges (see table below).
- `simply-plugin-kit` has no dependency on any other `simply-*` package (only `@oclif/core`,
  `@salesforce/core`, `@salesforce/sf-plugins-core`) — no cross-repo edge introduced by moving it.
- The `simply` orchestrator's `oclif.plugins` list and its `dependencies` only reference other plugin
  packages (all moving to `simply-plugins`) — no cross-repo edge there either.

| Plugin (→ `simply-plugins`)  | Depends on (→ `simply-node`)                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| `simply-aep`                 | `simply-aep-core`, `simply-core`                                    |
| `simply-apex`                | `simply-apex-core`, `simply-core`, `simply-plugin-kit` (intra-repo) |
| `simply-apex-core` _(stays)_ | `simply-core` — intra-`simply-node`, listed for completeness        |
| `simply-cicd`                | `simply-core`                                                       |
| `simply-community`           | `simply-core`, `simply-plugin-kit` (intra-repo)                     |
| `simply-data`                | `simply-core`, `simply-plugin-kit` (intra-repo)                     |
| `simply-document`            | `simply-document-core`                                              |
| `simply-flow`                | `simply-core`, `simply-plugin-kit` (intra-repo)                     |
| `simply-package`             | `simply-core`, `simply-plugin-kit` (intra-repo)                     |
| `simply-permissions`         | `simply-core`, `simply-plugin-kit` (intra-repo), `simply-report`    |
| `simply-schema`              | `simply-core`, `simply-report`                                      |
| `simply-sobject`             | `simply-core`, `simply-plugin-kit` (intra-repo), `simply-report`    |

## Behavior

Nothing user-facing (command behavior, flags, published package names) changes. What changes is
where the source lives and how it's built/released:

- `@simplysf/*` npm package names and public APIs are unchanged.
- `simply-plugins` packages pin `simply-node` library deps to real semver ranges (matching today's
  `workspace:^x.y.z` minimums) instead of the workspace protocol. Dependabot in `simply-plugins`
  then handles version bumps as it does for any other npm dependency.
- Both repos keep independent lerna versioning (`"version": "independent"`) and publish to npm
  under the same `@simplysf/` scope as today.

## Alternatives considered

- **Split further (one repo per package, or per `-core`/`-plugin` pair).** Rejected: the two
  categories already share tooling and release cadence within themselves (all libraries move in
  lockstep with few consumers to break; all plugins share the CLI test/release pipeline). Splitting
  further would multiply CI/release config for no isolation benefit.
- **Keep `simply-plugin-kit` in `simply-node`.** Considered, since it's "just a library" mechanically.
  Rejected because it has no reason to exist outside an oclif plugin context — treating it as a
  `simply-node` library would misrepresent what `simply-node` is for (framework-independent logic)
  and would add an `@oclif/core` dependency to that repo's dependency surface.
- **Leave `site/` in `simply-node`, point its sync script at `simply-plugins` over the network or a
  git submodule.** Rejected: more moving parts (submodule pinning, or fetching another repo's files
  in CI) for a docs site whose entire purpose is documenting the plugins.
- **Don't preserve git history on the split.** Considered for simplicity. Rejected per team decision
  — `git blame`/`git log` on moved files should keep working; history is preserved via
  `git filter-repo` path filtering into each new repo (see Implementation plan).

## Implementation plan

This doc covers planning only; the split itself is a separate, later change. In order:

1. **Extract history for each repo** using `git filter-repo` (or `git subtree split`) twice against
   a scratch clone of `simply-node`:
   - `simply-node`-bound tree: `--path packages/simply-core --path packages/simply-aep-core --path packages/simply-apex-core --path packages/simply-document-core --path packages/simply-report` plus the repo-root tooling files below.
   - `simply-plugins`-bound tree: `--path packages/simply --path packages/simply-plugin-kit --path packages/simply-aep ...` (full plugin list) `--path site` plus repo-root tooling files.
   - Root-level files needed by both (`.editorconfig`, `.gitignore`, `.husky/`, `.lintstagedrc.mjs`,
     `.prettierrc.mjs`, `commitlint.config.mjs`, `eslint.config.mjs`, `tsconfig.json`,
     `vitest.config.ts`, `vitest.nuts.config.ts`, `LICENSE.txt`, `CODE_OF_CONDUCT.md`) get copied into
     _both_ filtered trees so each repo is self-contained (filter-repo path filtering naturally
     drops anything not listed, so these need explicit `--path` entries on both runs).
2. **New `simply-plugins` repo**: create `SimplySF/simply-plugins` on GitHub, push the filtered
   history, and adjust:
   - `pnpm-workspace.yaml` → `packages: ['packages/*', 'site']` (same shape, fewer packages).
   - `lerna.json` → unchanged shape, packages list naturally shrinks to what's present.
   - Root `package.json` → same scripts; drop nothing package-manager-specific.
   - Each plugin's `package.json`: change `@simplysf/simply-core`/`simply-report`/`*-core`
     `workspace:^x.y.z` deps to plain `^x.y.z` (the version already in the range).
   - `.github/workflows/test.yml`, `release.yml` → copy as-is (they already run
     `lerna run` across whatever's in `packages/*`, no per-package hardcoding found).
   - `.github/workflows/docs.yml` → moves here wholesale (site now lives here).
   - `.github/dependabot.yml` → copy as-is (already `directory: '/'`, ecosystem-wide).
   - `CONTRIBUTING.md`/`CLAUDE.md`/`docs/design/README.md` → copy, trim references to library-only
     packages.
   - `docs/design/*.md` → the plugin-focused design docs (at4dx, apex, flow, permissions, document,
     package, cicd features) move here; renumbering not required, but update
     `docs/design/README.md`'s index to match what's present. The four library-extraction docs
     (0009, 0019, 0020, 0023) are duplicated into both repos' `docs/design/` (see Decision), since
     they describe both sides of this same boundary and each repo's design history should be
     self-contained.
3. **Update `simply-node`**: remove the now-moved packages from `packages/`, `pnpm-workspace.yaml`
   packages list unchanged in shape, `docs/design/README.md` index trimmed to what remains, README
   rewritten to describe it as the library-only repo with a link to `simply-plugins`.
4. **Cut a release** of the five `simply-node` libraries first (even at their current versions, so
   npm has a citable version), _then_ update `simply-plugins`' package.json ranges to match, so the
   very first `simply-plugins` CI run resolves real npm versions rather than failing on
   `workspace:^` protocol specifiers that no longer resolve.
5. **Update `README.md`** in `simply-node` (root) with a "This repo now only contains libraries;
   plugins moved to `simply-plugins`" note and link, mirrored in `simply-plugins`' new README.

## Testing

- After the split, `pnpm install && pnpm run build && pnpm run test` must pass standalone in each
  repo with no `workspace:` protocol references remaining outside a repo's own `packages/*`.
- `git log -- packages/simply-apex-core` (or any moved package) in each new repo should show the
  pre-split history, confirming `filter-repo` preserved it.
- CI (`test.yml`) green on both repos' `main` before treating the split as done; `release.yml`
  dry-run (`workflow_dispatch` without the prerelease input, i.e. "publish already-tagged versions
  missing from npm") should no-op cleanly since nothing new is tagged yet.

## Open questions

- **npm org/team access** for publishing from a second repo's CI — confirm the `NPM_TOKEN` secret
  (or equivalent) is provisioned for `simply-plugins` before its `release.yml` is expected to
  publish anything.
- **GitHub repo settings** (branch protection, required status checks, issue labels) on the new
  `simply-plugins` repo aren't covered here — needs a pass to mirror whatever's configured on
  `simply-node` today.
- **Existing open branches** against packages that are moving — see survey in Resolved below; only
  one needs action.

## Resolved

- **Design docs 0009/0019/0020/0023** (the `-core` library-extraction stories) are duplicated as-is
  into both repos' `docs/design/`, since each describes both sides of the boundary this split also
  concerns and each repo's design history should be self-contained.
- **Design doc placement, corrected**: checking every doc's `Package:` line (not just the four
  extraction stories above) turned up far more cross-boundary docs than expected — most of the AT4DX
  design history (0010-0018, 0022, 0025) lists both `simply-aep-core` (stays) and `simply-aep`
  (moves), and 0024 lists both `simply-apex-core` (stays) and `simply-apex` (moves). Since these
  document the `-core` library's actual data model/behavior, not just the command surface, they stay
  relevant to `simply-node` even though the plugin half moved out. Full disposition:
  - **Removed from `simply-node`, present only in `simply-plugins`** (plugin-only, no `-core`
    package involved): 0001, 0002, 0003, 0004, 0005, 0007, 0008, 0021.
  - **Kept in `simply-node`, and duplicated into `simply-plugins`** (cross-boundary — reference a
    `-core` package that stays as well as a plugin that moves, or are one of the four
    extraction-story docs): 0006, 0009, 0010, 0011, 0012, 0013, 0014, 0015, 0016, 0017, 0018, 0019,
    0020, 0022, 0023, 0024, 0025, plus this doc (0026).
  - `simply-plugins` additionally keeps its own copies of the plugin-only docs removed from
    `simply-node` above, so its design history is complete for everything that lives there.
- **In-flight branch survey** (2026-09-02): every remote branch on `origin` except one is 0 commits
  ahead of `main` (already merged/stale refs — includes all `dependabot-*`, `feat/*`, `fix/*`,
  `docs/*` branches and the `worktree-fix+at4dx-matcher-rule-values` local worktree branch). The one
  exception, `perf/wireit-command-snapshot-no-ts-node` (3 commits ahead), touches only files moving
  to `simply-plugins`: `packages/simply-aep`, `simply-apex`, `simply-cicd`, `simply-community`,
  `simply-data`, `simply-document`, `simply-flow`, `simply-package`, `simply-permissions`,
  `simply-project`, `simply-schema`, `simply-sobject`, `packages/simply`, `site/`, and root
  `pnpm-lock.yaml`. It should land (or be dropped) before the split, or be re-pointed at
  `simply-plugins` afterward — it touches nothing in `simply-node`, so either way it's a
  simply-plugins-side concern.

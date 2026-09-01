# Contributing

Thanks for your interest in contributing to Simply! This document covers the repo structure, how to get set up, and how to submit changes.

1. Please read our [Code of Conduct](CODE_OF_CONDUCT.md).
2. Create a new issue before starting significant work so we can keep track of what you're trying to add or fix, offer suggestions, and avoid duplicate effort.
3. Fork this repository.
4. [Set up your environment](#setup) and make sure you can build and test the affected package(s) locally.
5. Create a topic branch in your fork.
6. For a new command, a user-visible flag/output/error change, or a new shared module, write a design document in [`docs/design/`](docs/design/README.md) and get it agreed on before you start implementing.
7. Make your change, following the [commit message format](#commit-messages) below.
8. Write tests for your change. No pull request will be accepted without tests covering the change.
9. Open a pull request against `main`. We'll review your code, suggest any needed changes, and merge it in.

## Repository Structure

This repository is a Lerna monorepo containing thirteen Salesforce CLI plugins, plus six internal libraries. Every package has its own `CONTRIBUTING.md` covering what's specific to it — read this file first, then that one.

| Package                                                           | Description                                                                                                                                              | Bundled into `simply`?    |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| [`@simplysf/simply`](packages/simply)                             | Orchestrator plugin — bundles the plugins marked ✅ below                                                                                                | —                         |
| [`@simplysf/simply-aep`](packages/simply-aep)                     | Apex Enterprise Patterns commands (fflib, force-di, AT4DX)                                                                                               | ✅                        |
| [`@simplysf/simply-apex`](packages/simply-apex)                   | Apex commands                                                                                                                                            | ✅                        |
| [`@simplysf/simply-cicd`](packages/simply-cicd)                   | CI/CD pipeline commands                                                                                                                                  | No — installed on its own |
| [`@simplysf/simply-community`](packages/simply-community)         | Salesforce Communities commands                                                                                                                          | ✅                        |
| [`@simplysf/simply-data`](packages/simply-data)                   | File upload/download commands                                                                                                                            | ✅                        |
| [`@simplysf/simply-document`](packages/simply-document)           | Documentation generation commands                                                                                                                        | ✅                        |
| [`@simplysf/simply-flow`](packages/simply-flow)                   | Flow commands                                                                                                                                            | ✅                        |
| [`@simplysf/simply-package`](packages/simply-package)             | Package dependency management commands                                                                                                                   | ✅                        |
| [`@simplysf/simply-permissions`](packages/simply-permissions)     | Permissions commands                                                                                                                                     | ✅                        |
| [`@simplysf/simply-project`](packages/simply-project)             | Salesforce project commands                                                                                                                              | ✅                        |
| [`@simplysf/simply-schema`](packages/simply-schema)               | Schema visualization commands                                                                                                                            | ✅                        |
| [`@simplysf/simply-sobject`](packages/simply-sobject)             | SObject commands                                                                                                                                         | ✅                        |
| [`@simplysf/simply-core`](packages/simply-core)                   | Shared internal library — not a CLI plugin                                                                                                               | —                         |
| [`@simplysf/simply-plugin-kit`](packages/simply-plugin-kit)       | Shared oclif command building blocks — not a CLI plugin                                                                                                  | —                         |
| [`@simplysf/simply-report`](packages/simply-report)               | Shared HTML report scaffolding — not a CLI plugin                                                                                                        | —                         |
| [`@simplysf/simply-aep-core`](packages/simply-aep-core)           | AT4DX binding scan/resolve library — not a CLI plugin, and unlike the three libraries above, meant for direct use outside this monorepo too              | —                         |
| [`@simplysf/simply-document-core`](packages/simply-document-core) | Change report/technical design document rendering library — not a CLI plugin, and like `simply-aep-core`, meant for direct use outside this monorepo too | —                         |
| [`@simplysf/simply-apex-core`](packages/simply-apex-core)         | Apex execute/log-purge/trace-flag library — not a CLI plugin, and like `simply-aep-core`, meant for direct use outside this monorepo too                 | —                         |

The "bundled" column matters when you change a flag: see [Pull Requests](#pull-requests) below.

There's also a top-level [`site/`](site) directory — the [Astro Starlight](https://starlight.astro.build/) documentation site, deployed to GitHub Pages. It's part of the pnpm workspace (so `pnpm install` at the root sets it up too), but it's not a `packages/*` entry, so Lerna never versions, publishes, or runs `build`/`test`/`lint` scripts against it. See [`site/README` conventions below](#documentation-site) for how to work on it.

Tooling:

- **Package manager:** pnpm workspaces
- **Task orchestration:** Lerna v10 (independent versioning) + Wireit (per-package build caching)
- **Language:** TypeScript (ESM)
- **Node:** ^22.13.0 || ^24.0.0 || ^26.0.0 (required by Lerna 10; the published CLI plugins themselves only require >=22.0.0)

## Setup

This repo pins its pnpm version via the `packageManager` field in `package.json`. Use [Corepack](https://nodejs.org/api/corepack.html) (bundled with Node.js) to install that exact version rather than installing pnpm globally:

```sh
corepack enable
git clone git@github.com:SimplySF/simply-node.git
cd simply-node
corepack install   # installs the pnpm version pinned in package.json
pnpm install
pnpm run build
pnpm test
```

`corepack enable` only needs to be run once per machine. After that, Corepack transparently uses whatever version of pnpm is pinned in `package.json`, so every contributor and CI job runs the same version.

`pnpm install` at the root installs and links every workspace package and sets up git hooks automatically via husky.

To try your changes with the Salesforce CLI, run a plugin's local dev binary from inside its package directory:

```sh
cd packages/simply-data
./bin/dev.cmd simply data file upload --file-path fileToUpload.txt --target-org myTargetOrg
```

or link the package so you can run it from anywhere:

```sh
sf plugins link .
sf plugins
```

## Common Commands

Run from the repo root to target all packages:

```sh
pnpm run build       # lerna run build (compile + lint)
pnpm run compile     # lerna run compile
pnpm run lint        # lerna run lint
pnpm run test        # lerna run test
pnpm run test:only   # lerna run test:only
pnpm run format      # lerna run format
pnpm run reset       # clear node_modules, the lockfile, and all wireit/TS/ESLint caches
pnpm run reset:install  # same as reset, then reinstall dependencies
```

Run inside a single package directory to target just that package:

```sh
cd packages/simply-data
pnpm run build
pnpm test
```

## Adding a Dependency

To add a dependency to a specific package:

```sh
pnpm add <package> --filter @simplysf/simply-data
```

To add a root-level devDependency (e.g., a shared build tool):

```sh
pnpm add -w -D <package>
```

## Documentation Site

The [docs site](https://simplysf.github.io/simply-node/) lives in [`site/`](site) — an [Astro Starlight](https://starlight.astro.build/) site, deployed to GitHub Pages by `.github/workflows/docs.yml` on every push to `main` that touches `site/**` or any package's `README.md`/`package.json`.

```sh
pnpm --filter site run dev     # local preview at http://localhost:4321/simply/, auto-regenerates command reference pages
pnpm --filter site run build   # production build to site/dist, run before opening a PR that touches site/
```

Every page under `site/src/content/docs/cicd/reference/` and `site/src/content/docs/plugins/` is auto-generated by `site/scripts/sync-command-reference.mjs` from each package's oclif README — don't hand-edit those files, edit the source package's `messages/*.md` (then run that package's `pnpm run readme`) instead. Everything else under `site/src/content/docs/` (concepts, guides, the landing page) is hand-authored.

Internal links between docs pages should be root-relative (e.g. `/cicd/concepts/happy-soup-vs-project/`) — a remark plugin (`site/plugins/remark-base-links.mjs`) rewrites these to account for the site's `/simply` base path at build time. This does **not** apply to Starlight's `hero.actions` frontmatter on the landing page (`site/src/content/docs/index.mdx`), which needs the `/simply` prefix written out by hand — see the comment there if you're changing those links.

## Commit Messages

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint on commit). This matters beyond style: Lerna uses your commit types during release to decide which packages get versioned and how their `CHANGELOG.md` is generated.

```text
feat: add support for X
fix: correct handling of Y
docs: update README
chore: bump a dependency
```

If your change only affects one package, scope the commit to it, e.g. `feat(simply-data): add --max-parallel-jobs flag`.

## Pull Requests

- Keep pull requests focused on a single change where possible.
- If the change has a design document in [`docs/design/`](docs/design/README.md), update it to match what actually shipped, including its `Status` line and its row in the index. A design doc that quietly disagrees with the code is worse than none.
- Make sure `pnpm run build` and `pnpm test` pass before opening the PR. CI runs both across every package; the pre-push hook runs the same checks but scoped to packages changed since the last release tag (see [Git Hooks](#git-hooks)), so a passing push doesn't guarantee a passing PR if your branch touches a root-level config file (e.g. `tsconfig.json`, `eslint.config.mjs`) that no single package's directory reflects.
- Aim for high test coverage on new code.
- Update the relevant package's README/command docs if you changed a command's flags or behavior. `packages/simply-data` regenerates its README command docs automatically on version bump (`oclif readme` runs from its `version` script); every other plugin package requires running `pnpm run readme` manually in that package and committing the result.
- `command-snapshot.json` (used to flag accidental breaking changes to commands/flags) regenerates automatically as part of each package's `pnpm run build` — just commit whatever changes. CI re-verifies with `git diff --exit-code` after `pnpm run build`, so a stale, uncommitted snapshot fails the build. This includes `packages/simply`'s own `command-snapshot.json` when you change a plugin bundled into `@simplysf/simply` (see the orchestrator's `oclif.plugins` list): its wireit `command-snapshot` task cross-depends on every bundled plugin's `compile` task, so a root `pnpm run build` (or `pnpm run build` from within `packages/simply`) picks up dependency flag changes and regenerates it without any extra step.

## Versioning and Publishing

Versioning uses Lerna's independent mode — each package has its own version and can release separately.

The `release` workflow runs on pushes to `main` and, in a single step, bumps versions, updates each package's `CHANGELOG.md`, creates git tags in the format `@simplysf/simply@<version>`, pushes them, creates a GitHub release per changed package, and publishes each bumped package to npm:

```sh
lerna publish --conventional-commits --create-release github --yes
```

### Prerelease

Push to a `prerelease/**` branch (e.g., `prerelease/my-feature`) to trigger a prerelease, versioned and published the same way:

```sh
lerna publish --conventional-commits --conventional-prerelease --preid dev --create-release github --yes
```

### Recovering a Failed Publish

If a version was tagged and released but npm publish failed for one or more packages (e.g. a registry outage), trigger the `release` workflow manually (`workflow_dispatch`) with the `prerelease` input left blank. This runs `lerna publish from-package --yes`, which compares each package's committed version against what's actually on npm and publishes anything missing, without bumping versions again.

## CI

| Workflow      | Trigger                                               | What it does                                                                                                                                                                            |
| ------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test.yml`    | Push to non-main branches                             | Runs `pnpm run build` + `pnpm test` on Linux (lts/_, lts/-1) and Windows (lts/_)                                                                                                        |
| `release.yml` | Push to `main` or `prerelease/**`, or manual dispatch | Runs `pnpm run build` + `pnpm test`, then bumps versions, tags, creates GitHub releases, and publishes to npm in one step (see [Versioning and Publishing](#versioning-and-publishing)) |

## Git Hooks

| Hook         | Command                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------- |
| `pre-commit` | `lint-staged` — runs `prettier --write` on staged files                                       |
| `commit-msg` | `commitlint` — enforces conventional commit format                                            |
| `pre-push`   | `lerna run build --since --include-dependents && lerna run test --since --include-dependents` |

`pre-push` only builds/tests packages changed since the last release tag (plus their transitive
dependents) to keep the hook fast locally — CI (`test.yml`) always runs `pnpm run build` + `pnpm test`
across every package, so nothing changed here reduces what actually gates a merge.

Hooks are installed automatically on `pnpm install` via the `prepare: husky` script.

## Reporting Issues

Please report bugs or request features by [opening an issue](https://github.com/SimplySF/simply-node/issues) rather than submitting a PR without prior discussion for anything non-trivial.

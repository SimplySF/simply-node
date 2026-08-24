# Contributing to @simplysf/simply-aep

Commands for Apex Enterprise Patterns tooling (fflib, force-di, AT4DX). This package is part of the [`simply-node`](https://github.com/SimplySF/simply-node) monorepo.

**Start with the [root CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md).** It covers repository structure, environment setup, commit conventions, versioning and publishing, CI, git hooks, and the pull request process — all of which apply here. This file covers only what is specific to this package.

## Working on this package

Run from this directory to target just this package:

```sh
pnpm run build       # compile + lint + regenerate command-snapshot.json
pnpm test            # the full gate CI runs
pnpm run test:only   # just the unit tests, skipping lint and the doc gates
pnpm run lint
```

## Trying a command locally

Run this package's dev binary without installing it into the Salesforce CLI:

```sh
./bin/dev.js --help          # macOS/Linux
./bin/dev.cmd --help         # Windows
```

Or link it so `sf` picks it up from anywhere:

```sh
sf plugins link .
```

## Command help text

Summaries, descriptions, examples, and error messages live in [`messages/`](messages), not in the command source. Edit the relevant `messages/*.md` file, then regenerate the README command reference:

```sh
pnpm run readme
```

Commit the regenerated `README.md`. The docs site derives its command reference pages from it, so a stale README means stale published docs.

## Command snapshot

`command-snapshot.json` records every command and flag so that accidental breaking changes surface in review. It regenerates as part of `pnpm run build` — commit whatever changes. CI re-verifies with `git diff --exit-code`, so a stale snapshot fails the build.

> **If you add, remove, or rename a flag here, also rebuild [`packages/simply`](https://github.com/SimplySF/simply-node/tree/main/packages/simply)'s snapshot.** `@simplysf/simply-aep` is bundled into the orchestrator plugin, so its aggregated snapshot carries these flags too. The orchestrator's wireit cache only watches `packages/simply/src/**/*.ts`, so a plain `pnpm run build` there reports cached success without regenerating anything — the drift only surfaces in CI. Force it:

> ```sh
> cd ../simply
> node --loader ts-node/esm --no-warnings=ExperimentalWarning ./bin/dev.js snapshot:generate
> npx prettier --write command-snapshot.json
> ```

## Tests

No pull request is accepted without tests covering the change. Tests live in [`test/`](test), mirroring the `src/` layout, and run under [Vitest](https://vitest.dev/).

## Reporting issues

Please [open an issue](https://github.com/SimplySF/simply-node/issues) rather than sending a pull request for anything non-trivial without prior discussion.

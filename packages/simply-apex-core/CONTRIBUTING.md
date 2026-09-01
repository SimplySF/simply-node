# Contributing to @simplysf/simply-apex-core

Apex execute/log-purge/trace-flag logic. This package is part of the [`simply-node`](https://github.com/SimplySF/simply-node) monorepo.

**Start with the [root CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md).** It covers repository structure, environment setup, commit conventions, versioning and publishing, CI, git hooks, and the pull request process — all of which apply here. This file covers only what is specific to this package.

## Working on this package

Run from this directory to target just this package:

```sh
pnpm run build       # compile + lint
pnpm test            # the full gate CI runs
pnpm run test:only   # just the unit tests, skipping lint and the doc gates
pnpm run lint
```

## This is a library, not a CLI plugin — and not a purely internal one

There are no commands, no `command-snapshot.json`, and no `messages/` help text here. Unlike `@simplysf/simply-core`, `@simplysf/simply-plugin-kit`, and `@simplysf/simply-report` — which are internal to this monorepo and only happen to be published as a side effect of the release process — `@simplysf/simply-apex-core` is meant to be installed and imported directly by projects outside this repo (e.g. editor tooling or a CI script that wants the same behavior without shelling out to the `sf` CLI). Hold its README, versioning, and dependency footprint to that bar.

The public surface is whatever [`src/index.ts`](src/index.ts) re-exports; anything not exported from there is internal and can change freely. Adding to the public surface means adding an export to `src/index.ts` **and** documenting it in [`README.md`](README.md)'s `## API` section — the README is the API reference for this package, so leaving it stale makes the change incomplete. `test/index.test.ts` asserts the exported-key list; update it deliberately when the surface changes, so an accidental removal fails loudly instead of shipping quietly.

`@simplysf/simply-apex` (the CLI package) depends on this package for its command logic — see its `src/commands/`.

## Tests

No pull request is accepted without tests covering the change. Tests live in [`test/`](test), mirroring the `src/` layout, and run under [Vitest](https://vitest.dev/).

## Reporting issues

Please [open an issue](https://github.com/SimplySF/simply-node/issues) rather than sending a pull request for anything non-trivial without prior discussion.

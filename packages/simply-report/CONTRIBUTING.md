# Contributing to @simplysf/simply-report

Shared HTML report scaffolding for SimplySF Salesforce CLI plugins. This package is part of the [`simply-plugins-core`](https://github.com/SimplySF/simply-plugins-core) monorepo.

**Start with the [root CONTRIBUTING.md](https://github.com/SimplySF/simply-plugins-core/blob/main/CONTRIBUTING.md).** It covers repository structure, environment setup, commit conventions, versioning and publishing, CI, git hooks, and the pull request process — all of which apply here. This file covers only what is specific to this package.

## Working on this package

Run from this directory to target just this package:

```sh
pnpm run build       # compile + lint
pnpm test            # the full gate CI runs
pnpm run test:only   # just the unit tests, skipping lint and the doc gates
pnpm run lint
```

## This is a library, not a CLI plugin

There are no commands and no `command-snapshot.json` here, and no `messages/` help text. The public surface is whatever [`src/index.ts`](src/index.ts) re-exports; anything not exported from there is internal and can change freely.

Adding to the public surface means adding an export to `src/index.ts` **and** documenting it in [`README.md`](README.md) — the README is the API reference for this package, so leaving it stale makes the change incomplete.

Consumers resolve this package through the pnpm workspace link, so a change here reaches every package that depends on it. Run the whole repo's tests before opening a pull request:

```sh
cd ../.. && pnpm test
```

## Tests

No pull request is accepted without tests covering the change. Tests live in [`test/`](test), mirroring the `src/` layout, and run under [Vitest](https://vitest.dev/).

## Reporting issues

Please [open an issue](https://github.com/SimplySF/simply-plugins-core/issues) rather than sending a pull request for anything non-trivial without prior discussion.

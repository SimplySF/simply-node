# Contributing to @simplysf/simply-project-setup-core

Engine for standardizing a Salesforce DX project's files, `.gitignore`, and `package.json` dependencies/scripts from a consumer-supplied set of template packs, presets, and defaults. This package is part of the [`simply-node`](https://github.com/SimplySF/simply-node) monorepo.

**Start with the [root CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md).** It covers repository structure, environment setup, commit conventions, versioning and publishing, CI, git hooks, and the pull request process — all of which apply here. This file covers only what is specific to this package.

## Working on this package

Run from this directory to target just this package:

```sh
pnpm run build       # compile + lint
pnpm test            # the full gate CI runs
pnpm run test:only   # just the unit tests, skipping lint and the doc gates
pnpm run lint
```

## This is a library, not a CLI plugin

There are no commands, no `command-snapshot.json`, and no `messages/` help text here — and no
built-in templates, presets, or package.json defaults either. Everything shaped by a specific
project's conventions (which template packs exist, what a preset includes, what scripts a
`package.json` should carry) is supplied by whatever consumer command calls into this package; see
[docs/design/0035-simply-project-setup-core.md](https://github.com/SimplySF/simply-node/blob/main/docs/design/0035-simply-project-setup-core.md)
for why. Like `@simplysf/simply-schema-core`, this package is meant to be usable directly outside
this monorepo too. Hold its README, versioning, and dependency footprint to that bar.

# Contributing to @simplysf/simply-cicd-core

ALM issue linking (Jira, GitLab Issues) and VCS API clients (GitHub, GitLab). This package is part of the [`simply-node`](https://github.com/SimplySF/simply-node) monorepo.

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

There are no commands, no `command-snapshot.json`, and no `messages/` help text here. Unlike `@simplysf/simply-core` and `@simplysf/simply-report` — which are internal to this monorepo and only happen to be published as a side effect of the release process — `@simplysf/simply-cicd-core` is meant to be usable directly by projects outside this repo too (e.g. a bot or a CI script that wants to link commits to Jira tickets or query a GitLab merge request the same way `@simplysf/simply-cicd` does, without shelling out to the CLI). Hold its README, versioning, and dependency footprint to that bar.

## Scope

Only `alm/` and `vcs/` moved here from `@simplysf/simply-cicd`'s `common/` directory — see [docs/design/0037-simply-cicd-core.md](../../docs/design/0037-simply-cicd-core.md) for why the rest of it (`build/`, `deploy/`, `notify/`, `sfdxDependabot/`, and the CI-pipeline-flavored utility files) stayed in the CLI package.

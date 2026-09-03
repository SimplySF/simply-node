# @simplysf/simply-cicd-core

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-cicd-core?label=@simplysf/simply-cicd-core)](https://npmjs.com/@simplysf/simply-cicd-core) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-cicd-core.svg)](https://npmjs.com/@simplysf/simply-cicd-core) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

ALM issue linking (Jira, GitLab Issues) and VCS API clients (GitHub, GitLab). This is not a Salesforce CLI plugin — it's the library layer behind [`@simplysf/simply-cicd`](https://github.com/SimplySF/simply-plugins/tree/main/packages/simply-cicd)'s ALM/VCS integrations, published separately so it can be imported directly by anything that wants the same logic (a bot, a script, a CI job) without pulling in the CLI framework.

Only `alm/` and `vcs/` moved here — `@simplysf/simply-cicd` itself still owns everything CI-pipeline-shaped (running builds/deploys, shelling to `sf`/`git`, sending pipeline notifications). See [docs/design/0037-simply-cicd-core.md](https://github.com/SimplySF/simply-node/blob/main/docs/design/0037-simply-cicd-core.md) for the boundary and why the rest stayed behind.

## Install

```bash
npm install @simplysf/simply-cicd-core
```

Requires Node.js `>=22` and either `"type": "module"` or a dynamic `import()` — this package ships ESM only. Zero runtime dependencies — `vcs/`'s GitHub/GitLab clients use the platform `fetch`.

## API

Everything below is exported from the package root. Removing or renaming an export is a breaking change; see [`src/index.ts`](src/index.ts).

| Export                             | Description                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `createAlmProvider(kind)`          | Builds an `AlmProvider` for a registered ALM tool (`'jira'`, `'gitlab-issues'`).                             |
| `listAlmProviderKinds()`           | The ALM tools currently registered, for flag options and error messages.                                     |
| `registerAlmProvider(...)`         | Registers a custom `AlmProvider` implementation without modifying this package.                              |
| `JiraProvider`                     | Extracts `PROJECT-123`-style issue keys from commit-log text and renders them as plain-text/HTML links.      |
| `GitLabIssuesProvider`             | Extracts GitLab's bare `#123` issue references from commit-log text; project keys are not used.              |
| `createVcsProvider(kind, options)` | Builds a `VcsProvider` for a registered platform (`'github'`, `'gitlab'`), given host/token options.         |
| `listVcsProviderKinds()`           | The VCS platforms currently registered.                                                                      |
| `registerVcsProvider(...)`         | Registers a custom `VcsProvider` implementation without modifying this package.                              |
| `GitHubProvider`                   | A `VcsProvider` backed by the GitHub REST API — branches, merge requests (pull requests), CI variables, etc. |
| `GitLabProvider`                   | A `VcsProvider` backed by the GitLab REST API v4 — same surface as `GitHubProvider`.                         |

Types (`AlmProviderKind`, `AlmIssueRef`, `AlmIssueRendering`, `AlmProvider`, `AlmProviderFactory`,
`VcsProviderKind`, `VcsProject`, `VcsProjectRef`, `VcsBranch`, `VcsCommit`, `VcsCommitLogEntry`,
`VcsMergeRequest`, `VcsProjectVariable`, `VcsTerminology`, `VcsCiContext`, `VcsProviderOptions`,
`VcsProvider`, `VcsProviderFactory`) are also exported from the package root.

```ts
import { createAlmProvider } from '@simplysf/simply-cicd-core';

const jira = createAlmProvider('jira');
const issues = jira.extractIssues(commitLog, ['PROJ']);
const { html } = jira.render(issues, 'https://example.atlassian.net/browse');
```

```ts
import { createVcsProvider } from '@simplysf/simply-cicd-core';

const gitlab = createVcsProvider('gitlab', { token: process.env.GITLAB_TOKEN });
const mr = await gitlab.findMergeRequest({ sourceBranch: 'feature/x' });
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See [CONTRIBUTING.md](CONTRIBUTING.md) for what's specific to this package, and the repo's [root CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for repo structure, setup, commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.

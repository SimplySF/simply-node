---
title: simply-cicd-core
description: Usage examples for @simplysf/simply-cicd-core.
---

ALM issue linking (Jira, GitLab Issues) and VCS API clients (GitHub, GitLab) — the library layer
behind `@simplysf/simply-cicd`'s ALM/VCS integrations, published separately so it can be imported
directly without pulling in the CLI framework. Full signatures and types are in the
[API reference](/api/simply-cicd-core/readme/).

```sh
npm install @simplysf/simply-cicd-core
```

## Linking commits to ALM issues

```ts
import { createAlmProvider } from '@simplysf/simply-cicd-core';

const jira = createAlmProvider('jira');
const issues = jira.extractIssues(commitLog, ['PROJ']);
const { html } = jira.render(issues, 'https://example.atlassian.net/browse');
```

## Talking to a VCS platform

```ts
import { createVcsProvider } from '@simplysf/simply-cicd-core';

const gitlab = createVcsProvider('gitlab', { token: process.env.GITLAB_TOKEN });
const mr = await gitlab.findMergeRequest({ sourceBranch: 'feature/x' });
```

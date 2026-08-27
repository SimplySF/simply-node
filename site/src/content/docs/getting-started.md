---
title: Get Started
description: Requirements and installation for the Simply Salesforce CLI plugins.
---

## Requirements

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`)
- Node.js `^22.13.0`, `^24.0.0`, or `^26.0.0`

## Install

Install the orchestrator plugin to get every command from every plugin in one shot:

```sh
sf plugins install @simplysf/simply
```

Or install only the plugin(s) you need — each one works standalone:

```sh
sf plugins install @simplysf/simply-aep
sf plugins install @simplysf/simply-apex
sf plugins install @simplysf/simply-cicd
sf plugins install @simplysf/simply-community
sf plugins install @simplysf/simply-data
sf plugins install @simplysf/simply-document
sf plugins install @simplysf/simply-flow
sf plugins install @simplysf/simply-package
sf plugins install @simplysf/simply-permissions
sf plugins install @simplysf/simply-project
sf plugins install @simplysf/simply-schema
sf plugins install @simplysf/simply-sobject
```

## Verify it worked

```sh
sf simply --help
```

## Where to go next

- Looking for a specific plugin's commands? See the [Plugins overview](/plugins/) for what's available, or jump straight to a [command reference](/plugins/simply-apex/) page.
- Setting up CI/CD? Head to the [simply-cicd overview](/cicd/) for scratch-org builds, packaged and unpackaged deployments, and pipeline notifications.
- Want to contribute? See [CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) in the repo.

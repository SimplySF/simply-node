---
title: Plugins
description: The Simply CLI plugins for Apex, communities, data, documentation, package management, permissions, project metadata, schema, and SObjects.
---

`@simplysf/simply` is a monorepo of independently-installable Salesforce CLI plugins that handle the day-to-day work of building and maintaining a Salesforce org: working with Apex, publishing communities, moving data and files, generating documentation, managing package dependencies, building permission sets, updating project metadata, visualizing schema, and backing up or deduplicating SObject data.

## Install

Install the orchestrator to get every command from every plugin in one shot:

```sh
sf plugins install @simplysf/simply
```

Or install only the plugin(s) you need — each one works standalone:

```sh
sf plugins install @simplysf/simply-aep
sf plugins install @simplysf/simply-apex
sf plugins install @simplysf/simply-community
sf plugins install @simplysf/simply-data
sf plugins install @simplysf/simply-document
sf plugins install @simplysf/simply-package
sf plugins install @simplysf/simply-permissions
sf plugins install @simplysf/simply-project
sf plugins install @simplysf/simply-schema
sf plugins install @simplysf/simply-sobject
```

## Plugins

| Plugin                                               | What it's for                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| [`simply-aep`](/plugins/simply-aep/)                 | Apex Enterprise Patterns tooling (fflib, force-di, AT4DX)              |
| [`simply-apex`](/plugins/simply-apex/)               | Executing anonymous Apex, purging debug logs, and managing trace flags |
| [`simply-community`](/plugins/simply-community/)     | Publishing Salesforce Communities (Experience Cloud sites)             |
| [`simply-data`](/plugins/simply-data/)               | Uploading and downloading files in a Salesforce org                    |
| [`simply-document`](/plugins/simply-document/)       | Generating project documentation and change reports                    |
| [`simply-package`](/plugins/simply-package/)         | Managing package dependencies and versions                             |
| [`simply-permissions`](/plugins/simply-permissions/) | Analyzing and building permission sets                                 |
| [`simply-project`](/plugins/simply-project/)         | Working with Salesforce project metadata                               |
| [`simply-schema`](/plugins/simply-schema/)           | Generating and visualizing Salesforce schema                           |
| [`simply-sobject`](/plugins/simply-sobject/)         | Backing up, deduplicating, and tracking SObject data                   |

Looking for every command in one place? See the [full command reference](/plugins/simply/) for the orchestrator plugin.

## Where to start

- New to Simply? Follow [Get Started](/getting-started/) to install and verify the CLI.
- Need Salesforce CI/CD pipelines instead? See the [simply-cicd overview](/cicd/).

# Simply

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Simply is a collection of [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) plugins built by [SimplySF](https://github.com/SimplySF) that add commands for working with Apex, Apex Enterprise Patterns, CI/CD pipelines, Communities, data, documentation generation, packages, permissions, projects, schema visualization, and SObjects in Salesforce orgs.

📖 **[Documentation site](https://simplysf.github.io/simply-node/)** — guides and command reference for every plugin, with [`simply-cicd`](https://simplysf.github.io/simply-node/cicd/) covered in the most depth.

## Packages

This repository is a monorepo. Twelve packages are published independently to npm as CLI plugins, plus three internal libraries used by them:

| Package                                                       | Description                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`@simplysf/simply`](packages/simply)                         | Orchestrator plugin — bundles the plugins marked ✅ below                 |
| [`@simplysf/simply-aep`](packages/simply-aep)                 | Commands for Apex Enterprise Patterns tooling (fflib, force-di, AT4DX) ✅ |
| [`@simplysf/simply-apex`](packages/simply-apex)               | Commands for working with Apex ✅                                         |
| [`@simplysf/simply-cicd`](packages/simply-cicd)               | Commands for Salesforce CI/CD pipelines                                   |
| [`@simplysf/simply-community`](packages/simply-community)     | Commands for working with Salesforce Communities ✅                       |
| [`@simplysf/simply-data`](packages/simply-data)               | Commands for uploading and downloading files in a Salesforce org ✅       |
| [`@simplysf/simply-document`](packages/simply-document)       | Commands for generating project documentation ✅                          |
| [`@simplysf/simply-package`](packages/simply-package)         | Commands for managing package dependencies ✅                             |
| [`@simplysf/simply-permissions`](packages/simply-permissions) | Commands for working with permissions ✅                                  |
| [`@simplysf/simply-project`](packages/simply-project)         | Commands for working with Salesforce projects ✅                          |
| [`@simplysf/simply-schema`](packages/simply-schema)           | Commands for visualizing Salesforce schema ✅                             |
| [`@simplysf/simply-sobject`](packages/simply-sobject)         | Commands for working with SObjects ✅                                     |

Internal libraries — consumed by the plugins above, not Salesforce CLI plugins themselves:

| Package                                                     | Description                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| [`@simplysf/simply-core`](packages/simply-core)             | Querying, bulk export, CSV, and `sfdx-project.json` utilities |
| [`@simplysf/simply-plugin-kit`](packages/simply-plugin-kit) | Shared oclif command building blocks                          |
| [`@simplysf/simply-report`](packages/simply-report)         | Shared HTML report scaffolding                                |

See each package's README for its full command reference.

`@simplysf/simply-cicd` is published on its own and is **not** bundled into the orchestrator — install it directly if you want its commands.

## Installation

Install the orchestrator plugin to get every command in one shot, or install an individual plugin for just the commands you need:

```sh
sf plugins install @simplysf/simply
```

```sh
sf plugins install @simplysf/simply-aep
sf plugins install @simplysf/simply-apex
sf plugins install @simplysf/simply-cicd
sf plugins install @simplysf/simply-community
sf plugins install @simplysf/simply-data
sf plugins install @simplysf/simply-document
sf plugins install @simplysf/simply-package
sf plugins install @simplysf/simply-permissions
sf plugins install @simplysf/simply-project
sf plugins install @simplysf/simply-schema
sf plugins install @simplysf/simply-sobject
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the repo structure, how to set up and build the project, our commit conventions, and how to submit a pull request. Each package also has its own `CONTRIBUTING.md` covering what's specific to it — read the root one first, then that package's. Please also read our [Code of Conduct](CODE_OF_CONDUCT.md).

## Issues

Please report bugs or request features by [opening an issue](https://github.com/SimplySF/simply-node/issues) in this repository.

## License

Licensed under the [Apache-2.0](LICENSE.txt) license.

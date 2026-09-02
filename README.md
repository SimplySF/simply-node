# Simply

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

This repo holds the framework-independent Node/TypeScript libraries behind [SimplySF](https://github.com/SimplySF)'s [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) plugins — no oclif dependency, meant to be consumed directly (an editor extension, a CI script, or any other non-CLI caller) as well as by the plugins themselves.

The oclif plugins that consume these libraries — `simply`, `simply-aep`, `simply-apex`, `simply-cicd`, `simply-community`, `simply-data`, `simply-document`, `simply-flow`, `simply-package`, `simply-permissions`, `simply-project`, `simply-schema`, `simply-sobject`, plus `simply-plugin-kit` and the docs site — live in the sibling [`simply-plugins`](https://github.com/SimplySF/simply-plugins) repo. See [docs/design/0026](docs/design/0026-split-simply-node-simply-plugins-repos.md) for why the repos are split this way.

## Packages

This repository is a monorepo. Five packages are published independently to npm:

| Package                                                           | Description                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [`@simplysf/simply-core`](packages/simply-core)                   | Querying, bulk export, CSV, and `sfdx-project.json` utilities                   |
| [`@simplysf/simply-aep-core`](packages/simply-aep-core)           | Apex Enterprise Patterns (fflib, force-di, AT4DX) scan and resolution logic     |
| [`@simplysf/simply-apex-core`](packages/simply-apex-core)         | Apex execute/log-purge/trace-flag logic                                         |
| [`@simplysf/simply-document-core`](packages/simply-document-core) | Confluence-storage-format change report and technical design document rendering |
| [`@simplysf/simply-report`](packages/simply-report)               | Shared HTML report scaffolding                                                  |

`simply-aep-core`, `simply-apex-core`, and `simply-document-core` are meant for direct use outside
this monorepo too (an editor extension, a CI job, a script) — not just as the library layer behind
their respective [`simply-plugins`](https://github.com/SimplySF/simply-plugins) command packages.

See each package's README for its full API reference.

## Installation

```sh
npm install @simplysf/simply-core
npm install @simplysf/simply-aep-core
npm install @simplysf/simply-apex-core
npm install @simplysf/simply-document-core
npm install @simplysf/simply-report
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the repo structure, how to set up and build the project, our commit conventions, and how to submit a pull request. Each package also has its own `CONTRIBUTING.md` covering what's specific to it — read the root one first, then that package's. Please also read our [Code of Conduct](CODE_OF_CONDUCT.md).

## Issues

Please report bugs or request features by [opening an issue](https://github.com/SimplySF/simply-node/issues) in this repository. For the CLI plugins themselves, use [simply-plugins](https://github.com/SimplySF/simply-plugins/issues) instead.

## License

Licensed under the [Apache-2.0](LICENSE.txt) license.

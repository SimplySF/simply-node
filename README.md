# Simply Node

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A collection of framework-independent Node/TypeScript libraries for working with Salesforce, built by [SimplySF](https://github.com/SimplySF). Each package is a plain library with no CLI dependency — install it and call its functions directly from a script, an editor extension, a CI job, or any other Node codebase.

## Packages

This repository is a monorepo. Five packages are published independently to npm:

| Package                                                           | What it's for                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`@simplysf/simply-core`](packages/simply-core)                   | Querying, bulk export, CSV, and `sfdx-project.json` utilities                        |
| [`@simplysf/simply-aep-core`](packages/simply-aep-core)           | Apex Enterprise Patterns (fflib, force-di, AT4DX) binding scan and resolution logic  |
| [`@simplysf/simply-apex-core`](packages/simply-apex-core)         | Apex execute, log-purge, and trace-flag logic                                        |
| [`@simplysf/simply-document-core`](packages/simply-document-core) | Confluence-storage-format change report and technical design document rendering      |
| [`@simplysf/simply-report`](packages/simply-report)               | Shared HTML report scaffolding (page shell, base stylesheet, Handlebars environment) |

See each package's README for its full API reference and usage examples, or browse the [documentation site](https://simplysf.github.io/simply-node/) for API docs and code snippets across all five.

## Installation

Install whichever package(s) you need — they're independent, so there's no need to install all five:

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

Please report bugs or request features by [opening an issue](https://github.com/SimplySF/simply-node/issues) in this repository.

## License

Licensed under the [Apache-2.0](LICENSE.txt) license.

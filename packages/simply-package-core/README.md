# @simplysf/simply-package-core

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-package-core?label=@simplysf/simply-package-core)](https://npmjs.com/@simplysf/simply-package-core) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-package-core.svg)](https://npmjs.com/@simplysf/simply-package-core) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

Package/package-version alias resolution, `sfdx-project.json` dependency management, and Dev Hub version lookup logic. This is not a Salesforce CLI plugin — it's the library layer behind [`@simplysf/simply-package`](https://github.com/SimplySF/simply-plugins/tree/main/packages/simply-package)'s dependency/version commands, published separately so it can be imported directly by anything that wants the same logic (an editor extension, a CI job, a script) without pulling in the CLI framework.

## Install

```bash
npm install @simplysf/simply-package-core
```

Requires Node.js `>=22` and either `"type": "module"` or a dynamic `import()` — this package ships ESM only.

## API

Everything below is exported from the package root. Removing or renaming an export is a breaking change; see [`src/index.ts`](src/index.ts).

| Export                                                                                                                                            | Description                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `splitPackageAlias(value)`                                                                                                                        | Splits a package reference into its name and version parts, on the last `@`.                            |
| `findPackageVersions(project, packageName, options?)`                                                                                             | Finds every place a package name is declared in an `sfdx-project.json`, and the version declared there. |
| `buildVersionService(connection, project, filterIds?)`                                                                                            | Loads Dev Hub packages/versions and returns a queryable alias-resolution/version-choice service.        |
| `buildProjectService(project)`                                                                                                                    | Reads/writes an `sfdx-project.json`'s package dependencies and related plugin config.                   |
| `parseDependency(resolvedPackage, versionNumber?)`                                                                                                | Parses a resolved dependency reference into its component parts.                                        |
| `reducePackageInstallRequestErrors(request)`                                                                                                      | Formats a failed `PackageInstallRequest`'s errors as a numbered-list string.                            |
| `isDependenciesPackagingDirectory(packageDir)`                                                                                                    | Type guard narrowing a package directory to one that declares a `dependencies` array.                   |
| `isPackage2Id` / `isPackage2VersionId` / `isSubscriberPackageId` / `isSubscriberPackageVersionId`                                                 | Predicates for the four package-ID prefixes (`0Ho`, `05i`, `033`, `04t`).                               |
| `PACKAGE_PREFIX_PACKAGE2` / `PACKAGE_PREFIX_PACKAGE2_VERSION` / `PACKAGE_PREFIX_SUBSCRIBER_PACKAGE` / `PACKAGE_PREFIX_SUBSCRIBER_PACKAGE_VERSION` | The four package-ID prefix constants.                                                                   |
| `BasePackageDirWithDependenciesSchema`                                                                                                            | Zod schema for a package directory entry that declares a `dependencies` array.                          |

```ts
import { findPackageVersions, splitPackageAlias } from '@simplysf/simply-package-core';

const matches = findPackageVersions(project, 'MyPackage');
```

```ts
import { buildVersionService } from '@simplysf/simply-package-core';

const versionService = await buildVersionService(connection, sfProject);
const alias = versionService.getVersionAlias('04t000000000001AAA');
```

```ts
import { buildProjectService } from '@simplysf/simply-package-core';

const projectService = await buildProjectService(sfProject);
const dependenciesByDirectory = projectService.getDependenciesByDirectory();
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See [CONTRIBUTING.md](CONTRIBUTING.md) for what's specific to this package, and the repo's [root CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for repo structure, setup, commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.

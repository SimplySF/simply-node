---
title: simply-package-core
description: Usage examples for @simplysf/simply-package-core.
---

Package/package-version alias resolution, `sfdx-project.json` dependency management, and Dev Hub
version lookup logic. Full signatures and types are in the
[API reference](/api/simply-package-core/readme/).

```sh
npm install @simplysf/simply-package-core
```

Every example below assumes you already have an authenticated `@salesforce/core` `Connection`/
`SfProject` — see [Get Started](/getting-started/).

## Finding where a package is declared

```ts
import { findPackageVersions, splitPackageAlias } from '@simplysf/simply-package-core';

const project = await sfProject.retrieveSfProjectJson();
const matches = findPackageVersions(project.getContents(), 'MyPackage');
```

## Building a Dev Hub version-lookup service

```ts
import { buildVersionService } from '@simplysf/simply-package-core';

const versionService = await buildVersionService(connection, sfProject);
const alias = versionService.getVersionAlias('04t000000000001AAA');
```

## Reading and updating package dependencies

```ts
import { buildProjectService } from '@simplysf/simply-package-core';

const projectService = await buildProjectService(sfProject);
const dependenciesByDirectory = projectService.getDependenciesByDirectory();
```

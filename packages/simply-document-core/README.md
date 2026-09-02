# @simplysf/simply-document-core

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-document-core?label=@simplysf/simply-document-core)](https://npmjs.com/@simplysf/simply-document-core) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-document-core.svg)](https://npmjs.com/@simplysf/simply-document-core) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

Confluence-storage-format change report and technical design document rendering. This is not a Salesforce CLI plugin — it's the library layer behind [`@simplysf/simply-document`](https://github.com/SimplySF/simply-plugins/tree/main/packages/simply-document)'s `sf simply document diff`/`generate` commands, published separately so it can be imported directly by anything that wants the same rendering (an editor extension, a CI job, a script) without pulling in the CLI framework.

Unlike the other internal libraries in this monorepo (`@simplysf/simply-core`, `@simplysf/simply-plugin-kit`, `@simplysf/simply-report`), this package is meant to be depended on by projects outside this repo, not only by other `simply-*` packages.

## Install

```bash
npm install @simplysf/simply-document-core
```

Requires Node.js `>=22` and either `"type": "module"` or a dynamic `import()` — this package ships ESM only.

## API

Everything below is exported from the package root. Removing or renaming an export is a breaking change; see [`src/index.ts`](src/index.ts).

| Export                                                          | Description                                                                                                                                                                                                                                    |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildChangeReportHtml(changes, customTemplateSource?)`         | Pure function: renders a Confluence-storage-format change report grouping a set of changed components by component type, for pasting into a release/change-management page.                                                                    |
| `buildTechnicalDesignDocumentHtml(data, customTemplateSource?)` | Pure function: renders a full Confluence-storage-format technical design document from a Salesforce project's scanned metadata — objects/data model, security model, groups/queues/permissions, solution inventory, and custom code inventory. |
| `ChangeEntry`, `ChangesByComponentType`                         | Types for `buildChangeReportHtml`'s input.                                                                                                                                                                                                     |
| `TechnicalDesignDocumentData`                                   | The full data model `buildTechnicalDesignDocumentHtml` renders, plus its ~28 supporting item types (`ObjectItem`, `ApexClassItem`, `FlowItem`, ...) — see `src/index.ts` for the complete list.                                                |

Both functions accept an optional second `customTemplateSource` argument: a caller-supplied Handlebars template string, compiled against the same `Handlebars` instance as the built-in template (so it can use the same partials/helpers — `changeTable` for the change report, `loud` for the technical design document).

```ts
import { buildChangeReportHtml, type ChangesByComponentType } from '@simplysf/simply-document-core';

const changes: ChangesByComponentType = {
  apexClasses: [
    {
      componentName: 'AccountService',
      componentType: 'ApexClass',
      changeType: 'Added',
      changeDescription: 'New service class',
      path: 'force-app/main/default/classes/AccountService.cls',
    },
  ],
};

const html = buildChangeReportHtml(changes);
// paste the result into a Confluence page's storage-format editor
```

```ts
import { buildTechnicalDesignDocumentHtml, type TechnicalDesignDocumentData } from '@simplysf/simply-document-core';

const html = buildTechnicalDesignDocumentHtml(scannedProjectData);
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See [CONTRIBUTING.md](CONTRIBUTING.md) for what's specific to this package, and the repo's [root CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for repo structure, setup, commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.

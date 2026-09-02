# @simplysf/simply-schema-core

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-schema-core?label=@simplysf/simply-schema-core)](https://npmjs.com/@simplysf/simply-schema-core) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-schema-core.svg)](https://npmjs.com/@simplysf/simply-schema-core) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

sObject schema generation (CSV/Excel parsing, field/object normalization) and interactive schema-report rendering. This is not a Salesforce CLI plugin — it's the library layer behind [`@simplysf/simply-schema`](https://github.com/SimplySF/simply-plugins/tree/main/packages/simply-schema)'s generate/visualize commands, published separately so it can be imported directly by anything that wants the same logic (an editor extension, a CI job, a script) without pulling in the CLI framework.

## Install

```bash
npm install @simplysf/simply-schema-core
```

Requires Node.js `>=22` and either `"type": "module"` or a dynamic `import()` — this package ships ESM only.

## API

Everything below is exported from the package root. Removing or renaming an export is a breaking change; see [`src/index.ts`](src/index.ts).

| Export                              | Description                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `getObjectInfo(workbook)`           | Reads the `object` worksheet into a plain property map.                                       |
| `getFieldInfo(workbook)`            | Reads the `fields` worksheet into one row object per field.                                   |
| `getValuesInfo(valuesWorksheet)`    | Reads a picklist values worksheet into one entry per value.                                   |
| `toBoolean(value)`                  | Converts a CSV/Excel value to a boolean, preserving `undefined` for empty/missing input.      |
| `blankToUndefined(value)`           | Treats an empty string the same as `undefined`.                                               |
| `buildSchemaReportHtml(options)`    | Renders a self-contained, interactive HTML schema report (diagram + relationship data table). |
| `IMPLEMENTED_FIELD_TYPES`           | The Salesforce field types this package knows how to generate `CustomField` metadata for.     |
| `FIELD_TYPES_WITHOUT_REQUIRED_PROP` | Field types whose `CustomField` metadata never carries a `required` tag.                      |
| `XML_BUILDER_OPTIONS`               | Standardized XML builder options matching Salesforce CLI's own output formatting.             |

```ts
import { getObjectInfo, getFieldInfo, getValuesInfo } from '@simplysf/simply-schema-core';
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile('./schema.xlsx');
const objectInfo = getObjectInfo(workbook);
const fieldRows = getFieldInfo(workbook);
```

```ts
import { toBoolean, blankToUndefined } from '@simplysf/simply-schema-core';

const required = toBoolean(csvRow.Required);
const description = blankToUndefined(csvRow.Description);
```

```ts
import { buildSchemaReportHtml } from '@simplysf/simply-schema-core';

const html = buildSchemaReportHtml({ username: org.username, nodes, edges, relationships });
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See [CONTRIBUTING.md](CONTRIBUTING.md) for what's specific to this package, and the repo's [root CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for repo structure, setup, commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.

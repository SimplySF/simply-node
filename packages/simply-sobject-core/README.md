# @simplysf/simply-sobject-core

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-sobject-core?label=@simplysf/simply-sobject-core)](https://npmjs.com/@simplysf/simply-sobject-core) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-sobject-core.svg)](https://npmjs.com/@simplysf/simply-sobject-core) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

Field history object derivation/filtering and relationship-field discovery. This is not a Salesforce CLI plugin — it's the library layer behind [`@simplysf/simply-sobject`](https://github.com/SimplySF/simply-plugins/tree/main/packages/simply-sobject)'s field-history and backup commands, published separately so it can be imported directly by anything that wants the same logic (an editor extension, a CI job, a script) without pulling in the CLI framework.

## Install

```bash
npm install @simplysf/simply-sobject-core
```

Requires Node.js `>=22` and either `"type": "module"` or a dynamic `import()` — this package ships ESM only.

## API

Everything below is exported from the package root. Removing or renaming an export is a breaking change; see [`src/index.ts`](src/index.ts).

| Export                                                                                                       | Description                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `getHistoryObjectName(sobject)`                                                                              | Derives a field history object's API name for a tracked sobject (e.g. `Account` → `AccountHistory`).                          |
| `getParentIdField(sobject)`                                                                                  | Derives a field history object's lookup field back to its parent record.                                                      |
| `buildWhereClause(filter, parentFieldName, soqlFilterableFields)`                                            | Builds a SOQL WHERE clause from the SOQL-filterable subset of a filter tree.                                                  |
| `recordMatchesClientFilters(record, filter, parentFieldName, soqlFilterableFields)`                          | Evaluates the non-SOQL-filterable subset of a filter tree against a queried record.                                           |
| `discoverRelationshipFields(connection, fields)`                                                             | Discovers identifying-field relationship paths (e.g. `RecordType.Name`) for an SObject's describe result.                     |
| `buildFieldHistorySchemaReportHtml(options)`                                                                 | Pure function: renders a self-contained HTML report of field-history-tracked objects/fields.                                  |
| `FilterConditionSchema`, `FilterGroupSchema`, `FilterConfigSchema`                                           | zod schemas for parsing/validating a filter tree (the JSON shape `simply sobject history` commands' `--filter` flag accepts). |
| `FilterCondition`, `FilterGroup`, `FilterConfig`, `FieldHistorySchemaEntry`, `GroupedFieldHistorySchemaData` | Supporting types.                                                                                                             |

```ts
import { getHistoryObjectName, getParentIdField } from '@simplysf/simply-sobject-core';

getHistoryObjectName('Opportunity'); // 'OpportunityFieldHistory'
getParentIdField('My_Object__c'); // 'ParentId'
```

```ts
import { FilterConfigSchema, buildWhereClause, recordMatchesClientFilters } from '@simplysf/simply-sobject-core';

const filter = FilterConfigSchema.parse(JSON.parse(rawJson));
const whereClause = buildWhereClause(filter, 'AccountId', new Set(['AccountId', 'CreatedDate']));
// ...run the query, then for each returned record:
const included = recordMatchesClientFilters(record, filter, 'AccountId', new Set(['AccountId', 'CreatedDate']));
```

```ts
import { discoverRelationshipFields } from '@simplysf/simply-sobject-core';

const describeResult = await connection.describe('Account');
const relationshipPaths = await discoverRelationshipFields(connection, describeResult.fields);
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See [CONTRIBUTING.md](CONTRIBUTING.md) for what's specific to this package, and the repo's [root CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for repo structure, setup, commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.

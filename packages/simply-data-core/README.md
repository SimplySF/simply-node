# @simplysf/simply-data-core

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-data-core?label=@simplysf/simply-data-core)](https://npmjs.com/@simplysf/simply-data-core) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-data-core.svg)](https://npmjs.com/@simplysf/simply-data-core) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

Content Version upload/download and CSV row counting logic. This is not a Salesforce CLI plugin — it's the library layer behind [`@simplysf/simply-data`](https://github.com/SimplySF/simply-plugins/tree/main/packages/simply-data)'s file commands, published separately so it can be imported directly by anything that wants the same logic (an editor extension, a CI job, a script) without pulling in the CLI framework.

## Install

```bash
npm install @simplysf/simply-data-core
```

Requires Node.js `>=22` and either `"type": "module"` or a dynamic `import()` — this package ships ESM only.

## API

Everything below is exported from the package root. Removing or renaming an export is a breaking change; see [`src/index.ts`](src/index.ts).

| Export                                                                          | Description                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `uploadContentVersion(connection, filePath, title?, firstPublishLocationId?)`   | Uploads a local file as a new `ContentVersion`, re-queried to include `ContentDocumentId`. |
| `downloadContentVersion(connection, contentVersionDownload, downloadDirectory)` | Downloads a `ContentVersion`'s file data to a local directory.                             |
| `countCsvRows(filePath)`                                                        | Counts the data rows in a CSV, excluding its header.                                       |
| `requestsForQuery(recordCount)`                                                 | Estimates the API requests a record query costs, including its `queryMore` round trips.    |
| `REQUESTS_PER_UPLOAD`                                                           | API requests consumed per file uploaded (`2`).                                             |
| `REQUESTS_PER_DOWNLOAD`                                                         | API requests consumed per file downloaded (`1`).                                           |
| `QUERY_BATCH_SIZE`                                                              | Records jsforce returns per query round trip.                                              |
| `createBoundary()`                                                              | Generates a multipart boundary string.                                                     |
| `escapeHeaderFilename(filename)`                                                | Escapes a filename for inclusion in a `Content-Disposition` header.                        |
| `contentVersionMultipart(options)`                                              | Builds the `multipart/form-data` body for a `ContentVersion` create request.               |

```ts
import { uploadContentVersion, downloadContentVersion } from '@simplysf/simply-data-core';

const contentVersion = await uploadContentVersion(connection, './report.pdf');
const filePath = await downloadContentVersion(connection, contentVersionDownload, './downloads');
```

```ts
import { countCsvRows, requestsForQuery, REQUESTS_PER_UPLOAD } from '@simplysf/simply-data-core';

const rowCount = await countCsvRows('./records.csv');
const plannedRequests = requestsForQuery(rowCount) + rowCount * REQUESTS_PER_UPLOAD;
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See [CONTRIBUTING.md](CONTRIBUTING.md) for what's specific to this package, and the repo's [root CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for repo structure, setup, commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.

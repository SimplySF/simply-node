---
title: simply-data-core
description: Usage examples for @simplysf/simply-data-core.
---

Content Version upload/download and CSV row counting logic. Full signatures and types are in the
[API reference](/api/simply-data-core/readme/).

```sh
npm install @simplysf/simply-data-core
```

Every example below assumes you already have an authenticated `@salesforce/core` `Connection` — see
[Get Started](/getting-started/).

## Uploading and downloading files

```ts
import { uploadContentVersion, downloadContentVersion } from '@simplysf/simply-data-core';

const contentVersion = await uploadContentVersion(connection, './report.pdf');

const filePath = await downloadContentVersion(
  connection,
  { ...contentVersion, Error: undefined, FilePath: undefined },
  './downloads',
);
```

## Counting CSV rows before an upload run

```ts
import { countCsvRows, requestsForQuery, REQUESTS_PER_UPLOAD } from '@simplysf/simply-data-core';

const rowCount = await countCsvRows('./records.csv');
const plannedRequests = requestsForQuery(rowCount) + rowCount * REQUESTS_PER_UPLOAD;
```

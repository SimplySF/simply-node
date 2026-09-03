---
title: simply-data-core
description: Usage examples for @simplysf/simply-data-core.
---

Content Version upload/download, Content Note bulk upload, and CSV row counting logic. Full
signatures and types are in the [API reference](/api/simply-data-core/readme/).

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

## Bulk-creating Content Notes linked by external ID

```ts
import { queryRecords } from '@simplysf/simply-core';
import { uploadContentNotes, type ContentNoteInput } from '@simplysf/simply-data-core';

// Build the external-id -> record-id lookup notes will link against.
const lookup = new Map<string, string>();
for await (const record of queryRecords(connection, 'SELECT Id, Name FROM HRM_Request__c')) {
  lookup.set(record.Name, record.Id);
}

const inputs: ContentNoteInput[] = [
  { content: 'Called the customer back.', title: 'Follow-up', linkedRecordExternalId: 'HRM-00042' },
];

for await (const result of uploadContentNotes(connection, inputs, lookup, { concurrency: 10 })) {
  if (result.status === 'error') {
    console.error(`${result.stage}: ${result.message}`);
  }
}
```

## Counting CSV rows before an upload run

```ts
import { countCsvRows, requestsForQuery, REQUESTS_PER_UPLOAD } from '@simplysf/simply-data-core';

const rowCount = await countCsvRows('./records.csv');
const plannedRequests = requestsForQuery(rowCount) + rowCount * REQUESTS_PER_UPLOAD;
```

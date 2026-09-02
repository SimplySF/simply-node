---
title: simply-core
description: Usage examples for @simplysf/simply-core.
---

Querying, bulk export, CSV, and `sfdx-project.json` utilities — the everyday helpers that show up in
almost any Salesforce automation script. Full signatures and types are in the [API reference](/api/simply-core/readme/).

```sh
npm install @simplysf/simply-core
```

Every example below assumes you already have an authenticated `@salesforce/core` `Connection` — see
[Get Started](/getting-started/) for how to get one.

## Querying records

`queryRecords` returns an async iterable, so you can stream through large result sets without
holding everything in memory at once. It picks REST or Bulk API v2 for you based on `bulkThreshold`.

```ts
import { queryRecords } from '@simplysf/simply-core';

const records = queryRecords(connection, 'SELECT Id, Name FROM Account');

for await (const record of records) {
  console.log(record.Id, record.Name);
}
```

## Querying a caller-supplied list of values

`chunkedInQuery` splits a list of values across as many `WHERE Id IN (...)` queries as SOQL's length
limit requires, and hands back every record from every chunk:

```ts
import { chunkedInQuery } from '@simplysf/simply-core';

const accountIds = ['001...', '001...', '001...' /* ... hundreds more ... */];

const accounts = await chunkedInQuery(
  connection,
  accountIds,
  (inClause) => `SELECT Id, Name FROM Account WHERE Id IN (${inClause})`,
  { chunkSize: 200 },
);
```

## Writing records to CSV

```ts
import { createCsvFileWriter } from '@simplysf/simply-core';

const writer = createCsvFileWriter('./Accounts_Modified.csv', ['Id', 'Name']);

for await (const record of queryRecords(connection, 'SELECT Id, Name FROM Account')) {
  await writer.write({ Id: record.Id, Name: record.Name });
}

await writer.end();
```

## Splitting work into batches

```ts
import { chunk } from '@simplysf/simply-core';

const ids = ['001...' /* ... */];
for (const batch of chunk(ids, 200)) {
  // e.g. one Tooling API delete call per batch of 200
}
```

## Checking the daily API budget before a bulk operation

```ts
import { checkApiBudget, apiBudgetError } from '@simplysf/simply-core';

const result = await checkApiBudget(connection, /* plannedRequests */ 500, { maxUsagePercent: 80 });

if (result.status === 'exceeded') {
  throw apiBudgetError(result, 80);
}
```

## Reading `sfdx-project.json`

```ts
import { readSfdxProject, getDefaultPackageDirectory } from '@simplysf/simply-core';

const project = await readSfdxProject(projectDir);
const defaultDir = getDefaultPackageDirectory(project);
```

## Retrying a flaky call

```ts
import { retryWithBackoff } from '@simplysf/simply-core';

const result = await retryWithBackoff(() => connection.query('SELECT Id FROM Account LIMIT 1'), {
  retryAttempts: 3,
  backoffFactor: 2,
});
```

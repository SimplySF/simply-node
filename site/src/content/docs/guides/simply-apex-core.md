---
title: simply-apex-core
description: Usage examples for @simplysf/simply-apex-core.
---

Apex execute, log-purge, and trace-flag logic. Full signatures and types are in the
[API reference](/api/simply-apex-core/readme/).

```sh
npm install @simplysf/simply-apex-core
```

Every example below assumes you already have an authenticated `@salesforce/core` `Connection` — see
[Get Started](/getting-started/).

## Executing anonymous Apex

```ts
import { executeApex } from '@simplysf/simply-apex-core';

const result = await executeApex(connection, './scripts/apex/backfill.apex');

if (!result.success) {
  throw new Error(result.exceptionMessage || result.compileProblem);
}

console.log(result.logs);
```

## Purging debug logs

```ts
import { queryApexLogIdsViaRest, deleteApexLogsViaCollections } from '@simplysf/simply-apex-core';

const logIds = await queryApexLogIdsViaRest(connection, 'SELECT Id FROM ApexLog');

const results = await deleteApexLogsViaCollections(connection, logIds, (purged, total) => {
  console.log(`purged ${purged}/${total}`);
});
```

## Setting up a trace flag

```ts
import { setupApexTrace } from '@simplysf/simply-apex-core';

const trace = await setupApexTrace(connection, {
  logLevel: 'ReplayDebuggerLevels',
});
```

## Silencing noisy framework classes in debug logs

```ts
import { silenceApexClasses, FFLIB_CLASSES, AT4DX_CLASSES } from '@simplysf/simply-apex-core';

const outcome = await silenceApexClasses(connection, [...FFLIB_CLASSES, ...AT4DX_CLASSES]);
```

## Generating an Apex test suite from source

```ts
import { generateApexTestSuite } from '@simplysf/simply-apex-core';

const result = await generateApexTestSuite(['force-app'], 'force-app/main/default/testSuites', 'AllTests');
```

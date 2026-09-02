---
title: simply-sobject-core
description: Usage examples for @simplysf/simply-sobject-core.
---

Field history object derivation/filtering and relationship-field discovery. Full signatures and
types are in the [API reference](/api/simply-sobject-core/readme/).

```sh
npm install @simplysf/simply-sobject-core
```

Every example below assumes you already have an authenticated `@salesforce/core` `Connection` — see
[Get Started](/getting-started/).

## Deriving a field history object's name and parent lookup

```ts
import { getHistoryObjectName, getParentIdField } from '@simplysf/simply-sobject-core';

getHistoryObjectName('Opportunity'); // 'OpportunityFieldHistory'
getParentIdField('My_Object__c'); // 'ParentId'
```

## Filtering field history records

```ts
import { FilterConfigSchema, buildWhereClause, recordMatchesClientFilters } from '@simplysf/simply-sobject-core';

const filter = FilterConfigSchema.parse(JSON.parse(rawJson));
const whereClause = buildWhereClause(filter, 'AccountId', new Set(['AccountId', 'CreatedDate']));
// ...run the query, then for each returned record:
const included = recordMatchesClientFilters(record, filter, 'AccountId', new Set(['AccountId', 'CreatedDate']));
```

## Discovering relationship fields

```ts
import { discoverRelationshipFields } from '@simplysf/simply-sobject-core';

const describeResult = await connection.describe('Account');
const relationshipPaths = await discoverRelationshipFields(connection, describeResult.fields);
```

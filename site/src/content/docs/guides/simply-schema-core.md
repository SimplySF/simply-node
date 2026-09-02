---
title: simply-schema-core
description: Usage examples for @simplysf/simply-schema-core.
---

sObject schema generation (CSV/Excel parsing, field/object normalization) and interactive
schema-report rendering. Full signatures and types are in the
[API reference](/api/simply-schema-core/readme/).

```sh
npm install @simplysf/simply-schema-core
```

## Parsing an Excel schema workbook

```ts
import { getObjectInfo, getFieldInfo, getValuesInfo } from '@simplysf/simply-schema-core';
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile('./schema.xlsx');

const objectInfo = getObjectInfo(workbook);
const fieldRows = getFieldInfo(workbook);
```

## Normalizing CSV/Excel field values

```ts
import { toBoolean, blankToUndefined } from '@simplysf/simply-schema-core';

const required = toBoolean(csvRow.Required);
const description = blankToUndefined(csvRow.Description);
```

## Rendering an interactive schema report

```ts
import { buildSchemaReportHtml } from '@simplysf/simply-schema-core';

const html = buildSchemaReportHtml({ username: org.username, nodes, edges, relationships });
```

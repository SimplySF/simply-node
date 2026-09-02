---
title: simply-document-core
description: Usage examples for @simplysf/simply-document-core.
---

Confluence-storage-format change report and technical design document rendering. Full signatures and
types are in the [API reference](/api/simply-document-core/).

```sh
npm install @simplysf/simply-document-core
```

## Rendering a change report

`buildChangeReportHtml` takes changed components grouped by type and renders the same
Confluence-storage-format HTML table used by `simply document diff`:

```ts
import { buildChangeReportHtml, type ChangesByComponentType } from '@simplysf/simply-document-core';

const changes: ChangesByComponentType = {
  apexClasses: [
    {
      componentName: 'AccountService',
      componentType: 'ApexClass',
      changeType: 'Modified',
      changeDescription: 'Added bulk-safe validation',
      path: 'force-app/main/default/classes/AccountService.cls',
    },
  ],
};

const html = buildChangeReportHtml(changes);
```

## Rendering a technical design document

`buildTechnicalDesignDocumentHtml` takes every metadata-type bucket the template supports (Apex
classes/triggers, flows, objects, permission sets, and dozens more — see the
[API reference](/api/simply-document-core/) for the full `TechnicalDesignDocumentData` shape) and
renders one HTML document:

```ts
import { buildTechnicalDesignDocumentHtml, type TechnicalDesignDocumentData } from '@simplysf/simply-document-core';

const data: TechnicalDesignDocumentData = {
  apexClasses: [{ name: 'AccountService', status: 'Active', apiVersion: '62.0' }],
  apexTriggers: [],
  approvalProcesses: [],
  // ... every other bucket the type requires
};

const html = buildTechnicalDesignDocumentHtml(data);
```

Both functions also accept a custom Handlebars template source as a second argument, if you want to
override the built-in layout entirely:

```ts
const html = buildChangeReportHtml(changes, myCustomTemplateSource);
```

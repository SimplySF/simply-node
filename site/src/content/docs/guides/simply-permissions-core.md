---
title: simply-permissions-core
description: Usage examples for @simplysf/simply-permissions-core.
---

Permission set XML and permissions report rendering. Full signatures and types are in the
[API reference](/api/simply-permissions-core/readme/).

```sh
npm install @simplysf/simply-permissions-core
```

## Rendering a PermissionSet metadata document

```ts
import { buildPermissionSetXml, type PermissionSetTemplateData } from '@simplysf/simply-permissions-core';

const data: PermissionSetTemplateData = {
  label: 'My Permission Set',
  hasActivationRequired: false,
  objectPermissions: [
    {
      object: 'Account',
      allowCreate: true,
      allowDelete: false,
      allowEdit: true,
      allowRead: true,
      modifyAllRecords: false,
      viewAllRecords: true,
      viewAllFields: false,
    },
  ],
  fieldPermissions: [],
  tabSettings: [],
  recordTypeVisibilities: [],
  userPermissions: [],
};

const xml = buildPermissionSetXml(data);
// write xml to a `.permissionset-meta.xml` file
```

## Rendering a permissions report

```ts
import { buildPermissionsReportHtml } from '@simplysf/simply-permissions-core';

const html = buildPermissionsReportHtml({
  username: 'user@example.com',
  reportDate: new Date().toISOString(),
  groupedData: new Map([['', { permissionSets: [], permissionSetGroups: [] }]]),
});
// write html to a report file
```

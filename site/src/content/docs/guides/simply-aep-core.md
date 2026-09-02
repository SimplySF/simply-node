---
title: simply-aep-core
description: Usage examples for @simplysf/simply-aep-core.
---

Apex Enterprise Patterns ([fflib](https://github.com/apex-enterprise-patterns/fflib-apex-common),
[force-di](https://github.com/apex-enterprise-patterns/force-di),
[AT4DX](https://github.com/apex-enterprise-patterns/at4dx)) binding scan and resolution logic. Full
signatures and types are in the [API reference](/api/simply-aep-core/).

```sh
npm install @simplysf/simply-aep-core
```

Every example below assumes an authenticated `@salesforce/core`-style connection where relevant — see
[Get Started](/getting-started/).

## Scanning local `force-app` source for AT4DX bindings

`scanLocalBindings` reads `AT4DXBinding__mdt`/`AT4DXDomainProcessBinding__mdt`-style custom metadata
records out of one or more source directories, without deploying anything:

```ts
import { scanLocalBindings, resolveBindings, ALL_BINDING_TYPES } from '@simplysf/simply-aep-core';

const scan = scanLocalBindings(['force-app'], ALL_BINDING_TYPES);
const bindings = resolveBindings(scan.records);

for (const binding of bindings) {
  console.log(binding.bindingType, binding.key, '->', binding.to, binding.effective ? '(effective)' : '');
}
```

## Validating bindings for problems

`validateBindings` takes a scan result (or raw records + the diagnostics that came with them) and
returns every issue it finds — ambiguous/missing SObject references, sequence collisions, duplicate
`DeveloperName`s, and more:

```ts
import { scanLocalBindings, validateBindings, ALL_BINDING_TYPES } from '@simplysf/simply-aep-core';

const scan = scanLocalBindings(['force-app'], ALL_BINDING_TYPES);
const issues = validateBindings(scan);

if (issues.length > 0) {
  for (const issue of issues) {
    console.error(`[${issue.severity}] ${issue.rule}: ${issue.message}`);
  }
  process.exitCode = 1;
}
```

## Scanning an org instead of local source

Same shape, but reads the metadata that's actually deployed to an org:

```ts
import { scanOrgBindings, ALL_BINDING_TYPES } from '@simplysf/simply-aep-core';

const scan = await scanOrgBindings(connection, ALL_BINDING_TYPES);
```

## Building a binding's metadata XML

Useful for anything that wants to generate or update an `AT4DXBinding__mdt` record's `.md-meta.xml`
without shelling out to a CLI:

```ts
import { buildBindingXml } from '@simplysf/simply-aep-core';

const xml = buildBindingXml({
  bindingType: 'Service',
  key: 'MyServiceInterface',
  to: 'MyServiceImpl',
});
```

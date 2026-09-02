---
title: simply-community-core
description: Usage examples for @simplysf/simply-community-core.
---

Community publish/deploy/domain-verification logic and site-file discovery. Full signatures and
types are in the [API reference](/api/simply-community-core/readme/).

```sh
npm install @simplysf/simply-community-core
```

Every example below assumes you already have an authenticated `@salesforce/core` `Connection` — see
[Get Started](/getting-started/).

## Publishing a community

```ts
import { publishCommunity } from '@simplysf/simply-community-core';

const result = await publishCommunity({ connection, networkId: '0DM000000000001', wait: 10 });
```

## Finding and patching a site's metadata

```ts
import { resolveSearchRoots, resolveSiteFile, patchCustomSiteXml } from '@simplysf/simply-community-core';
import fs from 'node:fs/promises';

const roots = await resolveSearchRoots(undefined, process.cwd());
const siteFile = await resolveSiteFile('MySite', roots);

const currentXml = await fs.readFile(siteFile, 'utf-8');
const { xml, previousDomains } = patchCustomSiteXml(currentXml, { domain: 'my.example.com', primary: true });
```

## Verifying a custom domain

```ts
import { verifyDomain } from '@simplysf/simply-community-core';

const check = await verifyDomain(connection, 'my.example.com');
```

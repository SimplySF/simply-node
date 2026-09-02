---
title: Get Started
description: Requirements and installation for the Simply Node libraries.
---

## Requirements

- Node.js `^22.13.0`, `^24.0.0`, or `^26.0.0`
- Most functions take an authenticated `@salesforce/core` `Connection` — this library doesn't handle
  org auth for you (except `simply-core`'s `authenticateClientCredentials`, which builds one from a
  Connected App's client-credentials flow). If you already have an `sf`-authenticated org, resolve a
  `Connection` from it with `@salesforce/core`'s `AuthInfo`/`Org` APIs.

## Install

Each package is independent and published separately — install only what you need:

```sh
npm install @simplysf/simply-core
npm install @simplysf/simply-aep-core
npm install @simplysf/simply-apex-core
npm install @simplysf/simply-document-core
npm install @simplysf/simply-report
```

| Package                | What it's for                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `simply-core`          | Querying, bulk export, CSV, and `sfdx-project.json` utilities                       |
| `simply-aep-core`      | Apex Enterprise Patterns (fflib, force-di, AT4DX) binding scan and resolution logic |
| `simply-apex-core`     | Apex execute, log-purge, and trace-flag logic                                       |
| `simply-document-core` | Confluence-storage-format change report and technical design document rendering     |
| `simply-report`        | Shared HTML report scaffolding                                                      |

## Next steps

Each package has its own guide with real usage examples, and a full API reference generated from its
TypeScript source:

- [simply-core guide](/guides/simply-core/) · [API](/api/simply-core/readme/)
- [simply-aep-core guide](/guides/simply-aep-core/) · [API](/api/simply-aep-core/readme/)
- [simply-apex-core guide](/guides/simply-apex-core/) · [API](/api/simply-apex-core/readme/)
- [simply-document-core guide](/guides/simply-document-core/) · [API](/api/simply-document-core/readme/)
- [simply-report guide](/guides/simply-report/) · [API](/api/simply-report/readme/)

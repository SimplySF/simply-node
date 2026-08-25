# @simplysf/simply-aep-core

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-aep-core?label=@simplysf/simply-aep-core)](https://npmjs.com/@simplysf/simply-aep-core) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-aep-core.svg)](https://npmjs.com/@simplysf/simply-aep-core) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

Apex Enterprise Patterns ([fflib](https://github.com/apex-enterprise-patterns/fflib-apex-common), [force-di](https://github.com/apex-enterprise-patterns/force-di), [AT4DX](https://github.com/apex-enterprise-patterns/at4dx)) binding scan and resolution logic. This is not a Salesforce CLI plugin — it's the library layer behind [`@simplysf/simply-aep`](https://github.com/SimplySF/simply-node/tree/main/packages/simply-aep)'s `sf simply aep at4dx ...` commands, published separately so it can be imported directly by anything that wants the same data (an editor extension, a CI check, a script) without pulling in the CLI framework.

Unlike the other internal libraries in this monorepo (`@simplysf/simply-core`, `@simplysf/simply-plugin-kit`, `@simplysf/simply-report`), this package is meant to be depended on by projects outside this repo, not only by other `simply-*` packages.

## Install

```bash
npm install @simplysf/simply-aep-core
```

Requires Node.js `>=22` and either `"type": "module"` or a dynamic `import()` — this package ships ESM only.

## API

Everything below is exported from the package root. Removing or renaming an export is a breaking change; see [`src/index.ts`](src/index.ts).

### AT4DX Application Factory bindings

The four `ApplicationFactory_{Service,Selector,Domain,UnitOfWork}Binding__mdt` Custom Metadata Types — "which class implements interface/SObject X" — resolved down to which record wins per key. See [`simply-aep`'s design doc](https://github.com/SimplySF/simply-node/blob/main/docs/design/0007-at4dx-binding-list.md) for the resolution rules this ports from AT4DX's own `di_Module` subclasses.

| Export                                                                                                   | Description                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scanOrgBindings(connection, types)`                                                                     | Queries a live org (plain REST, no Tooling API) for the requested binding types.                                                                                                            |
| `scanLocalBindings(sourceDirs, types)`                                                                   | Scans local Salesforce DX source directories for the same data, parsing `CustomMetadata` component XML directly.                                                                            |
| `resolveBindings(records)`                                                                               | Pure function: applies AT4DX's per-type resolution rules (priority ordering, Domain ambiguity, UnitOfWork ordering).                                                                        |
| `bindingTypeForLocalObjectName(name)`                                                                    | Maps a local `CustomMetadata` component's object half back to a `BindingType`.                                                                                                              |
| `ALL_BINDING_TYPES`, `AT4DX_BINDING_OBJECTS`, `AT4DX_BINDING_LOCAL_OBJECT_NAMES`, `BINDING_TYPE_BY_FLAG` | Constants mapping `BindingType` to its Custom Metadata Type API name, local object name, and CLI flag spelling.                                                                             |
| `AepConnection`                                                                                          | The minimal connection shape `scanOrgBindings` needs (`autoFetchQuery`, `getUsername`) — accept this instead of a full `@salesforce/core` `Connection` if you're constructing one yourself. |
| `At4dxBindingRow`, `RawBindingRecord`, `At4dxBindingListResult`, `BindingType`, `BindingTypeFlag`        | Types for the row shapes above.                                                                                                                                                             |

```ts
import { scanOrgBindings, resolveBindings, ALL_BINDING_TYPES } from '@simplysf/simply-aep-core';

const { records, missingTypes } = await scanOrgBindings(connection, ALL_BINDING_TYPES);
const rows = resolveBindings(records);
// rows[n].effective tells you which record AT4DX actually resolves to for that binding key
```

### AT4DX domain-process (trigger routing) bindings

`DomainProcessBinding__mdt` — AT4DX's Trigger Action Framework metadata wiring an SObject's trigger events to ordered criteria/action Apex classes. See [`simply-aep`'s design doc](https://github.com/SimplySF/simply-node/blob/main/docs/design/0008-at4dx-domain-process-binding-list.md) for the resolution model.

| Export                                                                                                                                                       | Description                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `scanOrgDomainProcessBindings(connection)`                                                                                                                   | Queries a live org for `DomainProcessBinding__mdt` records.                                         |
| `scanLocalDomainProcessBindings(sourceDirs)`                                                                                                                 | Scans local DX source for the same data.                                                            |
| `resolveDomainProcessBindings(records)`                                                                                                                      | Pure function: orders bindings per SObject/process context by execution order.                      |
| `ALL_TRIGGER_OPERATIONS`, `DOMAIN_PROCESS_BINDING_OBJECT`, `DOMAIN_PROCESS_BINDING_LOCAL_OBJECT_NAME`                                                        | Constants for the Custom Metadata Type's API name, local object name, and trigger operation values. |
| `DomainProcessBindingRow`, `RawDomainProcessBindingRecord`, `At4dxDomainProcessBindingListResult`, `DomainProcessType`, `ProcessContext`, `TriggerOperation` | Types for the row shapes above.                                                                     |

```ts
import { scanLocalDomainProcessBindings, resolveDomainProcessBindings } from '@simplysf/simply-aep-core';

const records = scanLocalDomainProcessBindings(['force-app/main/default']);
const rows = resolveDomainProcessBindings(records);
// rows filtered/sorted by sobject give you Account's Before_Insert handler order, for example
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See [CONTRIBUTING.md](CONTRIBUTING.md) for what's specific to this package, and the repo's [root CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for repo structure, setup, commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.

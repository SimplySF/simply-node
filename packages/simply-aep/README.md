# @simplysf/simply-aep

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-aep?label=@simplysf/simply-aep)](https://npmjs.com/@simplysf/simply-aep) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-aep.svg)](https://npmjs.com/@simplysf/simply-aep) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

Commands for [Apex Enterprise Patterns](https://github.com/apex-enterprise-patterns) tooling (fflib, force-di, AT4DX).

## Install

```bash
sf plugins install @simplysf/simply-aep
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See the repo's [CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for the repo structure, how to set up and build the project, our commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## Commands

<!-- commands -->

- [`sf simply aep at4dx binding list`](#sf-simply-aep-at4dx-binding-list)
- [`sf simply aep at4dx domain-process-binding list`](#sf-simply-aep-at4dx-domain-process-binding-list)

## `sf simply aep at4dx binding list`

List the AT4DX Application Factory bindings configured in an org or local source, resolved to show which record wins for each binding key.

```
USAGE
  $ sf simply aep at4dx binding list [--json] [--flags-dir <value>] [-o <value>] [--api-version <value>] [-d <value>...] [-t
    service|selector|domain|unit-of-work...] [--effective-only]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read bindings from. Use this for live-org discovery.
  -t, --type=<option>...       Binding type(s) to include: service, selector, domain, unit-of-work.
                               <options: service|selector|domain|unit-of-work>
      --api-version=<value>    Override the api version used for api requests made by this command
      --effective-only         Only show the bindings that actually win for their key; hide shadowed/non-winning
                               records.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  List the AT4DX Application Factory bindings configured in an org or local source, resolved to show which record wins
  for each binding key.

  Reads the four AT4DX Application Factory Custom Metadata Types — `ApplicationFactory_ServiceBinding__mdt`,
  `ApplicationFactory_SelectorBinding__mdt`, `ApplicationFactory_DomainBinding__mdt`, and
  `ApplicationFactory_UnitOfWorkBinding__mdt` — either from a live org or from local Salesforce DX source, and
  reproduces the resolution rules AT4DX applies at runtime so you can see which record actually wins for a given
  interface or SObject, and which ones are shadowed. Exactly one of `--target-org` or `--source-dir` must be specified.

  Service and Selector bindings resolve deterministically on `Priority__c` (highest wins). Domain bindings have no
  priority field, so a duplicated key is flagged `ambiguous` rather than reporting a guessed winner. UnitOfWork bindings
  have no winner concept at all — every record contributes to one ordered registration list.

EXAMPLES
  $ sf simply aep at4dx binding list --target-org myOrg

  $ sf simply aep at4dx binding list --source-dir sfdx-source/core --source-dir sfdx-source/app

  $ sf simply aep at4dx binding list --target-org myOrg --type service,selector

  $ sf simply aep at4dx binding list --target-org myOrg --effective-only --json

FLAG DESCRIPTIONS
  -t, --type=service|selector|domain|unit-of-work...

    Binding type(s) to include: service, selector, domain, unit-of-work.

    Comma-separated list of binding types to include. If not specified, all four are included.
```

_See code: [lib/commands/simply/aep/at4dx/binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.2.0/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/list.js)_

## `sf simply aep at4dx domain-process-binding list`

List the AT4DX Trigger Action Framework bindings configured in an org or local source, in execution order.

```
USAGE
  $ sf simply aep at4dx domain-process-binding list [--json] [--flags-dir <value>] [-o <value>] [--api-version <value>] [-d <value>...] [-s
    <value>...] [--active-only]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read bindings from. Use this for live-org discovery.
  -s, --sobject=<value>...     SObject API name(s) to filter to. If not specified, bindings for every SObject are
                               included.
      --active-only            Only show active bindings; hide inactive records.
      --api-version=<value>    Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  List the AT4DX Trigger Action Framework bindings configured in an org or local source, in execution order.

  Reads AT4DX's Trigger Action Framework Custom Metadata Type — `DomainProcessBinding__mdt` — either from a live org or
  from local Salesforce DX source, showing which criteria/action classes are bound to each SObject's trigger events (or
  domain method tokens), and the order they run in. Exactly one of `--target-org` or `--source-dir` must be specified.

  Unlike `simply aep at4dx binding list`, there's no "winner" here — every active record in a group (same SObject,
  process context, and trigger operation or domain method token) runs, in `OrderOfExecution__c` order. Two active
  records sharing the same order within a group are flagged as a collision, since AT4DX doesn't guarantee which one runs
  first in that case.

EXAMPLES
  $ sf simply aep at4dx domain-process-binding list --target-org myOrg

  $ sf simply aep at4dx domain-process-binding list --source-dir sfdx-source/core --source-dir sfdx-source/app

  $ sf simply aep at4dx domain-process-binding list --target-org myOrg --sobject Account

  $ sf simply aep at4dx domain-process-binding list --target-org myOrg --active-only --json
```

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.2.0/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/list.js)_
<!-- commandsstop -->

- [`sf simply aep at4dx binding list`](#sf-simply-aep-at4dx-binding-list)

## `sf simply aep at4dx binding list`

List the AT4DX Application Factory bindings configured in an org or local source, resolved to show which record wins for each binding key.

```
USAGE
  $ sf simply aep at4dx binding list [--json] [--flags-dir <value>] [-o <value>] [--api-version <value>] [-d <value>...] [-t
    service|selector|domain|unit-of-work...] [--effective-only]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read bindings from. Use this for live-org discovery.
  -t, --type=<option>...       Binding type(s) to include: service, selector, domain, unit-of-work.
                               <options: service|selector|domain|unit-of-work>
      --api-version=<value>    Override the api version used for api requests made by this command
      --effective-only         Only show the bindings that actually win for their key; hide shadowed/non-winning
                               records.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  List the AT4DX Application Factory bindings configured in an org or local source, resolved to show which record wins
  for each binding key.

  Reads the four AT4DX Application Factory Custom Metadata Types — `ApplicationFactory_ServiceBinding__mdt`,
  `ApplicationFactory_SelectorBinding__mdt`, `ApplicationFactory_DomainBinding__mdt`, and
  `ApplicationFactory_UnitOfWorkBinding__mdt` — either from a live org or from local Salesforce DX source, and
  reproduces the resolution rules AT4DX applies at runtime so you can see which record actually wins for a given
  interface or SObject, and which ones are shadowed. Exactly one of `--target-org` or `--source-dir` must be specified.

  Service and Selector bindings resolve deterministically on `Priority__c` (highest wins). Domain bindings have no
  priority field, so a duplicated key is flagged `ambiguous` rather than reporting a guessed winner. UnitOfWork bindings
  have no winner concept at all — every record contributes to one ordered registration list.

EXAMPLES
  $ sf simply aep at4dx binding list --target-org myOrg

  $ sf simply aep at4dx binding list --source-dir sfdx-source/core --source-dir sfdx-source/app

  $ sf simply aep at4dx binding list --target-org myOrg --type service,selector

  $ sf simply aep at4dx binding list --target-org myOrg --effective-only --json

FLAG DESCRIPTIONS
  -t, --type=service|selector|domain|unit-of-work...

    Binding type(s) to include: service, selector, domain, unit-of-work.

    Comma-separated list of binding types to include. If not specified, all four are included.
```

_See code: [lib/commands/simply/aep/at4dx/binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.1.0/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/list.js)_
<!-- commandsstop -->

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
- [`sf simply aep at4dx domain-process-binding create`](#sf-simply-aep-at4dx-domain-process-binding-create)
- [`sf simply aep at4dx domain-process-binding list`](#sf-simply-aep-at4dx-domain-process-binding-list)
- [`sf simply aep at4dx domain-process-binding set`](#sf-simply-aep-at4dx-domain-process-binding-set)
- [`sf simply aep at4dx domain-process-binding validate`](#sf-simply-aep-at4dx-domain-process-binding-validate)

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

_See code: [lib/commands/simply/aep/at4dx/binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.5.1/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/list.js)_

## `sf simply aep at4dx domain-process-binding create`

Create a new AT4DX Trigger Action Framework binding (DomainProcessBinding__mdt) in local source and/or a connected org.

```
USAGE
  $ sf simply aep at4dx domain-process-binding create -n <value> -s <value> --process-context TriggerExecution|DomainMethodExecution -t
    Action|Criteria -c <value> --order <value> [--json] [--flags-dir <value>] [-d <value>] [-o <value>] [--api-version
    <value>] [--wait <value>] [--label <value>] [--sobject-alternate] [--trigger-operation
    Before_Insert|After_Insert|Before_Update|After_Update|Before_Delete|After_Delete|After_Undelete]
    [--domain-method-token <value>] [--active] [--execute-asynchronous] [--logical-inverse] [--prevent-recursive]
    [--description <value>] [--force]

FLAGS
  -c, --class-to-inject=<value>      (required) The Apex class this binding wires in.
  -d, --source-dir=<value>           The package directory to create
                                     customMetadata/DomainProcessBinding.<name>.md-meta.xml under. Created if the
                                     customMetadata folder doesn't exist yet.
  -n, --developer-name=<value>       (required) The binding's DeveloperName. Must start with a letter, contain only
                                     letters, numbers, and single underscores, not end with an underscore, and be 40
                                     characters or fewer.
  -o, --target-org=<value>           Deploy the generated binding to this org after writing it.
  -s, --sobject=<value>              (required) The SObject API name to bind against.
  -t, --type=<option>                (required) Whether this binding contributes a Criteria filter or an Action.
                                     <options: Action|Criteria>
      --[no-]active                  IsActive__c.
      --api-version=<value>          Override the api version used for api requests made by this command
      --description=<value>          Description__c.
      --domain-method-token=<value>  The domain method's process token this binding matches. Required, and only allowed,
                                     when --process-context is DomainMethodExecution.
      --execute-asynchronous         ExecuteAsynchronous__c.
      --force                        Write (and deploy) even if validation finds an error-severity issue. Validation
                                     still runs and its issues are still printed and returned.
      --label=<value>                The binding's label. Defaults to --developer-name. Must be 40 characters or fewer.
      --logical-inverse              LogicalInverse__c.
      --order=<value>                (required) OrderOfExecution__c. Numeric; decimals are allowed.
      --prevent-recursive            PreventRecursive__c.
      --process-context=<option>     (required) What kind of process invokes this binding: TriggerExecution or
                                     DomainMethodExecution.
                                     <options: TriggerExecution|DomainMethodExecution>
      --[no-]sobject-alternate       Write --sobject to RelatedDomainBindingSObjectAlternate__c instead of
                                     RelatedDomainBindingSObject__c. Use this for a SObject that can't be referenced
                                     through an EntityDefinition field at all (for example ServiceResource and other
                                     Setup objects).
      --trigger-operation=<option>   The trigger event this binding fires on. Required, and only allowed, when
                                     --process-context is TriggerExecution.
                                     <options: Before_Insert|After_Insert|Before_Update|After_Update|Before_Delete|After
                                     _Delete|After_Undelete>
      --wait=<value>                 [default: 33] Deploy poll timeout, in minutes. Only meaningful with --target-org.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Create a new AT4DX Trigger Action Framework binding (DomainProcessBinding__mdt) in local source and/or a connected
  org.

  Generates a `DomainProcessBinding.<DeveloperName>.md-meta.xml` file from the given flags and writes it under
  --source-dir, deploys it to --target-org, or both. Validates the resulting binding — alongside everything else already
  in scope — with the same rules `simply aep at4dx domain-process-binding validate` uses, and refuses to write if that
  introduces an error-severity issue unless --force is passed. At least one of --source-dir/--target-org is required;
  unlike `list`/`validate`, both may be given at once (write to source and deploy it live in the same run). Given
  --target-org alone, the file is written to a temporary directory, deployed, and discarded — no working-tree footprint.

  Writes RelatedDomainBindingSObject__c by default. Pass --sobject-alternate to write
  RelatedDomainBindingSObjectAlternate__c instead, for a SObject (such as ServiceResource and other Setup objects) that
  can't be referenced through an EntityDefinition field at all.

EXAMPLES
  $ sf simply aep at4dx domain-process-binding create --source-dir sfdx-source/core --developer-name Account_Before_Insert_Assign_Owner --sobject Account --process-context TriggerExecution --trigger-operation Before_Insert --type Action --class-to-inject AccountAssignOwnerAction --order 10

  $ sf simply aep at4dx domain-process-binding create --target-org myOrg --developer-name Account_Before_Insert_Assign_Owner --sobject Account --process-context TriggerExecution --trigger-operation Before_Insert --type Action --class-to-inject AccountAssignOwnerAction --order 10

  $ sf simply aep at4dx domain-process-binding create --source-dir sfdx-source/core --target-org myOrg --developer-name Account_Before_Insert_Assign_Owner --sobject Account --process-context TriggerExecution --trigger-operation Before_Insert --type Action --class-to-inject AccountAssignOwnerAction --order 10

  $ sf simply aep at4dx domain-process-binding create --source-dir sfdx-source/core --developer-name ServiceResource_Before_Update_Sync --sobject ServiceResource --sobject-alternate --process-context TriggerExecution --trigger-operation Before_Update --type Action --class-to-inject ServiceResourceSyncAction --order 10
```

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/create.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.5.1/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/create.js)_

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

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.5.1/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/list.js)_

## `sf simply aep at4dx domain-process-binding set`

Update an existing AT4DX Trigger Action Framework binding (DomainProcessBinding__mdt) in local source and/or a connected org.

```
USAGE
  $ sf simply aep at4dx domain-process-binding set -n <value> [--json] [--flags-dir <value>] [-d <value>...] [-o <value>] [--api-version <value>]
    [--wait <value>] [--label <value>] [-s <value>] [--sobject-alternate] [--process-context
    TriggerExecution|DomainMethodExecution] [--trigger-operation
    Before_Insert|After_Insert|Before_Update|After_Update|Before_Delete|After_Delete|After_Undelete]
    [--domain-method-token <value>] [-t Action|Criteria] [-c <value>] [--order <value>] [--active]
    [--execute-asynchronous] [--logical-inverse] [--prevent-recursive] [--description <value>] [--force]

FLAGS
  -c, --class-to-inject=<value>      The Apex class this binding wires in. If not given, the existing value is kept.
  -d, --source-dir=<value>...        One or more paths to directories containing Salesforce DX source, searched for the
                                     binding to update.
  -n, --developer-name=<value>       (required) The DeveloperName of the binding to update.
  -o, --target-org=<value>           Locate (when --source-dir isn't given) and/or deploy the binding to this org.
  -s, --sobject=<value>              The SObject API name to bind against. If not given, the existing value is kept.
  -t, --type=<option>                Whether this binding contributes a Criteria filter or an Action. If not given, the
                                     existing value is kept.
                                     <options: Action|Criteria>
      --[no-]active                  IsActive__c. If not given, the existing value is kept.
      --api-version=<value>          Override the api version used for api requests made by this command
      --description=<value>          Description__c. If not given, the existing value is kept.
      --domain-method-token=<value>  The domain method's process token this binding matches. If you change
                                     --process-context to DomainMethodExecution, pass this too.
      --[no-]execute-asynchronous    ExecuteAsynchronous__c. If not given, the existing value is kept.
      --force                        Write (and deploy) even if validation finds an error-severity issue. Validation
                                     still runs and its issues are still printed and returned.
      --label=<value>                The binding's label. If not given, the existing label is kept.
      --[no-]logical-inverse         LogicalInverse__c. If not given, the existing value is kept.
      --order=<value>                OrderOfExecution__c. Numeric; decimals are allowed. If not given, the existing
                                     value is kept.
      --[no-]prevent-recursive       PreventRecursive__c. If not given, the existing value is kept.
      --process-context=<option>     What kind of process invokes this binding: TriggerExecution or
                                     DomainMethodExecution. If not given, the existing value is kept.
                                     <options: TriggerExecution|DomainMethodExecution>
      --[no-]sobject-alternate       Write --sobject to RelatedDomainBindingSObjectAlternate__c instead of
                                     RelatedDomainBindingSObject__c, for a SObject that can't be referenced through an
                                     EntityDefinition field at all (for example ServiceResource and other Setup
                                     objects). If not given, the binding keeps whichever field it already uses — this
                                     flag only needs to be passed to change it.
      --trigger-operation=<option>   The trigger event this binding fires on. If you change --process-context to
                                     TriggerExecution, pass this too.
                                     <options: Before_Insert|After_Insert|Before_Update|After_Update|Before_Delete|After
                                     _Delete|After_Undelete>
      --wait=<value>                 [default: 33] Deploy poll timeout, in minutes. Only meaningful with --target-org.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Update an existing AT4DX Trigger Action Framework binding (DomainProcessBinding__mdt) in local source and/or a
  connected org.

  Finds the binding named --developer-name in local source and/or a connected org, applies only the fields given as
  flags — everything else, including which SObject reference field the binding uses, is preserved from the found record
  — and rewrites the `DomainProcessBinding.<DeveloperName>.md-meta.xml` file. Validates the resulting binding —
  alongside everything else already in scope — with the same rules `simply aep at4dx domain-process-binding validate`
  uses, and refuses to write if that introduces an error-severity issue unless --force is passed.

  When --source-dir is given, the binding is located there (searched across every directory given, same as
  `list`/`validate`) and that exact file is rewritten; the found file is also deployed if --target-org is given. When
  only --target-org is given, the binding is located and updated directly in the org via a temporary file, deployed,
  then discarded — no working-tree footprint.

  --developer-name identifies the binding to update and can't itself be changed by this command.

EXAMPLES
  $ sf simply aep at4dx domain-process-binding set --source-dir sfdx-source/core --source-dir sfdx-source/app --developer-name Account_Before_Insert_Assign_Owner --order 20 --no-active

  $ sf simply aep at4dx domain-process-binding set --target-org myOrg --developer-name Account_Before_Insert_Assign_Owner --class-to-inject AccountAssignOwnerActionV2
```

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/set.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.5.1/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/set.js)_

## `sf simply aep at4dx domain-process-binding validate`

Validate the AT4DX Trigger Action Framework bindings configured in an org or local source, failing when a wiring problem is found.

```
USAGE
  $ sf simply aep at4dx domain-process-binding validate [--json] [--flags-dir <value>] [-o <value>] [--api-version <value>] [-d <value>...] [-s
    <value>...]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read bindings from. Use this for live-org discovery.
  -s, --sobject=<value>...     SObject API name(s) to filter to. Applies only to issues that name an SObject; issues
                               that span the whole scan (a duplicate DeveloperName, or a binding with no resolvable
                               SObject) are always reported, since filtering could hide the exact conflict they exist to
                               catch. If not specified, every issue is included.
      --api-version=<value>    Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Validate the AT4DX Trigger Action Framework bindings configured in an org or local source, failing when a wiring
  problem is found.

  Reads AT4DX's Trigger Action Framework Custom Metadata Type — `DomainProcessBinding__mdt` — either from a live org or
  from local Salesforce DX source, and checks it for problems `simply aep at4dx domain-process-binding list` doesn't
  fail on: two active records silently fighting over the same execution slot, a binding with no resolvable SObject, a
  binding whose declared process context doesn't match the field that's actually populated (so it never runs), the same
  DeveloperName defined more than once, and an ambiguous SObject reference. Exactly one of `--target-org` or
  `--source-dir` must be specified.

  Prints a table of every issue found. When --sobject is specified, scan-wide issues (a duplicate DeveloperName, or a
  binding with no resolvable SObject) print in their own section below the filtered table, since they can't be
  attributed to one SObject. Exits non-zero when any issue is an error (a warning alone doesn't fail the command) — use
  this in CI to gate on AT4DX wiring problems before they reach an org.

EXAMPLES
  $ sf simply aep at4dx domain-process-binding validate --target-org myOrg

  $ sf simply aep at4dx domain-process-binding validate --source-dir sfdx-source/core --source-dir sfdx-source/app

  $ sf simply aep at4dx domain-process-binding validate --target-org myOrg --sobject Account

  $ sf simply aep at4dx domain-process-binding validate --target-org myOrg --json
```

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/validate.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.5.1/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/validate.js)_
<!-- commandsstop -->

- [`sf simply aep at4dx binding list`](#sf-simply-aep-at4dx-binding-list)
- [`sf simply aep at4dx domain-process-binding list`](#sf-simply-aep-at4dx-domain-process-binding-list)
- [`sf simply aep at4dx domain-process-binding validate`](#sf-simply-aep-at4dx-domain-process-binding-validate)

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

_See code: [lib/commands/simply/aep/at4dx/binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.5.0/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/list.js)_

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

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.5.0/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/list.js)_

## `sf simply aep at4dx domain-process-binding validate`

Validate the AT4DX Trigger Action Framework bindings configured in an org or local source, failing when a wiring problem is found.

```
USAGE
  $ sf simply aep at4dx domain-process-binding validate [--json] [--flags-dir <value>] [-o <value>] [--api-version <value>] [-d <value>...] [-s
    <value>...]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read bindings from. Use this for live-org discovery.
  -s, --sobject=<value>...     SObject API name(s) to filter to. Applies only to issues that name an SObject; issues
                               that span the whole scan (a duplicate DeveloperName, or a binding with no resolvable
                               SObject) are always reported, since filtering could hide the exact conflict they exist to
                               catch. If not specified, every issue is included.
      --api-version=<value>    Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Validate the AT4DX Trigger Action Framework bindings configured in an org or local source, failing when a wiring
  problem is found.

  Reads AT4DX's Trigger Action Framework Custom Metadata Type — `DomainProcessBinding__mdt` — either from a live org or
  from local Salesforce DX source, and checks it for problems `simply aep at4dx domain-process-binding list` doesn't
  fail on: two active records silently fighting over the same execution slot, a binding with no resolvable SObject, a
  binding whose declared process context doesn't match the field that's actually populated (so it never runs), the same
  DeveloperName defined more than once, and an ambiguous SObject reference. Exactly one of `--target-org` or
  `--source-dir` must be specified.

  Prints a table of every issue found. When --sobject is specified, scan-wide issues (a duplicate DeveloperName, or a
  binding with no resolvable SObject) print in their own section below the filtered table, since they can't be
  attributed to one SObject. Exits non-zero when any issue is an error (a warning alone doesn't fail the command) — use
  this in CI to gate on AT4DX wiring problems before they reach an org.

EXAMPLES
  $ sf simply aep at4dx domain-process-binding validate --target-org myOrg

  $ sf simply aep at4dx domain-process-binding validate --source-dir sfdx-source/core --source-dir sfdx-source/app

  $ sf simply aep at4dx domain-process-binding validate --target-org myOrg --sobject Account

  $ sf simply aep at4dx domain-process-binding validate --target-org myOrg --json
```

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/validate.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.5.0/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/validate.js)_
<!-- commandsstop -->

- [`sf simply aep at4dx binding list`](#sf-simply-aep-at4dx-binding-list)
- [`sf simply aep at4dx domain-process-binding list`](#sf-simply-aep-at4dx-domain-process-binding-list)
- [`sf simply aep at4dx domain-process-binding validate`](#sf-simply-aep-at4dx-domain-process-binding-validate)

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

_See code: [lib/commands/simply/aep/at4dx/binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.4.1/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/list.js)_

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

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.4.1/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/list.js)_

## `sf simply aep at4dx domain-process-binding validate`

Validate the AT4DX Trigger Action Framework bindings configured in an org or local source, failing when a wiring problem is found.

```
USAGE
  $ sf simply aep at4dx domain-process-binding validate [--json] [--flags-dir <value>] [-o <value>] [--api-version <value>] [-d <value>...] [-s
    <value>...]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read bindings from. Use this for live-org discovery.
  -s, --sobject=<value>...     SObject API name(s) to filter to. If not specified, bindings for every SObject are
                               included.
      --api-version=<value>    Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Validate the AT4DX Trigger Action Framework bindings configured in an org or local source, failing when a wiring
  problem is found.

  Reads AT4DX's Trigger Action Framework Custom Metadata Type — `DomainProcessBinding__mdt` — either from a live org or
  from local Salesforce DX source, and checks it for problems `simply aep at4dx domain-process-binding list` doesn't
  fail on: two active records silently fighting over the same execution slot, a binding with no resolvable SObject, a
  binding whose declared process context doesn't match the field that's actually populated (so it never runs), the same
  DeveloperName defined more than once, and an ambiguous SObject reference. Exactly one of `--target-org` or
  `--source-dir` must be specified.

  Prints a table of every issue found. Exits non-zero when any issue is an error (a warning alone doesn't fail the
  command) — use this in CI to gate on AT4DX wiring problems before they reach an org.

EXAMPLES
  $ sf simply aep at4dx domain-process-binding validate --target-org myOrg

  $ sf simply aep at4dx domain-process-binding validate --source-dir sfdx-source/core --source-dir sfdx-source/app

  $ sf simply aep at4dx domain-process-binding validate --target-org myOrg --sobject Account

  $ sf simply aep at4dx domain-process-binding validate --target-org myOrg --json
```

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/validate.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.4.1/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/validate.js)_
<!-- commandsstop -->

- [`sf simply aep at4dx binding list`](#sf-simply-aep-at4dx-binding-list)
- [`sf simply aep at4dx domain-process-binding list`](#sf-simply-aep-at4dx-domain-process-binding-list)
- [`sf simply aep at4dx domain-process-binding validate`](#sf-simply-aep-at4dx-domain-process-binding-validate)

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

_See code: [lib/commands/simply/aep/at4dx/binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.4.0/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/list.js)_

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

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.4.0/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/list.js)_

## `sf simply aep at4dx domain-process-binding validate`

Validate the AT4DX Trigger Action Framework bindings configured in an org or local source, failing when a wiring problem is found.

```
USAGE
  $ sf simply aep at4dx domain-process-binding validate [--json] [--flags-dir <value>] [-o <value>] [--api-version <value>] [-d <value>...] [-s
    <value>...]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read bindings from. Use this for live-org discovery.
  -s, --sobject=<value>...     SObject API name(s) to filter to. If not specified, bindings for every SObject are
                               included.
      --api-version=<value>    Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Validate the AT4DX Trigger Action Framework bindings configured in an org or local source, failing when a wiring
  problem is found.

  Reads AT4DX's Trigger Action Framework Custom Metadata Type — `DomainProcessBinding__mdt` — either from a live org or
  from local Salesforce DX source, and checks it for problems `simply aep at4dx domain-process-binding list` doesn't
  fail on: two active records silently fighting over the same execution slot, a binding with no resolvable SObject, a
  binding whose declared process context doesn't match the field that's actually populated (so it never runs), the same
  DeveloperName defined more than once, and an ambiguous SObject reference. Exactly one of `--target-org` or
  `--source-dir` must be specified.

  Prints a table of every issue found. Exits non-zero when any issue is an error (a warning alone doesn't fail the
  command) — use this in CI to gate on AT4DX wiring problems before they reach an org.

EXAMPLES
  $ sf simply aep at4dx domain-process-binding validate --target-org myOrg

  $ sf simply aep at4dx domain-process-binding validate --source-dir sfdx-source/core --source-dir sfdx-source/app

  $ sf simply aep at4dx domain-process-binding validate --target-org myOrg --sobject Account

  $ sf simply aep at4dx domain-process-binding validate --target-org myOrg --json
```

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/validate.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.4.0/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/validate.js)_
<!-- commandsstop -->

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

_See code: [lib/commands/simply/aep/at4dx/binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.3.1/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/list.js)_

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

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.3.1/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/list.js)_
<!-- commandsstop -->

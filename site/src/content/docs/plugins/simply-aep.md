---
title: '@simplysf/simply-aep'
description: 'Commands for Apex Enterprise Patterns tooling (fflib, force-di, AT4DX)'
---

Commands for Apex Enterprise Patterns tooling (fflib, force-di, AT4DX)

```sh
sf plugins install @simplysf/simply-aep
```

## Commands

## `sf simply aep at4dx binding create`

Create a new AT4DX Application Factory binding (Service, Selector, Domain, or UnitOfWork) in local source and/or a connected org.

```
USAGE
  $ sf simply aep at4dx binding create -t service|selector|domain|unit-of-work -n <value> [--json] [--flags-dir <value>] [-d <value>]
    [-o <value>] [--api-version <value>] [--wait <value>] [--label <value>] [-c <value>] [--binding-interface <value>]
    [-s <value>] [--sobject-alternate] [--priority <value>] [--sequence <value>] [--force]

FLAGS
  -c, --to=<value>                 The interface/SObject's implementing Apex class (To__c). Required, and only allowed,
                                   when --type is service, selector, or domain — UnitOfWork has no To__c field.
  -d, --source-dir=<value>         The package directory to create the binding's .md-meta.xml under. Created if the
                                   customMetadata folder doesn't exist yet.
  -n, --developer-name=<value>     (required) The binding's DeveloperName. Must start with a letter, contain only
                                   letters, numbers, and single underscores, not end with an underscore, and be 40
                                   characters or fewer.
  -o, --target-org=<value>         Deploy the generated binding to this org after writing it.
  -s, --sobject=<value>            The SObject API name to bind against (BindingSObject__c, or
                                   BindingSObjectAlternate__c with --sobject-alternate). Required, and only allowed,
                                   when --type is selector, domain, or unit-of-work.
  -t, --type=<option>              (required) Which Application Factory binding type to create: service, selector,
                                   domain, or unit-of-work.
                                   <options: service|selector|domain|unit-of-work>
      --api-version=<value>        Override the api version used for api requests made by this command
      --binding-interface=<value>  BindingInterface__c — the Apex interface this binding maps to. Required, and only
                                   allowed, when --type is service.
      --force                      Write (and deploy) even if validation finds an error-severity issue. Validation still
                                   runs and its issues are still printed and returned.
      --label=<value>              The binding's label. Defaults to --developer-name. Must be 40 characters or fewer.
      --priority=<value>           Priority__c. Higher numbers are higher priority; omit for least priority. Only
                                   allowed when --type is service or selector — Domain and UnitOfWork have no
                                   Priority__c field.
      --sequence=<value>           BindingSequence__c — where this SObject falls in the Unit of Work's commit order
                                   (lower runs first). Only allowed when --type is unit-of-work.
      --[no-]sobject-alternate     Write --sobject to BindingSObjectAlternate__c instead of BindingSObject__c. Use this
                                   for a SObject that can't be referenced through an EntityDefinition field at all (for
                                   example ServiceResource and other Setup objects). Only allowed when --type is
                                   selector, domain, or unit-of-work.
      --wait=<value>               [default: 33] Deploy poll timeout, in minutes. Only meaningful with --target-org.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Create a new AT4DX Application Factory binding (Service, Selector, Domain, or UnitOfWork) in local source and/or a
  connected org.

  Generates a `<LocalObjectName>.<DeveloperName>.md-meta.xml` file from the given flags and writes it under
  --source-dir, deploys it to --target-org, or both. Validates the resulting binding — alongside everything else of the
  same --type already in scope — with the same rules `simply aep at4dx binding validate` uses, and refuses to write if
  that introduces an error-severity issue unless --force is passed. At least one of --source-dir/--target-org is
  required; both may be given at once (write to source and deploy it live in the same run). Given --target-org alone,
  the file is written to a temporary directory, deployed, and discarded — no working-tree footprint.

  `--type service` uses --binding-interface (BindingInterface__c) and rejects --sobject/--sobject-alternate; `--type
  selector`/`domain`/`unit-of-work` use --sobject and write it to BindingSObject__c by default (pass --sobject-alternate
  to write BindingSObjectAlternate__c instead, for a SObject — such as ServiceResource and other Setup objects — that
  can't be referenced through an EntityDefinition field at all). `--to` is required for `--type
  service`/`selector`/`domain` and rejected for `--type unit-of-work`, which has no To__c field at all. `--priority` is
  accepted for `--type service`/`selector` only; Domain and UnitOfWork have no such field. `--sequence`
  (BindingSequence__c) is accepted for `--type unit-of-work` only.

EXAMPLES
  $ sf simply aep at4dx binding create --source-dir sfdx-source/core --type service --developer-name My_Service_Binding --binding-interface IMyService --to MyServiceImpl

  $ sf simply aep at4dx binding create --target-org myOrg --type selector --developer-name Account_Selector --sobject Account --to AccountsSelector --priority 1

  $ sf simply aep at4dx binding create --source-dir sfdx-source/core --type domain --developer-name Account_Domain --sobject Account --to AccountDomain

  $ sf simply aep at4dx binding create --source-dir sfdx-source/core --type selector --developer-name ServiceResource_Selector --sobject ServiceResource --sobject-alternate --to ServiceResourceSelector

  $ sf simply aep at4dx binding create --source-dir sfdx-source/core --type unit-of-work --developer-name Account_UOW --sobject Account --sequence 10
```

_See code: [lib/commands/simply/aep/at4dx/binding/create.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/create.js)_

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

_See code: [lib/commands/simply/aep/at4dx/binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/list.js)_

## `sf simply aep at4dx binding update`

Update an existing AT4DX Application Factory binding (Service, Selector, Domain, or UnitOfWork) in local source and/or a connected org.

```
USAGE
  $ sf simply aep at4dx binding update -t service|selector|domain|unit-of-work -n <value> [--json] [--flags-dir <value>] [-d
    <value>...] [-o <value>] [--api-version <value>] [--wait <value>] [--label <value>] [-c <value>]
    [--binding-interface <value>] [-s <value>] [--sobject-alternate] [--priority <value>] [--sequence <value>] [--force]

FLAGS
  -c, --to=<value>                 The interface/SObject's implementing Apex class (To__c). Only allowed when --type is
                                   service, selector, or domain — UnitOfWork has no To__c field. If not given, the
                                   existing value is kept.
  -d, --source-dir=<value>...      One or more paths to directories containing Salesforce DX source, searched for the
                                   binding to update.
  -n, --developer-name=<value>     (required) The DeveloperName of the binding to update.
  -o, --target-org=<value>         Locate (when --source-dir isn't given) and/or deploy the binding to this org.
  -s, --sobject=<value>            The SObject API name to bind against. Only allowed when --type is selector, domain,
                                   or unit-of-work. If not given, the existing value is kept.
  -t, --type=<option>              (required) Which Application Factory binding type to look in: service, selector,
                                   domain, or unit-of-work.
                                   <options: service|selector|domain|unit-of-work>
      --api-version=<value>        Override the api version used for api requests made by this command
      --binding-interface=<value>  BindingInterface__c — the Apex interface this binding maps to. Only allowed when
                                   --type is service. If not given, the existing value is kept.
      --force                      Write (and deploy) even if validation finds an error-severity issue. Validation still
                                   runs and its issues are still printed and returned.
      --label=<value>              The binding's label. If not given, the existing label is kept.
      --priority=<value>           Priority__c. Only allowed when --type is service or selector — Domain and UnitOfWork
                                   have no Priority__c field. If not given, the existing value is kept.
      --sequence=<value>           BindingSequence__c — where this SObject falls in the Unit of Work's commit order
                                   (lower runs first). Only allowed when --type is unit-of-work. If not given, the
                                   existing value is kept.
      --[no-]sobject-alternate     Write --sobject to BindingSObjectAlternate__c instead of BindingSObject__c, for a
                                   SObject that can't be referenced through an EntityDefinition field at all (for
                                   example ServiceResource and other Setup objects). Only allowed when --type is
                                   selector, domain, or unit-of-work. If not given, the binding keeps whichever field it
                                   already uses — this flag only needs to be passed to change it.
      --wait=<value>               [default: 33] Deploy poll timeout, in minutes. Only meaningful with --target-org.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Update an existing AT4DX Application Factory binding (Service, Selector, Domain, or UnitOfWork) in local source and/or
  a connected org.

  Finds the binding named --developer-name (of the given --type) in local source and/or a connected org, applies only
  the fields given as flags — everything else, including which SObject reference field a Selector/Domain binding uses,
  is preserved from the found record — and rewrites its `.md-meta.xml` file. Validates the resulting binding — alongside
  everything else of the same --type already in scope — with the same rules `simply aep at4dx binding validate` uses,
  and refuses to write if that introduces an error-severity issue unless --force is passed.

  When --source-dir is given, the binding is located there (searched across every directory given, same as
  `list`/`validate`) and that exact file is rewritten; the found file is also deployed if --target-org is given. When
  only --target-org is given, the binding is located and updated directly in the org via a temporary file, deployed,
  then discarded — no working-tree footprint.

  --developer-name identifies the binding to update and can't itself be changed by this command. --type identifies which
  Application Factory Custom Metadata Type to look in and can't be changed either — bindings don't move between types.

EXAMPLES
  $ sf simply aep at4dx binding update --source-dir sfdx-source/core --source-dir sfdx-source/app --type selector --developer-name Account_Selector --priority 5

  $ sf simply aep at4dx binding update --target-org myOrg --type domain --developer-name Account_Domain --to AccountDomainV2

  $ sf simply aep at4dx binding update --target-org myOrg --type unit-of-work --developer-name Account_UOW --sequence 20
```

_See code: [lib/commands/simply/aep/at4dx/binding/update.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/update.js)_

## `sf simply aep at4dx binding validate`

Validate the AT4DX Application Factory bindings configured in an org or local source, failing when a wiring problem is found.

```
USAGE
  $ sf simply aep at4dx binding validate [--json] [--flags-dir <value>] [-o <value>] [--api-version <value>] [-d <value>...] [-t
    service|selector|domain|unit-of-work...]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read bindings from. Use this for live-org discovery.
  -t, --type=<option>...       Binding type(s) to include: service, selector, domain, unit-of-work.
                               <options: service|selector|domain|unit-of-work>
      --api-version=<value>    Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Validate the AT4DX Application Factory bindings configured in an org or local source, failing when a wiring problem is
  found.

  Reads `ApplicationFactory_ServiceBinding__mdt`, `ApplicationFactory_SelectorBinding__mdt`,
  `ApplicationFactory_DomainBinding__mdt`, and `ApplicationFactory_UnitOfWorkBinding__mdt` — either from a live org or
  from local Salesforce DX source — and checks them for problems `simply aep at4dx binding list` doesn't fail on: a
  binding with no resolvable key, a Selector/Domain/UnitOfWork binding whose SObject reference is ambiguous or names a
  standard object that can't actually go through an EntityDefinition metadata relationship, two Service/Selector/Domain
  records sharing a platform-unique `To__c`, two Domain (or two UnitOfWork) records resolving to the same SObject, two
  UnitOfWork records sharing a `BindingSequence__c`, and the same DeveloperName defined more than once within one
  binding type. Exactly one of `--target-org` or `--source-dir` must be specified.

  Prints a table of every issue found. Exits non-zero when any issue is an error (a warning alone doesn't fail the
  command) — use this in CI to gate on AT4DX Application Factory wiring problems before they reach an org.

EXAMPLES
  $ sf simply aep at4dx binding validate --target-org myOrg

  $ sf simply aep at4dx binding validate --source-dir sfdx-source/core --source-dir sfdx-source/app

  $ sf simply aep at4dx binding validate --target-org myOrg --type service,selector

  $ sf simply aep at4dx binding validate --target-org myOrg --json

FLAG DESCRIPTIONS
  -t, --type=service|selector|domain|unit-of-work...

    Binding type(s) to include: service, selector, domain, unit-of-work.

    Comma-separated list of binding types to include. If not specified, all four are included.
```

_See code: [lib/commands/simply/aep/at4dx/binding/validate.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/validate.js)_

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

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/create.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/create.js)_

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

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/list.js)_

## `sf simply aep at4dx domain-process-binding update`

Update an existing AT4DX Trigger Action Framework binding (DomainProcessBinding__mdt) in local source and/or a connected org.

```
USAGE
  $ sf simply aep at4dx domain-process-binding update -n <value> [--json] [--flags-dir <value>] [-d <value>...] [-o <value>] [--api-version <value>]
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
  $ sf simply aep at4dx domain-process-binding update --source-dir sfdx-source/core --source-dir sfdx-source/app --developer-name Account_Before_Insert_Assign_Owner --order 20 --no-active

  $ sf simply aep at4dx domain-process-binding update --target-org myOrg --developer-name Account_Before_Insert_Assign_Owner --class-to-inject AccountAssignOwnerActionV2
```

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/update.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/update.js)_

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
  DeveloperName defined more than once, an ambiguous SObject reference, RelatedDomainBindingSObject__c set to a standard
  object that can't actually go through an EntityDefinition relationship, and RelatedDomainBindingSObjectAlternate__c
  set to an object that didn't need the Alternate field. Exactly one of `--target-org` or `--source-dir` must be
  specified.

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

_See code: [lib/commands/simply/aep/at4dx/domain-process-binding/validate.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/validate.js)_

## `sf simply aep at4dx field-set-inclusion create`

Create a new AT4DX Selector field set inclusion (SelectorConfig_FieldSetInclusion__mdt) in local source and/or a connected org.

```
USAGE
  $ sf simply aep at4dx field-set-inclusion create -n <value> -s <value> -f <value> [--json] [--flags-dir <value>] [-d <value>] [-o <value>]
    [--api-version <value>] [--wait <value>] [--label <value>] [--sobject-alternate] [--active] [--force]

FLAGS
  -d, --source-dir=<value>      The package directory to create the field set inclusion's .md-meta.xml under. Created if
                                the customMetadata folder doesn't exist yet.
  -f, --fieldset-name=<value>   (required) FieldsetName__c — the field set to add to the selector's queried field list.
                                Unique org-wide across every SObject, not per-SObject.
  -n, --developer-name=<value>  (required) The record's DeveloperName. Must start with a letter, contain only letters,
                                numbers, and single underscores, not end with an underscore, and be 40 characters or
                                fewer.
  -o, --target-org=<value>      Deploy the generated field set inclusion to this org after writing it.
  -s, --sobject=<value>         (required) The SObject API name to bind the field set to (BindingSObject__c, or
                                BindingSObjectAlternate__c with --sobject-alternate).
      --[no-]active             IsActive__c. Defaults to true, matching the Custom Metadata Type's own default. Pass
                                --no-active to create it inactive.
      --api-version=<value>     Override the api version used for api requests made by this command
      --force                   Write (and deploy) even if validation finds an error-severity issue. Validation still
                                runs and its issues are still printed and returned.
      --label=<value>           The record's label. Defaults to --developer-name. Must be 40 characters or fewer.
      --[no-]sobject-alternate  Write --sobject to BindingSObjectAlternate__c instead of BindingSObject__c. Use this for
                                a SObject that can't be referenced through an EntityDefinition field at all (for example
                                ServiceResource and other Setup objects).
      --wait=<value>            [default: 33] Deploy poll timeout, in minutes. Only meaningful with --target-org.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Create a new AT4DX Selector field set inclusion (SelectorConfig_FieldSetInclusion__mdt) in local source and/or a
  connected org.

  Generates a `SelectorConfig_FieldSetInclusion.<DeveloperName>.md-meta.xml` file from the given flags and writes it
  under --source-dir, deploys it to --target-org, or both. Validates the resulting record — alongside everything else
  already in scope — with the same rules `simply aep at4dx field-set-inclusion validate` uses, and refuses to write if
  that introduces an error-severity issue unless --force is passed. At least one of --source-dir/--target-org is
  required; both may be given at once (write to source and deploy it live in the same run). Given --target-org alone,
  the file is written to a temporary directory, deployed, and discarded — no working-tree footprint.

  --sobject writes BindingSObject__c by default (pass --sobject-alternate to write BindingSObjectAlternate__c instead,
  for a SObject — such as ServiceResource and other Setup objects — that can't be referenced through an EntityDefinition
  field at all).

EXAMPLES
  $ sf simply aep at4dx field-set-inclusion create --source-dir sfdx-source/core --developer-name Account_Contact_Fields --sobject Account --fieldset-name ContactRelatedFields

  $ sf simply aep at4dx field-set-inclusion create --target-org myOrg --developer-name ServiceResource_Skills --sobject ServiceResource --sobject-alternate --fieldset-name SkillFields
```

_See code: [lib/commands/simply/aep/at4dx/field-set-inclusion/create.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/field-set-inclusion/create.js)_

## `sf simply aep at4dx field-set-inclusion list`

List the AT4DX Selector field set inclusions configured in an org or local source.

```
USAGE
  $ sf simply aep at4dx field-set-inclusion list [--json] [--flags-dir <value>] [-o <value>] [--api-version <value>] [-d
  <value>...]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read field set inclusions from. Use this for live-org
                               discovery.
      --api-version=<value>    Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  List the AT4DX Selector field set inclusions configured in an org or local source.

  Reads `SelectorConfig_FieldSetInclusion__mdt` — either from a live org or from local Salesforce DX source — and lists
  every record found. Unlike `simply aep at4dx binding list`, there's no priority/winner concept: every `IsActive__c:
  true` record for a selector's SObject contributes its field set simultaneously, so this is a flat table, not a
  resolved one. Exactly one of `--target-org` or `--source-dir` must be specified.

EXAMPLES
  $ sf simply aep at4dx field-set-inclusion list --target-org myOrg

  $ sf simply aep at4dx field-set-inclusion list --source-dir sfdx-source/core --source-dir sfdx-source/app

  $ sf simply aep at4dx field-set-inclusion list --target-org myOrg --json
```

_See code: [lib/commands/simply/aep/at4dx/field-set-inclusion/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/field-set-inclusion/list.js)_

## `sf simply aep at4dx field-set-inclusion update`

Update an existing AT4DX Selector field set inclusion (SelectorConfig_FieldSetInclusion__mdt) in local source and/or a connected org.

```
USAGE
  $ sf simply aep at4dx field-set-inclusion update -n <value> [--json] [--flags-dir <value>] [-d <value>...] [-o <value>] [--api-version <value>]
    [--wait <value>] [--label <value>] [-s <value>] [--sobject-alternate] [-f <value>] [--active] [--force]

FLAGS
  -d, --source-dir=<value>...   One or more paths to directories containing Salesforce DX source, searched for the
                                record to update.
  -f, --fieldset-name=<value>   FieldsetName__c — the field set to add to the selector's queried field list. Changing it
                                changes which field set is included. If not given, the existing value is kept.
  -n, --developer-name=<value>  (required) The DeveloperName of the record to update.
  -o, --target-org=<value>      Locate (when --source-dir isn't given) and/or deploy the record to this org.
  -s, --sobject=<value>         The SObject API name to bind the field set to. If not given, the existing value is kept.
      --[no-]active             IsActive__c. If not given, the existing value is kept. Pass --no-active to deactivate.
      --api-version=<value>     Override the api version used for api requests made by this command
      --force                   Write (and deploy) even if validation finds an error-severity issue. Validation still
                                runs and its issues are still printed and returned.
      --label=<value>           The record's label. If not given, the existing label is kept.
      --[no-]sobject-alternate  Write --sobject to BindingSObjectAlternate__c instead of BindingSObject__c, for a
                                SObject that can't be referenced through an EntityDefinition field at all (for example
                                ServiceResource and other Setup objects). If not given, the record keeps whichever field
                                it already uses — this flag only needs to be passed to change it.
      --wait=<value>            [default: 33] Deploy poll timeout, in minutes. Only meaningful with --target-org.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Update an existing AT4DX Selector field set inclusion (SelectorConfig_FieldSetInclusion__mdt) in local source and/or a
  connected org.

  Finds the field set inclusion named --developer-name in local source and/or a connected org, applies only the fields
  given as flags — everything else, including which SObject reference field it uses, is preserved from the found record
  — and rewrites its `.md-meta.xml` file. Validates the resulting record — alongside everything else already in scope —
  with the same rules `simply aep at4dx field-set-inclusion validate` uses, and refuses to write if that introduces an
  error-severity issue unless --force is passed.

  When --source-dir is given, the record is located there (searched across every directory given, same as
  `list`/`validate`) and that exact file is rewritten; the found file is also deployed if --target-org is given. When
  only --target-org is given, the record is located and updated directly in the org via a temporary file, deployed, then
  discarded — no working-tree footprint.

  --developer-name identifies the record to update and can't itself be changed by this command.

EXAMPLES
  $ sf simply aep at4dx field-set-inclusion update --source-dir sfdx-source/core --source-dir sfdx-source/app --developer-name Account_Contact_Fields --no-active

  $ sf simply aep at4dx field-set-inclusion update --target-org myOrg --developer-name Account_Contact_Fields --fieldset-name ContactRelatedFieldsV2
```

_See code: [lib/commands/simply/aep/at4dx/field-set-inclusion/update.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/field-set-inclusion/update.js)_

## `sf simply aep at4dx field-set-inclusion validate`

Validate the AT4DX Selector field set inclusions configured in an org or local source, failing when a wiring problem is found.

```
USAGE
  $ sf simply aep at4dx field-set-inclusion validate [--json] [--flags-dir <value>] [-o <value>] [--api-version <value>]
  [-d <value>...]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read field set inclusions from. Use this for live-org
                               discovery.
      --api-version=<value>    Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Validate the AT4DX Selector field set inclusions configured in an org or local source, failing when a wiring problem
  is found.

  Reads `SelectorConfig_FieldSetInclusion__mdt` — either from a live org or from local Salesforce DX source — and checks
  them for problems `simply aep at4dx field-set-inclusion list` doesn't fail on: a record with no resolvable SObject, an
  ambiguous SObject reference, a SObject reference naming a standard object that can't actually go through an
  EntityDefinition metadata relationship, two records sharing a FieldsetName__c value (unique org-wide, not
  per-SObject), and the same DeveloperName defined more than once. Exactly one of `--target-org` or `--source-dir` must
  be specified.

  Prints a table of every issue found. Exits non-zero when any issue is an error (a warning alone doesn't fail the
  command) — use this in CI to gate on AT4DX field set inclusion wiring problems before they reach an org.

EXAMPLES
  $ sf simply aep at4dx field-set-inclusion validate --target-org myOrg

  $ sf simply aep at4dx field-set-inclusion validate --source-dir sfdx-source/core --source-dir sfdx-source/app

  $ sf simply aep at4dx field-set-inclusion validate --target-org myOrg --json
```

_See code: [lib/commands/simply/aep/at4dx/field-set-inclusion/validate.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/field-set-inclusion/validate.js)_

## `sf simply aep at4dx platform-event-subscription list`

List the AT4DX Platform Event Distributor subscriptions configured in an org or local source.

```
USAGE
  $ sf simply aep at4dx platform-event-subscription list [--json] [--flags-dir <value>] [-o <value>] [--api-version
  <value>] [-d <value>...]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read platform event subscriptions from. Use this for
                               live-org discovery.
      --api-version=<value>    Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  List the AT4DX Platform Event Distributor subscriptions configured in an org or local source.

  Reads `PlatformEvents_Subscription__mdt` — either from a live org or from local Salesforce DX source — and lists every
  record found, grouped by event bus then category. Unlike `simply aep at4dx binding list`, there's no priority/winner
  concept: every `IsActive__c: true` subscription for a matching event is invoked by the distributor, so this is a flat
  table, not a resolved one. Exactly one of `--target-org` or `--source-dir` must be specified.

EXAMPLES
  $ sf simply aep at4dx platform-event-subscription list --target-org myOrg

  $ sf simply aep at4dx platform-event-subscription list --source-dir sfdx-source/core --source-dir sfdx-source/app

  $ sf simply aep at4dx platform-event-subscription list --target-org myOrg --json
```

_See code: [lib/commands/simply/aep/at4dx/platform-event-subscription/list.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/platform-event-subscription/list.js)_

## `sf simply aep at4dx platform-event-subscription simulate`

Simulate the AT4DX Platform Event Distributor's consumer resolution for a hypothetical event, and show which subscriptions would receive it and why the rest wouldn't.

```
USAGE
  $ sf simply aep at4dx platform-event-subscription simulate --event-bus <value> [--json] [--flags-dir <value>] [-o <value>] [--api-version <value>] [-d
    <value>...] [--category <value>] [--event-name <value>]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read platform event subscriptions from. Use this for
                               live-org discovery.
      --api-version=<value>    Override the api version used for api requests made by this command
      --category=<value>       The hypothetical event's Category__c value. Omit to simulate an event with no category.
      --event-bus=<value>      (required) The platform event object API name (EventBus__c) of the hypothetical event to
                               simulate, e.g. My_Event__e.
      --event-name=<value>     The hypothetical event's EventName__c value. Omit to simulate an event with no event
                               name.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Simulate the AT4DX Platform Event Distributor's consumer resolution for a hypothetical event, and show which
  subscriptions would receive it and why the rest wouldn't.

  Reads `PlatformEvents_Subscription__mdt` — either from a live org or from local Salesforce DX source — and
  reimplements `PlatformEventDistributor`'s decision sequence against a hypothetical event you describe with
  `--event-bus`, `--category`, and `--event-name`: restrict to subscriptions on that bus, drop inactive records the
  distributor's own query never loads, apply `triggerHandler`'s pre-filter, then each record's `MatcherRule__c` branch.
  Exactly one of `--target-org` or `--source-dir` must be specified.

  Prints the exact consumer set the distributor would build, in order, tagged synchronous or asynchronous from
  `Execute_Synchronous__c`, plus every subscription on that bus that would *not* receive the event and the structured
  reason why: `inactive`, `prefiltered` (the pre-filter rejected it before any matcher rule ran),
  `matcher-rule-missing-field` (the matcher rule dereferences a blank match field — a real NullPointerException in the
  org), or `no-match` (every field the matcher rule needs is present, but the values don't match this event).

  This is the same evaluation `simply aep at4dx platform-event-subscription validate` uses to derive
  `matcher-rule-missing-field` and `unreachable-subscription` — running it here against a concrete hypothetical event is
  how you confirm a subscription actually receives what you expect it to, beyond what `validate`'s static checks can
  tell you.

EXAMPLES
  $ sf simply aep at4dx platform-event-subscription simulate --target-org myOrg --event-bus Account_Change__e --category Finance --event-name AccountUpdated

  $ sf simply aep at4dx platform-event-subscription simulate --source-dir sfdx-source/core --event-bus Account_Change__e --event-name AccountUpdated

  $ sf simply aep at4dx platform-event-subscription simulate --target-org myOrg --event-bus Account_Change__e --json
```

_See code: [lib/commands/simply/aep/at4dx/platform-event-subscription/simulate.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/platform-event-subscription/simulate.js)_

## `sf simply aep at4dx platform-event-subscription validate`

Validate the AT4DX Platform Event Distributor subscriptions configured in an org or local source, failing when a wiring problem is found.

```
USAGE
  $ sf simply aep at4dx platform-event-subscription validate [--json] [--flags-dir <value>] [-o <value>] [--api-version
  <value>] [-d <value>...]

FLAGS
  -d, --source-dir=<value>...  One or more paths to directories containing Salesforce DX source. Use this for
                               local-source discovery.
  -o, --target-org=<value>     Username or alias of the org to read platform event subscriptions from. Use this for
                               live-org discovery.
      --api-version=<value>    Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Validate the AT4DX Platform Event Distributor subscriptions configured in an org or local source, failing when a
  wiring problem is found.

  Reads `PlatformEvents_Subscription__mdt` — either from a live org or from local Salesforce DX source — and checks them
  for problems `simply aep at4dx platform-event-subscription list` doesn't fail on: a blank or unrecognized
  EventBus__c/Consumer__c/MatcherRule__c, a matcher rule that dereferences a blank match field (a real
  NullPointerException risk at runtime), a MatchEventBus record the distributor's own pre-filter can never admit, an
  event bus missing fields the distributor reads (only checked for a bus this command can see the field list of), two
  records sharing a Consumer__c value (unique org-wide), and the same DeveloperName defined more than once. Exactly one
  of `--target-org` or `--source-dir` must be specified.

  Several of these problems fail silently at runtime in a real org — PlatformEventDistributor's consumer construction
  only logs to System.debug on failure, and one malformed record can take down every subscription's DI module. Catching
  them here, before deploy, is the whole point of this command.

  Prints a table of every issue found. Exits non-zero when any issue is an error (a warning alone doesn't fail the
  command) — use this in CI to gate on AT4DX platform event subscription wiring problems before they reach an org.

EXAMPLES
  $ sf simply aep at4dx platform-event-subscription validate --target-org myOrg

  $ sf simply aep at4dx platform-event-subscription validate --source-dir sfdx-source/core --source-dir sfdx-source/app

  $ sf simply aep at4dx platform-event-subscription validate --target-org myOrg --json
```

_See code: [lib/commands/simply/aep/at4dx/platform-event-subscription/validate.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/platform-event-subscription/validate.js)_

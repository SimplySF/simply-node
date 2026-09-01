---
title: '@simplysf/simply'
description: 'Salesforce CLI Plugins created by @SimplySF'
---

Salesforce CLI Plugins created by @SimplySF

```sh
sf plugins install @simplysf/simply
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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/create.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/list.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/update.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/binding/validate.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/create.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/list.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/update.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/domain-process-binding/validate.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/field-set-inclusion/create.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/field-set-inclusion/list.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/field-set-inclusion/update.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/field-set-inclusion/validate.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/platform-event-subscription/list.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/platform-event-subscription/simulate.js)_

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

_See code: [@simplysf/simply-aep](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-aep@0.11.3/packages/simply-aep/lib/commands/simply/aep/at4dx/platform-event-subscription/validate.js)_

## `sf simply apex execute`

Execute anonymous Apex code.

```
USAGE
  $ sf simply apex execute -o <value> -f <value> [--json] [--flags-dir <value>] [--api-version <value>]

FLAGS
  -f, --file=<value>         (required) Path to Apex file
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Execute anonymous Apex code.

  Executes an anonymous block of Apex code from a local .apex file against a target org and reports the compile and
  execution results, including any debug logs produced.

EXAMPLES
  $ sf simply apex execute --target-org myOrg --file scripts/apex/data-fix.apex

FLAG DESCRIPTIONS
  -f, --file=<value>  Path to Apex file

    The path to the local .apex file containing the anonymous Apex code to execute.
```

_See code: [@simplysf/simply-apex](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-apex@1.8.2/packages/simply-apex/lib/commands/simply/apex/execute.js)_

## `sf simply apex logs purge`

Purge Apex debug logs.

```
USAGE
  $ sf simply apex logs purge -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-w <value>] [-b] [--wait
    <value>]

FLAGS
  -b, --use-bulk-api         Use Bulk API v2 to query and delete the logs.
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -w, --where=<value>        SOQL WHERE clause
      --api-version=<value>  Override the api version used for api requests made by this command
      --wait=<value>         Number of minutes to wait for the Bulk API jobs to finish.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Purge Apex debug logs.

  Deletes ApexLog records from the target org. By default all logs are purged; use --where to scope the deletion to a
  subset of logs.

EXAMPLES
  $ sf simply apex logs purge --target-org myOrg

  $ sf simply apex logs purge --target-org myOrg --where "Status = 'Success'"

  $ sf simply apex logs purge --target-org myOrg --use-bulk-api

  $ sf simply apex logs purge --target-org myOrg --use-bulk-api --wait 60

FLAG DESCRIPTIONS
  -b, --use-bulk-api  Use Bulk API v2 to query and delete the logs.

    Runs the whole purge as two Bulk API v2 jobs instead of a Tooling API query followed by chunked REST deletes. Bulk
    API processes the deletion asynchronously and does not consume the org's REST API request limit, which suits purges
    of tens of thousands of logs. For small purges the default REST path is faster, since it avoids the overhead of
    creating, uploading, and polling a job.

  -w, --where=<value>  SOQL WHERE clause

    A WHERE clause used to filter which ApexLog records are purged (e.g. "Status = 'Success'").

  --wait=<value>  Number of minutes to wait for the Bulk API jobs to finish.

    Only applies with --use-bulk-api. The command polls the query and delete jobs until they complete or this timeout
    elapses, then throws.
```

_See code: [@simplysf/simply-apex](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-apex@1.8.2/packages/simply-apex/lib/commands/simply/apex/logs/purge.js)_

## `sf simply apex test-suite generate`

Generate an Apex test suite from source.

```
USAGE
  $ sf simply apex test-suite generate -d <value>... -n <value> --output-dir <value> [--json] [--flags-dir <value>]

FLAGS
  -d, --source-dir=<value>...  (required) Directories to scan for Apex classes
  -n, --name=<value>           (required) API name for the test suite
      --output-dir=<value>     (required) Output directory

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate an Apex test suite from source.

  Scans one or more source directories for Apex classes, keeps only the ones whose first meaningful line (skipping
  leading blank lines and comments) is an @IsTest annotation, and writes an ApexTestSuite metadata file listing them.
  Every run regenerates the file from scratch based on the current state of --source-dir; an existing file with the same
  name is always overwritten.

EXAMPLES
  $ sf simply apex test-suite generate --source-dir force-app/main/default/classes --name My_Suite --output-dir force-app/main/default/testSuites

  $ sf simply apex test-suite generate --source-dir force-app/main/default/classes --source-dir force-app/extra/classes --name All_Tests --output-dir force-app/main/default/testSuites

FLAG DESCRIPTIONS
  -d, --source-dir=<value>...  Directories to scan for Apex classes

    One or more directories to scan, recursively, for Apex classes. Only classes whose first meaningful line is an
    @IsTest annotation are included in the generated suite.

  -n, --name=<value>  API name for the test suite

    The API name for the generated test suite; also used to derive the output filename, <name>.testSuite-meta.xml.

  --output-dir=<value>  Output directory

    The directory to write the generated ApexTestSuite metadata file to. Not automatically suffixed with testSuites/ —
    pass that directory explicitly, e.g. force-app/main/default/testSuites.
```

_See code: [@simplysf/simply-apex](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-apex@1.8.2/packages/simply-apex/lib/commands/simply/apex/test-suite/generate.js)_

## `sf simply apex trace setup`

Configure a debug log trace flag for the current user, or another user.

```
USAGE
  $ sf simply apex trace setup -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [--on-behalf-of <value>]
    [--log-level <value>] [--start-date <value>] [--end-date <value>]

FLAGS
  -o, --target-org=<value>    (required) Username or alias of the target org. Not required if the `target-org`
                              configuration variable is already set.
      --api-version=<value>   Override the api version used for api requests made by this command
      --end-date=<value>      Expiration date/time of the trace flag, as an ISO 8601 date-time.
      --log-level=<value>     Developer name of an existing debug level to use for the trace flag.
      --on-behalf-of=<value>  Configure the trace flag for another user, identified by a "Field:Value" pair.
      --start-date=<value>    Start date/time of the trace flag, as an ISO 8601 date-time.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Configure a debug log trace flag for the current user, or another user.

  Creates or updates a DEVELOPER_LOG trace flag for the target user, using the FINEST/FINER "ReplayDebuggerLevels" debug
  level suitable for the Apex Replay Debugger and running for 24 hours starting now, by default. Use --on-behalf-of to
  configure the trace flag for a different user instead; --log-level, --start-date, and --end-date override the other
  defaults.

EXAMPLES
  $ sf simply apex trace setup --target-org myOrg

  $ sf simply apex trace setup --target-org myOrg --on-behalf-of Username:someuser@example.com

  $ sf simply apex trace setup --target-org myOrg --on-behalf-of FederationIdentifier:123456

  $ sf simply apex trace setup --target-org myOrg --log-level MyCustomDebugLevel --start-date 2026-08-18T09:00:00Z --end-date 2026-08-19T09:00:00Z

FLAG DESCRIPTIONS
  --end-date=<value>  Expiration date/time of the trace flag, as an ISO 8601 date-time.

    Defaults to 24 hours after the start date/time.

  --log-level=<value>  Developer name of an existing debug level to use for the trace flag.

    Must already exist in the org; it's looked up but never created or modified. Defaults to the "ReplayDebuggerLevels"
    debug level, which is created automatically if it doesn't exist.

  --on-behalf-of=<value>  Configure the trace flag for another user, identified by a "Field:Value" pair.

    Any unique User field can be used, for example "Username:someuser@example.com" or "FederationIdentifier:123456".

  --start-date=<value>  Start date/time of the trace flag, as an ISO 8601 date-time.

    Defaults to the current date/time.
```

_See code: [@simplysf/simply-apex](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-apex@1.8.2/packages/simply-apex/lib/commands/simply/apex/trace/setup.js)_

## `sf simply apex trace silence`

Silence debug logs for specific Apex classes.

```
USAGE
  $ sf simply apex trace silence -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-c <value> | --classes-file
    <value>] [--fflib] [--at4dx] [--force-di]

FLAGS
  -c, --classes=<value>       Comma-separated Apex class names
  -o, --target-org=<value>    (required) Username or alias of the target org. Not required if the `target-org`
                              configuration variable is already set.
      --api-version=<value>   Override the api version used for api requests made by this command
      --at4dx                 Silence at4dx base classes
      --classes-file=<value>  Path to a JSON file listing classes to silence
      --fflib                 Silence fflib base classes
      --force-di              Silence force-di base classes

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Silence debug logs for specific Apex classes.

  Creates or updates a 24-hour CLASS_TRACING trace flag with a fully suppressed (NONE) debug level for each specified
  Apex class, preventing those classes from generating debug log output. If a class already has a trace flag, its
  expiration is extended instead of creating a duplicate.

EXAMPLES
  $ sf simply apex trace silence --target-org myOrg --classes NoisyClass,ChattyTrigger

  $ sf simply apex trace silence --target-org myOrg --classes-file classesToSilence.json

  $ sf simply apex trace silence --target-org myOrg --fflib --at4dx --force-di

  $ sf simply apex trace silence --target-org myOrg --classes NoisyClass --fflib

FLAG DESCRIPTIONS
  -c, --classes=<value>  Comma-separated Apex class names

    A comma-separated list of Apex class names to silence.

  --at4dx  Silence at4dx base classes

    Adds ApplicationSObjectDomain to the classes to silence.

  --classes-file=<value>  Path to a JSON file listing classes to silence

    The path to a JSON file with the shape { "classes": ["ClassOne", "ClassTwo"] } listing the Apex class names to
    silence.

  --fflib  Silence fflib base classes

    Adds fflib_SObjectDescribe and fflib_SObjectDomain to the classes to silence.

  --force-di  Silence force-di base classes

    Adds di_Binding, di_Module, di_PlatformCache, and di_Injector to the classes to silence.
```

_See code: [@simplysf/simply-apex](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-apex@1.8.2/packages/simply-apex/lib/commands/simply/apex/trace/silence.js)_

## `sf simply community publish`

Publish a Salesforce Community (Experience Cloud site), waiting until the publish completes.

```
USAGE
  $ sf simply community publish -o <value> --name <value> [--json] [--flags-dir <value>] [--api-version <value>] [--wait
    <value>] [--retry-attempts <value>] [--retry-backoff <value>] [--ignore-errors]

FLAGS
  -o, --target-org=<value>      (required) Username or alias of the target org. Not required if the `target-org`
                                configuration variable is already set.
      --api-version=<value>     Override the api version used for api requests made by this command
      --ignore-errors           Log a warning and exit successfully if the publish fails, instead of throwing an error.
      --name=<value>            (required) Name of the community (Experience Cloud site) to publish.
      --retry-attempts=<value>  Number of additional attempts to make if the initial publish request fails, before
                                giving up. Defaults to 0 (no retries). Does not apply to polling for the publish job's
                                completion, which already retries until --wait elapses.
      --retry-backoff=<value>   [default: 2] Factor the delay between publish request retries grows by after each failed
                                attempt (e.g. 2 doubles the delay each time). Only relevant when --retry-attempts is
                                greater than 0.
      --wait=<value>            [default: 15] Minutes to wait for the publish to complete before giving up. Salesforce's
                                own publish jobs time out after 15 minutes server-side, so waiting longer than that has
                                no effect.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Publish a Salesforce Community (Experience Cloud site), waiting until the publish completes.

  Looks up the community by `--name`, triggers a publish via the Connect REST API, then polls until the publish job
  reaches a terminal state — throwing an error if it fails, rather than returning as soon as the publish request is
  accepted. The Salesforce CLI's own `sf community publish` command does not wait for completion; this command exists to
  fill that gap for pipelines that need to know publishing actually succeeded before continuing.

EXAMPLES
  $ sf simply community publish --target-org my-org --name "My Community"

  $ sf simply community publish --target-org my-org --name "My Community" --wait 20

  $ sf simply community publish --target-org my-org --name "My Community" --retry-attempts 3 --retry-backoff 2

  $ sf simply community publish --target-org my-org --name "My Community" --ignore-errors
```

_See code: [@simplysf/simply-community](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-community@0.6.5/packages/simply-community/lib/commands/simply/community/publish.js)_

## `sf simply community url set`

Set an Experience Cloud site's custom domain (and optionally its URL path prefix) by patching the site's metadata in place.

```
USAGE
  $ sf simply community url set -s <value> -d <value> [--json] [--flags-dir <value>] [-p <value>] [--primary] [--directory
    <value>] [--deploy] [--publish] [-o <value>] [--api-version <value>] [-w <value>] [--ignore-missing-domain]

FLAGS
  -d, --domain=<value>         (required) Fully qualified custom domain to set, e.g. `partners.acme.com`. Must already
                               be registered in the target org (Setup → Custom URLs); this command cannot register one.
  -o, --target-org=<value>     Username or alias of the target org.
  -p, --path-prefix=<value>    URL path prefix. When given, written to both the site file and the `Network` metadata
                               file that references the site.
  -s, --site=<value>           (required) CustomSite API name — the basename of `sites/<name>.site-meta.xml`.
  -w, --wait=<value>           [default: 33] Minutes to wait for the deploy to complete before giving up. Matches `sf
                               project deploy start`'s default of 33. Only relevant with --deploy.
      --api-version=<value>    Override the api version used for api requests made by this command
      --deploy                 Deploy the files this command changed, then restore their original contents so the
                               working tree ends up unmodified. Requires --target-org.
      --directory=<value>      Root directory to search for the site (and, if needed, network) metadata files. Defaults
                               to searching every package directory listed in sfdx-project.json. Also used as the
                               destination if the site file needs to be retrieved from --target-org, defaulting in that
                               case to the project's default package directory.
      --ignore-missing-domain  Downgrade "domain is not registered in this org" from an error to a warning, and proceed
                               anyway. Has no effect without --target-org, since there's no check to ignore.
      --[no-]primary           Whether the custom domain entry is the site's primary URL. Pass --no-primary to set it
                               false. Defaults to true.
      --publish                After a successful deploy, publish the site and wait for the publish to complete.
                               Requires --deploy.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Set an Experience Cloud site's custom domain (and optionally its URL path prefix) by patching the site's metadata in
  place.

  Patches `sites/<Site>.site-meta.xml` — replacing its `customWebAddresses` with a single entry for `--domain` — and,
  when `--path-prefix` is given, also patches `urlPathPrefix` on both that file and the `Network` metadata file that
  references the site. It does not touch anything else, and by default it does not deploy: this is a pre-deploy step
  meant to run right before whatever deploy command the pipeline already runs.

  Pass `--deploy` to also deploy just the files this command changed and restore their original contents afterwards, so
  the working tree is left exactly as it found it — the only lasting change is in the org. Add `--publish` to publish
  the site after a successful deploy.

  A domain must already be registered in the target org (Setup → Custom URLs) before a site can be pointed at it; this
  command cannot register one. When `--target-org` is given, it checks the domain is registered before writing anything,
  so a typo surfaces immediately instead of as an opaque deploy failure.

  If the site file isn't found locally and `--target-org` is given, it's retrieved from the org instead of erroring — a
  warning says so, since a `--site` typo now triggers a retrieve rather than a fast local error. This only applies to
  the site file; a missing `Network` metadata file (needed for `--path-prefix` or `--publish`) still errors even with
  `--target-org`.

EXAMPLES
  $ sf simply community url set --site Partner_Portal --domain partners.acme.com

  $ sf simply community url set --site Partner_Portal --domain partners.acme.com --path-prefix partners

  $ sf simply community url set --site Partner_Portal --domain partners.acme.com --target-org my-org --ignore-missing-domain

  $ sf simply community url set --site Partner_Portal --domain partners.acme.com --deploy --target-org my-org

  $ sf simply community url set --site Partner_Portal --domain partners.acme.com --path-prefix partners --deploy --publish --target-org my-org

  $ sf simply community url set --site Partner_Portal --domain partners.acme.com --deploy --target-org my-org # retrieves the site file first if it isn't found locally
```

_See code: [@simplysf/simply-community](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-community@0.6.5/packages/simply-community/lib/commands/simply/community/url/set.js)_

## `sf simply data file upload`

Upload a file to a Salesforce org.

```
USAGE
  $ sf simply data file upload -o <value> --file-path <value> [--json] [--flags-dir <value>] [--api-version <value>]
    [--max-api-usage <value>] [--first-publish-location-id <value>] [--title <value>]

FLAGS
  -o, --target-org=<value>                 (required) Username or alias of the target org. Not required if the
                                           `target-org` configuration variable is already set.
      --api-version=<value>                Override the api version used for api requests made by this command
      --file-path=<value>                  (required) Path to the file to upload. May be relative or absolute; only the
                                           file's name is sent to the org.
      --first-publish-location-id=<value>  Specify a record Id that the file should be linked to.
      --max-api-usage=<value>              [default: 20] Maximum percentage of the org's remaining API requests this run
                                           may consume.
      --title=<value>                      Specify the title for the file being uploaded.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Upload a file to a Salesforce org.

  Uploads a file to a Salesforce org.

  Only the file's name is sent to the org — Salesforce stores it as the ContentVersion's PathOnClient and derives
  FileExtension and FileType from it — so the local directory the file came from is never uploaded.

EXAMPLES
  $ sf simply data file upload --file-path fileToUpload.txt --target-org myTargetOrg

  $ sf simply data file upload --file-path fileToUpload.txt --first-publish-location-id 0019000000DmehK --target-org myTargetOrg

FLAG DESCRIPTIONS
  --max-api-usage=<value>  Maximum percentage of the org's remaining API requests this run may consume.

    Checked before any request is made, so a run that would exceed its budget stops without doing partial work. The
    percentage applies to the requests the org has left today, not to its daily maximum — an org that has already used
    most of its allocation gets a proportionally smaller budget.

    Note that uploading a file costs two API requests, not one: the upload itself, and a follow-up query for the
    resulting ContentDocumentId.

    A run that cannot finish within the org's remaining requests is refused regardless of this value. To allow a larger
    share, raise it; to allow the maximum, pass 100.

    If the org's remaining allocation can't be read — reading it falls back to the limits API, which needs the "View
    Setup and Configuration" permission — the command warns and proceeds rather than failing.
```

_See code: [@simplysf/simply-data](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-data@2.4.4/packages/simply-data/lib/commands/simply/data/file/upload.js)_

## `sf simply data files download`

Download files from a Salesforce org.

```
USAGE
  $ sf simply data files download -o <value> --where-content-version <value> [--json] [--flags-dir <value>] [--api-version
    <value>] [--max-api-usage <value>] [--max-parallel-jobs <value>]

FLAGS
  -o, --target-org=<value>             (required) Username or alias of the target org. Not required if the `target-org`
                                       configuration variable is already set.
      --api-version=<value>            Override the api version used for api requests made by this command
      --max-api-usage=<value>          [default: 20] Maximum percentage of the org's remaining API requests this run may
                                       consume.
      --max-parallel-jobs=<value>      [default: 1] Maximum number of parallel jobs.
      --where-content-version=<value>  (required) WHERE clause for ContentVersion query.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Download files from a Salesforce org.

  Downloads files specified by a where clause for a ContentVersion query from a Salesforce org. By default, the plugin
  uses the REST API for the download as to allow for the streaming of large files without issue. This means that each
  file will use one REST API request.

EXAMPLES
  $ sf simply data files download --where-content-version "IsLatest=true" --target-org myTargetOrg

  $ sf simply data files download --where-content-version "IsLatest=true" --max-parallel-jobs 5 --target-org myTargetOrg

FLAG DESCRIPTIONS
  --max-api-usage=<value>  Maximum percentage of the org's remaining API requests this run may consume.

    Checked before any request is made, so a run that would exceed its budget stops without doing partial work. The
    percentage applies to the requests the org has left today, not to its daily maximum — an org that has already used
    most of its allocation gets a proportionally smaller budget.

    Note that uploading a file costs two API requests, not one: the upload itself, and a follow-up query for the
    resulting ContentDocumentId.

    A run that cannot finish within the org's remaining requests is refused regardless of this value. To allow a larger
    share, raise it; to allow the maximum, pass 100.

    If the org's remaining allocation can't be read — reading it falls back to the limits API, which needs the "View
    Setup and Configuration" permission — the command warns and proceeds rather than failing.

  --max-parallel-jobs=<value>  Maximum number of parallel jobs.

    By default the plugin will only process a single file download at a time. You can increase this value to allow for
    quasi concurrent downloads. Please note that setting this value too high can cause performance issues.

  --where-content-version=<value>  WHERE clause for ContentVersion query.

    Provide a WHERE clause to allow the plugin to specify which ContentVersion records should be downloaded.
```

_See code: [@simplysf/simply-data](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-data@2.4.4/packages/simply-data/lib/commands/simply/data/files/download.js)_

## `sf simply data files upload`

Upload files to a Salesforce org.

```
USAGE
  $ sf simply data files upload -o <value> --file-path <value> [--json] [--flags-dir <value>] [--api-version <value>]
    [--max-api-usage <value>] [--max-parallel-jobs <value>]

FLAGS
  -o, --target-org=<value>         (required) Username or alias of the target org. Not required if the `target-org`
                                   configuration variable is already set.
      --api-version=<value>        Override the api version used for api requests made by this command
      --file-path=<value>          (required) Path to the csv file that specifies the upload.
      --max-api-usage=<value>      [default: 20] Maximum percentage of the org's remaining API requests this run may
                                   consume.
      --max-parallel-jobs=<value>  [default: 1] Maximum number of parallel jobs.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Upload files to a Salesforce org.

  Uploads files specified by a csv to a Salesforce org. By default, the plugin uses the REST API for the upload as the
  Bulk API is limited in its payload size. This means that each file will use one REST API request.

EXAMPLES
  $ sf simply data files upload --file-path filesToUpload.csv --target-org myTargetOrg

  $ sf simply data files upload --file-path filesToUpload.csv --max-parallel-jobs 5 --target-org myTargetOrg

FLAG DESCRIPTIONS
  --file-path=<value>  Path to the csv file that specifies the upload.

    The csv file must specify the columns PathOnClient and Title. Optionally, a FirstPublishLocationId can be specified
    to have it linked directly to a Salesforce record after upload.

    PathOnClient is the local path each file is read from, and may be relative or absolute. Only the file's name is sent
    to the org — Salesforce stores it as the ContentVersion's PathOnClient and derives FileExtension and FileType from
    it — so the local directory the file came from is never uploaded.

  --max-api-usage=<value>  Maximum percentage of the org's remaining API requests this run may consume.

    Checked before any request is made, so a run that would exceed its budget stops without doing partial work. The
    percentage applies to the requests the org has left today, not to its daily maximum — an org that has already used
    most of its allocation gets a proportionally smaller budget.

    Note that uploading a file costs two API requests, not one: the upload itself, and a follow-up query for the
    resulting ContentDocumentId.

    A run that cannot finish within the org's remaining requests is refused regardless of this value. To allow a larger
    share, raise it; to allow the maximum, pass 100.

    If the org's remaining allocation can't be read — reading it falls back to the limits API, which needs the "View
    Setup and Configuration" permission — the command warns and proceeds rather than failing.

  --max-parallel-jobs=<value>  Maximum number of parallel jobs.

    By default the plugin will only process a single file upload at a time. You can increase this value to allow for
    quasi concurrent uploads. Please note that setting this value too high can cause performance issues.
```

_See code: [@simplysf/simply-data](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-data@2.4.4/packages/simply-data/lib/commands/simply/data/files/upload.js)_

## `sf simply document diff`

Generate a change report between two git refs.

```
USAGE
  $ sf simply document diff --from-tag <value> --to-tag <value> [--json] [--flags-dir <value>] [--output-file <value>]
    [--template-file <value>] [--output-format html]

FLAGS
  --from-tag=<value>        (required) The starting git ref for the diff report.
  --output-file=<value>     Path to write the generated report to.
  --output-format=<option>  [default: html] Output format to render the report in.
                            <options: html>
  --template-file=<value>   Path to a custom Handlebars template to render instead of the built-in one.
  --to-tag=<value>          (required) The ending git ref for the diff report.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate a change report between two git refs.

  Runs `git diff --name-status` between two git refs (tags, branches, or commits) in the current working directory,
  groups the changed files by Salesforce metadata component type, and renders a Confluence-storage-format change report
  suitable for pasting into a release or change-management page.

EXAMPLES
  $ sf simply document diff --from-tag v1.0.0 --to-tag v1.1.0

  $ sf simply document diff --from-tag v1.0.0 --to-tag v1.1.0 --output-file change-report.html

  $ sf simply document diff --from-tag v1.0.0 --to-tag v1.1.0 --template-file my-change-report.hbs

FLAG DESCRIPTIONS
  --output-file=<value>  Path to write the generated report to.

    When specified, the generated report is written to this path instead of being printed to the terminal.

  --output-format=html  Output format to render the report in.

    Currently only `html` is supported. Reserved for future formats (e.g. Markdown).

  --template-file=<value>  Path to a custom Handlebars template to render instead of the built-in one.

    When specified, this template is rendered with the same data the built-in report template receives, and can reuse
    the built-in `changeTable` partial. See this package's README "Custom Templates" section for the data shape and
    available partials.
```

_See code: [@simplysf/simply-document](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-document@0.4.1/packages/simply-document/lib/commands/simply/document/diff.js)_

## `sf simply document generate`

Generate a technical design document for a Salesforce project.

```
USAGE
  $ sf simply document generate -d <value> --output-file <value> [--json] [--flags-dir <value>] [--template-file <value>]
    [--output-format html]

FLAGS
  -d, --directory=<value>       (required) Salesforce project source directory to scan.
      --output-file=<value>     (required) Path to write the generated document to.
      --output-format=<option>  [default: html] Output format to render the document in.
                                <options: html>
      --template-file=<value>   Path to a custom Handlebars template to render instead of the built-in one.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate a technical design document for a Salesforce project.

  Scans a Salesforce DX project's source directory for metadata (objects, fields, Apex, Lightning components, flows,
  permissions, and more) and renders a Confluence-storage-format technical design document covering the data model,
  security model, groups/queues/permissions, solution inventory, and custom code inventory.

EXAMPLES
  $ sf simply document generate --directory force-app --output-file technical-design-document.html

  $ sf simply document generate --directory force-app --output-file technical-design-document.html --template-file my-tdd-template.hbs

FLAG DESCRIPTIONS
  --output-format=html  Output format to render the document in.

    Currently only `html` is supported. Reserved for future formats (e.g. Markdown).

  --template-file=<value>  Path to a custom Handlebars template to render instead of the built-in one.

    When specified, this template is rendered with the same scanned project data the built-in technical design document
    template receives, and can reuse the built-in `loud` helper. See this package's README "Custom Templates" section
    for the data shape.
```

_See code: [@simplysf/simply-document](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-document@0.4.1/packages/simply-document/lib/commands/simply/document/generate.js)_

## `sf simply flow delete`

Deactivate and delete every version of one or more Flows.

```
USAGE
  $ sf simply flow delete -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-x <value>] [-n <value>...]

FLAGS
  -n, --flow-name=<value>...  Flow DeveloperName(s) to delete
  -o, --target-org=<value>    (required) Username or alias of the target org. Not required if the `target-org`
                              configuration variable is already set.
  -x, --manifest=<value>      Path to a destructiveChanges.xml/package.xml-shaped file
      --api-version=<value>   Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Deactivate and delete every version of one or more Flows.

  Deactivates every active version of each named Flow (so it no longer counts as "active" against Salesforce's
  restriction on deleting a Flow that still has one), then hard-deletes every version of it via the Tooling API. This is
  the pre-step a destructive metadata deploy needs before it can remove a Flow.

  Flows can be named either via `--manifest`, pointing at a `destructiveChanges.xml`/`package.xml`-shaped file whose
  `Flow` type members are the flows to delete, or via one or more `--flow-name` flags for scripted or one-off use.
  Exactly one of the two must be given.

  A failure deactivating or deleting one flow doesn't stop the others from being attempted — every failure is collected
  and reported, and the command exits non-zero if any occurred.

EXAMPLES
  $ sf simply flow delete --manifest destructive/pre/destructiveChanges.xml --target-org myOrg

  $ sf simply flow delete --flow-name My_Flow --flow-name Another_Flow --target-org myOrg

  $ sf simply flow delete --manifest destructive/pre/destructiveChanges.xml --target-org myOrg --json
```

_See code: [@simplysf/simply-flow](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-flow@0.4.3/packages/simply-flow/lib/commands/simply/flow/delete.js)_

## `sf simply flow version prune`

Delete obsolete versions of Flows found in local source.

```
USAGE
  $ sf simply flow version prune -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-d <value>...] [-n
    <value>...] [--dry-run]

FLAGS
  -d, --source-dir=<value>...  Directories to scan for *.flow-meta.xml files
  -n, --flow-name=<value>...   Flow DeveloperName(s) to prune obsolete versions for
  -o, --target-org=<value>     (required) Username or alias of the target org. Not required if the `target-org`
                               configuration variable is already set.
      --api-version=<value>    Override the api version used for api requests made by this command
      --dry-run                List obsolete versions without deleting them

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Delete obsolete versions of Flows found in local source.

  Flows can be named either via one or more `--source-dir` directories, scanned for `*.flow-meta.xml` files, or via one
  or more `--flow-name` flags for scripted or one-off use. Exactly one of the two must be given. The command then
  deletes any Tooling API Flow version already `Status = 'Obsolete'` for those flows — keeping an org's Flow version
  history from accumulating indefinitely. Unlike `simply flow delete`, this never touches an active Flow; it only
  removes versions the org itself already marked obsolete.

  Use `--dry-run` to see what would be deleted without deleting anything.

EXAMPLES
  $ sf simply flow version prune --target-org myOrg --source-dir sfdx-source/core

  $ sf simply flow version prune --target-org myOrg --source-dir sfdx-source/core --dry-run

  $ sf simply flow version prune --target-org myOrg --flow-name My_Flow --flow-name Another_Flow
```

_See code: [@simplysf/simply-flow](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-flow@0.4.3/packages/simply-flow/lib/commands/simply/flow/version/prune.js)_

## `sf simply package dependencies install`

Install package dependencies for a Salesforce project.

```
USAGE
  $ sf simply package dependencies install -o <value> [--json] [--flags-dir <value>] [-a all|package] [--api-version <value>] [-z
    <value>] [-i All|Delta|Upgrade] [-k <value>...] [-r] [--output-file <value>] [--package-retry-attempts <value>...]
    [-b <value>] [--retry-attempts <value>] [--retry-backoff <value>] [-s AllUsers|AdminsOnly] [-v <value>] [-t
    DeprecateOnly|Mixed|Delete] [-w <value>]

FLAGS
  -a, --apex-compile=<option>              Compile all Apex in the org and package, or only Apex in the package;
                                           unlocked packages only.
                                           <options: all|package>
  -b, --publish-wait=<value>               Maximum number of minutes to wait for the Subscriber Package Version ID to
                                           become available in the target org before canceling the install request.
  -i, --install-type=<option>              [default: Upgrade] Install all packages, only deltas, or only newer versions.
                                           <options: All|Delta|Upgrade>
  -k, --installation-key=<value>...        Installation key for key-protected packages
  -o, --target-org=<value>                 (required) Username or alias of the target org. Not required if the
                                           `target-org` configuration variable is already set.
  -r, --no-prompt                          Don't prompt for confirmation.
  -s, --security-type=<option>             [default: AdminsOnly] Security access type for the installed package.
                                           (deprecation notice: The default --security-type value will change from
                                           AllUsers to AdminsOnly in v47.0 or later.)
                                           <options: AllUsers|AdminsOnly>
  -t, --upgrade-type=<option>              [default: Mixed] Upgrade type for the package installation; available only
                                           for unlocked packages.
                                           <options: DeprecateOnly|Mixed|Delete>
  -v, --target-dev-hub=<value>             Username or alias of the Dev Hub org.
  -w, --wait=<value>                       Number of minutes to wait for installation status.
  -z, --branch=<value>                     Package branch to consider when specifiying a Package/VersionNumber
                                           combination
      --api-version=<value>                Override the api version used for api requests made by this command
      --output-file=<value>                Path to write a JSON install report to.
      --package-retry-attempts=<value>...  Number of retry attempts for a specific package, overriding --retry-attempts
                                           for that package only.
      --retry-attempts=<value>             Number of additional attempts to make if a package install fails, before
                                           giving up on that package. Defaults to 0 (no retries). Does not apply when
                                           the install is still In-Progress when polling times out, since retrying could
                                           race or duplicate an install that may still complete server-side. Overridden
                                           per-package by --package-retry-attempts.
      --retry-backoff=<value>              [default: 2] Factor the delay between install retries grows by after each
                                           failed attempt (e.g. 2 doubles the delay each time). Only relevant when a
                                           package has retries enabled via --retry-attempts or --package-retry-attempts.
                                           Applies to every package's retries; there is no per-package override.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Install package dependencies for a Salesforce project.

  Installs all specified package dependencies in a Salesforce DX project using the sfdx-project.json definition.

EXAMPLES
  $ sf simply package dependencies install --target-org myTargetOrg --target-dev-hub myTargetDevHub

  $ sf simply package dependencies install --target-org myTargetOrg --target-dev-hub myTargetDevHub --installation-key "MyPackage1Alias:MyPackage1Key"

  $ sf simply package dependencies install --target-org myTargetOrg --target-dev-hub myTargetDevHub --installation-key "MyPackage1Alias:MyPackage1Key" --installation-key "MyPackage2Alias:MyPackage2Key"

  $ sf simply package dependencies install --target-org myTargetOrg --target-dev-hub myTargetDevHub --output-file install-report.json

  $ sf simply package dependencies install --target-org myTargetOrg --target-dev-hub myTargetDevHub --retry-attempts 3 --retry-backoff 2

  $ sf simply package dependencies install --target-org myTargetOrg --target-dev-hub myTargetDevHub --retry-attempts 1 --package-retry-attempts "MyPackage1Alias:5"

FLAG DESCRIPTIONS
  -a, --apex-compile=all|package

    Compile all Apex in the org and package, or only Apex in the package; unlocked packages only.

    Applies to unlocked packages only. Specifies whether to compile all Apex in the org and package, or only the Apex in
    the package.

    For package installs into production orgs, or any org that has Apex Compile on Deploy enabled, the platform compiles
    all Apex in the org after the package install or upgrade operation completes.

    This approach assures that package installs and upgrades don’t impact the performance of an org, and is done even if
    --apex-compile package is specified.

  -i, --install-type=All|Delta|Upgrade  Install all packages, only deltas, or only newer versions.

    If 'All' is specified, then all packages specified in package dependencies are installed, regardless of if the
    version already is installed in the org. If 'Delta' is specified, then only packages that differ from what is
    installed in the org will be installed. If 'Upgrade' is specified, then a package is installed only if it isn't
    already installed, or if its semantic version (major.minor.patch.build) is newer than the version currently
    installed in the org; packages with an installed version that is the same as or newer than the target version are
    skipped.

  -k, --installation-key=<value>...  Installation key for key-protected packages

    Installation key for key-protected packages in the key:value format of SubscriberPackageVersionId:Key

  -r, --no-prompt  Don't prompt for confirmation.

    Allows the following without an explicit confirmation response: 1) Remote Site Settings and Content Security Policy
    websites to send or receive data, and 2) --upgrade-type Delete to proceed.

  -t, --upgrade-type=DeprecateOnly|Mixed|Delete

    Upgrade type for the package installation; available only for unlocked packages.

    For package upgrades, specifies whether to mark all removed components as deprecated (DeprecateOnly), to delete
    removed components that can be safely deleted and deprecate the others (Mixed), or to delete all removed components,
    except for custom objects and custom fields, that don't have dependencies (Delete). The default is Mixed. Can
    specify DeprecateOnly or Delete only for unlocked package upgrades.

  -z, --branch=<value>  Package branch to consider when specifiying a Package/VersionNumber combination

    For dependencies specified by Package/VersionNumber combination, you can specify the branch group of builds to work
    from by entering the branch build name. If not specified, the builds from NULL branch will be considered.

  --output-file=<value>  Path to write a JSON install report to.

    When specified, a JSON report of the install outcome for every resolved dependency is written to this path, in
    addition to the normal terminal output you can continue to monitor as the command runs. Each entry includes the
    package name, the SubscriberPackageVersionId already installed in the org (if any), the SubscriberPackageVersionId
    that was attempted, and the decision made (Skipped, Installed, Installing, or Failed).

  --package-retry-attempts=<value>...

    Number of retry attempts for a specific package, overriding --retry-attempts for that package only.

    Retry attempts for a specific package in the key:value format of SubscriberPackageVersionId:RetryAttempts. You can
    use an alias in place of the SubscriberPackageVersionId. Repeat this flag to set overrides for multiple packages.
    Packages not listed here use --retry-attempts.
```

_See code: [@simplysf/simply-package](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-package@3.0.0/packages/simply-package/lib/commands/simply/package/dependencies/install.js)_

## `sf simply package dependencies manage`

Manage package dependency versions for a Salesforce project.

```
USAGE
  $ sf simply package dependencies manage -v <value> [--json] [--flags-dir <value>] [-b <value>] [--update-to-released |
    --update-to-latest] [--api-version <value>]

FLAGS
  -b, --branch=<value>          Package branch to consider when evaluating version options.
  -v, --target-dev-hub=<value>  (required) Username or alias of the Dev Hub org. Not required if the `target-dev-hub`
                                configuration variable is already set.
      --api-version=<value>     Override the api version used for api requests made by this command
      --update-to-latest        Automatically set all dependencies to the latest non-pinned build.
      --update-to-released      Automatically update all dependencies to the latest released version.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Manage package dependency versions for a Salesforce project.

  Interactively updates package dependency versions in sfdx-project.json by querying the Dev Hub for available versions.
  Supports interactive selection or automatic update to the latest released or latest build version.

  Project-level configuration (in sfdx-project.json) is read from the following keys:

  - plugins.simply.dependencies.ignore — array of Package2Ids or aliases to leave unchanged
  - plugins.simply.package.brancheswithreleasedversions — array of branch names that contain released versions

EXAMPLES
  $ sf simply package dependencies manage --target-dev-hub myDevHub

  $ sf simply package dependencies manage --target-dev-hub myDevHub --branch my-feature-branch

  $ sf simply package dependencies manage --target-dev-hub myDevHub --update-to-released

  $ sf simply package dependencies manage --target-dev-hub myDevHub --update-to-latest

FLAG DESCRIPTIONS
  -b, --branch=<value>  Package branch to consider when evaluating version options.

    When specified, the command will include the latest build on this branch as a selectable option for each dependency.

  --update-to-latest  Automatically set all dependencies to the latest non-pinned build.

    When specified, all dependencies managed by the Dev Hub are automatically set to a non-pinned X.Y.Z.LATEST version
    number without interactive prompts. Mutually exclusive with --update-to-released.

  --update-to-released  Automatically update all dependencies to the latest released version.

    When specified, all dependencies managed by the Dev Hub are automatically updated to the latest released package
    version without interactive prompts. Mutually exclusive with --update-to-latest.
```

_See code: [@simplysf/simply-package](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-package@3.0.0/packages/simply-package/lib/commands/simply/package/dependencies/manage.js)_

## `sf simply package version cleanup`

Cleanup package versions.

```
USAGE
  $ sf simply package version cleanup -p <value> -v <value> [--json] [--flags-dir <value>] [--api-version <value>] [-s <value>... |
    -x <value>...]

FLAGS
  -p, --package=<value>              (required) Package Id
  -s, --selector=<value>...          One or more MAJOR.MINOR.PATCH values to select on
  -v, --target-dev-hub=<value>       (required) Username or alias of the Dev Hub org. Not required if the
                                     `target-dev-hub` configuration variable is already set.
  -x, --selector-exclude=<value>...  One or more MAJOR.MINOR.PATCH values to exclude on
      --api-version=<value>          Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Cleanup package versions.

  Delete package versions for a given package provided one or more MAJOR.MINOR.PATCH selectors, either to select on or
  to exclude on. Does not delete released package versions.

  If --selector is provided, only the unreleased versions matching any of the given MAJOR.MINOR.PATCH values are
  deleted. If --selector-exclude is provided instead, every unreleased version that does _not_ match any of the given
  MAJOR.MINOR.PATCH values is deleted. Exactly one of --selector or --selector-exclude must be specified; each accepts
  multiple values.

EXAMPLES
  $ sf simply package version cleanup --package 0Hoxx00000000CqCAI --selector 2.10.0 --target-dev-hub myDevHub

  $ sf simply package version cleanup --package 0Hoxx00000000CqCAI --selector 2.10.0 --selector 2.11.0 --target-dev-hub myDevHub

  $ sf simply package version cleanup --package 0Hoxx00000000CqCAI --selector-exclude 2.10.0 --target-dev-hub myDevHub

FLAG DESCRIPTIONS
  -p, --package=<value>  Package Id

    The 0Ht Package Id that you wish to cleanup versions for.

  -s, --selector=<value>...  One or more MAJOR.MINOR.PATCH values to select on

    The MAJOR.MINOR.PATCH selector(s) that should be used to find package versions to delete. Only unreleased versions
    matching any of the given selectors are deleted. Mutually exclusive with --selector-exclude.

  -x, --selector-exclude=<value>...  One or more MAJOR.MINOR.PATCH values to exclude on

    The MAJOR.MINOR.PATCH selector(s) that should be used to find package versions to keep. Every unreleased version
    that does not match any of the given selectors is deleted. Mutually exclusive with --selector.
```

_See code: [@simplysf/simply-package](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-package@3.0.0/packages/simply-package/lib/commands/simply/package/version/cleanup.js)_

## `sf simply package version get`

Get a package version from sfdx-project.json.

```
USAGE
  $ sf simply package version get -p <value> [--json] [--flags-dir <value>] [-d <value>]

FLAGS
  -d, --directory=<value>  Package directory to search.
  -p, --package=<value>    (required) Package name or alias to look up.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Get a package version from sfdx-project.json.

  Reads the version a package is declared at in your project's sfdx-project.json and prints it, so a script doesn't have
  to parse the project file itself.

  Both dependencies and the project's own package are searched. A dependency declared as an alias (test-package@0.1.0+2)
  resolves to the version portion of the alias; a dependency declared as a package name plus a versionNumber resolves to
  that versionNumber; a dependency declared as a raw ID resolves through packageAliases. A package directory that builds
  the package resolves to that directory's versionNumber.

  The version is returned exactly as it appears in the project file — no normalizing between the 0.1.0+2, 57.0.0-3, and
  1.2.3.LATEST forms, since each means something to the tool that consumes it.

  This command reads the project file only. It never contacts an org or a Dev Hub, so it can run in a pipeline before
  any authentication step.

EXAMPLES
  Get the version of a dependency:

    $ sf simply package version get --package test-package

  Get the version of the package the project itself builds:

    $ sf simply package version get --package my-package

  Get a dependency's version from one package directory:

    $ sf simply package version get --package test-package --directory force-app

FLAG DESCRIPTIONS
  -d, --directory=<value>  Package directory to search.

    The path of a single package directory to search, matching a "path" value in packageDirectories. Use this when the
    same package is declared at different versions in more than one package directory.

  -p, --package=<value>  Package name or alias to look up.

    The package name as it appears in sfdx-project.json, without a version suffix. For a dependency declared as
    "test-package@0.1.0+2", pass "test-package".
```

_See code: [@simplysf/simply-package](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-package@3.0.0/packages/simply-package/lib/commands/simply/package/version/get.js)_

## `sf simply permissions analyze`

Analyze permission sets and permission set groups in an org.

```
USAGE
  $ sf simply permissions analyze -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-f <value>...] [--output
    <value>]

FLAGS
  -f, --filter=<value>...    Permission set or group names to include
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command
      --output=<value>       [default: permissions_report.html] Output HTML file path

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Analyze permission sets and permission set groups in an org.

  Generates an HTML report of every permission set and permission set group in the target org, grouped by installed
  package, including their object and field permissions.

EXAMPLES
  $ sf simply permissions analyze --target-org myOrg

  $ sf simply permissions analyze --target-org myOrg --output reports/permissions.html --filter My_Permission_Set --filter Another_Set

FLAG DESCRIPTIONS
  -f, --filter=<value>...  Permission set or group names to include

    One or more PermissionSet (Name) or PermissionSetGroup (DeveloperName) API names to restrict the report to. If
    omitted, all permission sets and groups are included.

  --output=<value>  Output HTML file path

    The path to write the generated HTML report to.
```

_See code: [@simplysf/simply-permissions](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-permissions@1.3.3/packages/simply-permissions/lib/commands/simply/permissions/analyze.js)_

## `sf simply permissions assignment delete`

Delete PermissionSetAssignments for one or more PermissionSets/PermissionSetGroups.

```
USAGE
  $ sf simply permissions assignment delete -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-f <value>]
    [--permission-set-name <value>...] [--permission-set-group-name <value>...]

FLAGS
  -f, --file=<value>                          Path to a destructiveChanges.xml/package.xml-shaped file
  -o, --target-org=<value>                    (required) Username or alias of the target org. Not required if the
                                              `target-org` configuration variable is already set.
      --api-version=<value>                   Override the api version used for api requests made by this command
      --permission-set-group-name=<value>...  PermissionSetGroup DeveloperName(s) to delete assignments for
      --permission-set-name=<value>...        PermissionSet Name(s) to delete assignments for

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Delete PermissionSetAssignments for one or more PermissionSets/PermissionSetGroups.

  Deletes every `PermissionSetAssignment` against the named `PermissionSet`s and/or `PermissionSetGroup`s — the pre-step
  a destructive metadata deploy of the permission set/group itself needs, so it doesn't fail or leave orphaned
  assignments behind.

  Targets can be named either via `--file`, pointing at a `destructiveChanges.xml`/`package.xml`-shaped file whose
  `PermissionSet`/`PermissionSetGroup` type members are the targets, or via
  `--permission-set-name`/`--permission-set-group-name` flags (which may be combined with each other) for scripted or
  one-off use. `--file` is mutually exclusive with the two explicit-name flags.

EXAMPLES
  $ sf simply permissions assignment delete --file destructive/pre/destructiveChanges.xml --target-org myOrg

  $ sf simply permissions assignment delete --permission-set-name My_Permission_Set --target-org myOrg

  $ sf simply permissions assignment delete --permission-set-group-name My_Permission_Set_Group --target-org myOrg
```

_See code: [@simplysf/simply-permissions](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-permissions@1.3.3/packages/simply-permissions/lib/commands/simply/permissions/assignment/delete.js)_

## `sf simply permissions build`

Generate a permission set from Salesforce source metadata.

```
USAGE
  $ sf simply permissions build --type read-only|view-all|modify-all -n <value> -d <value> --output <value> [--json]
    [--flags-dir <value>] [-c <value>] [--include-record-types] [--label <value>] [--description <value>]

FLAGS
  -c, --config=<value>        Path to a permission set configuration file
  -d, --directory=<value>     (required) Path to the Salesforce project directory
  -n, --name=<value>          (required) API name for the permission set
      --description=<value>   Description for the permission set
      --include-record-types  Include record type visibilities
      --label=<value>         Label for the permission set
      --output=<value>        (required) Output directory
      --type=<option>         (required) Baseline permission type
                              <options: read-only|view-all|modify-all>

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate a permission set from Salesforce source metadata.

  Scans a Salesforce project directory for custom objects, fields, tabs, and (optionally) record types, then generates a
  permission set XML file with a baseline of permissions determined by --type. An optional JSON --config file can
  override individual object, field, tab, record type, and user permission settings, as well as whether the permission
  set requires activation.

EXAMPLES
  $ sf simply permissions build --type read-only --name My_Read_Only_Access --directory force-app --output force-app/main/default/permissionsets

  $ sf simply permissions build --type modify-all --name My_Admin_Access --directory force-app --config config/permission-overrides.json --output force-app/main/default/permissionsets --include-record-types

FLAG DESCRIPTIONS
  -c, --config=<value>  Path to a permission set configuration file

    The path to a JSON file that overrides individual object, field, tab, record type, and user permission settings, as
    well as whether the permission set requires activation, on top of the --type baseline.

  -d, --directory=<value>  Path to the Salesforce project directory

    The path to the Salesforce source directory to scan for custom objects, fields, tabs, and record types.

  -n, --name=<value>  API name for the permission set

    The API name for the generated permission set; also used to derive the output filename.

  --include-record-types  Include record type visibilities

    Automatically include record type visibilities discovered from the source metadata, marked as visible by default.

  --output=<value>  Output directory

    The directory to write the generated permission set XML file to.

  --type=read-only|view-all|modify-all  Baseline permission type

    The baseline permission level to generate: 'read-only' grants read access to all discovered objects and fields,
    'view-all' additionally grants view-all-records, and 'modify-all' grants full CRUD and modify-all-records access.
```

_See code: [@simplysf/simply-permissions](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-permissions@1.3.3/packages/simply-permissions/lib/commands/simply/permissions/build.js)_

## `sf simply project update api-version`

Update the Salesforce API version across a project's metadata.

```
USAGE
  $ sf simply project update api-version -d <value> -a <value> [--json] [--flags-dir <value>]

FLAGS
  -a, --api-version=<value>  (required) Target Salesforce API version
  -d, --directory=<value>    (required) Path to the Salesforce project directory

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Update the Salesforce API version across a project's metadata.

  Recursively scans a directory for `-meta.xml` files and updates every `<apiVersion>` tag to the target version. If the
  directory contains an `sfdx-project.json` file, its `sourceApiVersion` property is updated to match.

EXAMPLES
  $ sf simply project update api-version --directory force-app --api-version 62.0

  $ sf simply project update api-version --directory . --api-version 63.0

FLAG DESCRIPTIONS
  -a, --api-version=<value>  Target Salesforce API version

    The Salesforce API version to set on all metadata files and, if present, sfdx-project.json.

  -d, --directory=<value>  Path to the Salesforce project directory

    The path to the Salesforce project directory to scan for metadata files.
```

_See code: [@simplysf/simply-project](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-project@1.2.19/packages/simply-project/lib/commands/simply/project/update/api-version.js)_

## `sf simply schema generate`

Generate Salesforce CustomObject/CustomField/RecordType metadata from a CSV or Excel schema definition file.

```
USAGE
  $ sf simply schema generate -f <value> -d <value> [--json] [--flags-dir <value>]

FLAGS
  -d, --output-dir=<value>  (required) The output directory to write the generated metadata into.
  -f, --file=<value>        (required) Path to the CSV or Excel (.xlsx/.xls) schema definition file.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate Salesforce CustomObject/CustomField/RecordType metadata from a CSV or Excel schema definition file.

  Reads a flat CSV or an Excel workbook describing one or more custom objects, their fields, and (CSV only) their record
  types, and writes Salesforce DX source-format metadata (`.object-meta.xml`, `.field-meta.xml`, `.recordType-meta.xml`)
  into `--output-dir`.

  For CSV input, each row's `Type` column (`CustomObject`, `CustomField`, or `RecordType`) and `ObjectName` column group
  the rows by object. For Excel input (`.xlsx`/`.xls`), the workbook must contain an `object` worksheet (a two-column
  key/value sheet describing the sObject) and a `fields` worksheet (one row per field); picklist fields may reference an
  additional values worksheet by name.

EXAMPLES
  $ sf simply schema generate --file schema.csv --output-dir force-app/main/default/objects

  $ sf simply schema generate --file MyObject__c.xlsx --output-dir force-app/main/default/objects

FLAG DESCRIPTIONS
  -f, --file=<value>  Path to the CSV or Excel (.xlsx/.xls) schema definition file.

    A `.csv` file processed as the flat CSV flow, or a `.xlsx`/`.xls` file processed as the Excel flow.
```

_See code: [@simplysf/simply-schema](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-schema@0.3.21/packages/simply-schema/lib/commands/simply/schema/generate.js)_

## `sf simply schema visualize`

Generate visualizations of Salesforce schema from a live org or local source files.

```
USAGE
  $ sf simply schema visualize [--json] [--flags-dir <value>] [-o <value>] [--api-version <value>] [-d <value>...]
    [--source-objects <value>] [--related-objects <value>] [--object-type custom|standard|all] [--field-type
    custom|standard|all] [--output-type html|md|csv...] [--output-dir <value>]

FLAGS
  -d, --source-dir=<value>...    One or more paths to directories containing Salesforce DX source. Use this for
                                 local-source generation.
  -o, --target-org=<value>       Username or alias of the org to visualize. Use this for live-org generation.
      --api-version=<value>      Override the api version used for api requests made by this command
      --field-type=<option>      [default: custom] Scope of relationship fields to include: custom, standard, or all.
                                 <options: custom|standard|all>
      --object-type=<option>     [default: custom] Scope of objects to include: custom, standard, or all.
                                 <options: custom|standard|all>
      --output-dir=<value>       The output directory for the generated files.
      --output-type=<option>...  [default: html,md] Output format(s) to generate.
                                 <options: html|md|csv>
      --related-objects=<value>  Comma-separated list of related objects to filter the visualization to, or `all`.
      --source-objects=<value>   Comma-separated list of source objects to start from, or `all`.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Generate visualizations of Salesforce schema from a live org or local source files.

  Builds an object-relationship diagram (interactive HTML), a Mermaid entity-relationship diagram (Markdown), and/or a
  relationship CSV, either from a live org's Tooling API or from local Salesforce DX source directories. Exactly one of
  `--target-org` or `--source-dir` must be specified.

EXAMPLES
  $ sf simply schema visualize --target-org myTargetOrg

  $ sf simply schema visualize --target-org myTargetOrg --source-objects Account,Contact --related-objects all

  $ sf simply schema visualize --source-dir force-app --output-type html,md

FLAG DESCRIPTIONS
  --output-type=html|md|csv...  Output format(s) to generate.

    One or more of `html` (interactive diagram), `md` (Mermaid entity-relationship diagram), or `csv` (relationship
    data).

  --related-objects=<value>  Comma-separated list of related objects to filter the visualization to, or `all`.

    Comma-separated API names of related objects to include in the visualization. If `all` is specified, every related
    object is included regardless of `--object-type`. If not specified, related objects aren't filtered.

  --source-objects=<value>  Comma-separated list of source objects to start from, or `all`.

    Comma-separated API names of the objects to start the visualization from (e.g. `Account,MyObject__c`). If `all` is
    specified, every discovered object is included. If not specified, every object matching `--object-type` is included.
```

_See code: [@simplysf/simply-schema](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-schema@0.3.21/packages/simply-schema/lib/commands/simply/schema/visualize.js)_

## `sf simply sobject backup`

Back up SObject data to a CSV file.

```
USAGE
  $ sf simply sobject backup -o <value> -s <value> [--json] [--flags-dir <value>] [--api-version <value>] [-d <value>]
    [--include-relationship-fields] [-f <value>...]

FLAGS
  -d, --output-dir=<value>            Output directory
  -f, --additional-fields=<value>...  Additional fields to include
  -o, --target-org=<value>            (required) Username or alias of the target org. Not required if the `target-org`
                                      configuration variable is already set.
  -s, --sobject=<value>               (required) SObject API name
      --api-version=<value>           Override the api version used for api requests made by this command
      --include-relationship-fields   Include parent relationship fields

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Back up SObject data to a CSV file.

  Describes the given SObject, queries every field via the Bulk API, and writes the results to a timestamped CSV file.

EXAMPLES
  $ sf simply sobject backup --target-org myOrg --sobject Account

  $ sf simply sobject backup --target-org myOrg --sobject Custom_Object__c --output-dir backups

  $ sf simply sobject backup --target-org myOrg --sobject Account --include-relationship-fields

  $ sf simply sobject backup --target-org myOrg --sobject Account --additional-fields Owner.Manager.Name --additional-fields Parent.Owner.Email

FLAG DESCRIPTIONS
  -d, --output-dir=<value>  Output directory

    The directory to save the backup CSV file to. Defaults to the current directory.

  -f, --additional-fields=<value>...  Additional fields to include

    Extra field API names to include in the query, on top of the SObject's own fields and any fields discovered via
    --include-relationship-fields. Useful for fields --include-relationship-fields won't discover, such as multi-hop
    relationship paths (e.g. Owner.Manager.Name) or fields through a polymorphic relationship. Fields already included
    are not duplicated.

  -s, --sobject=<value>  SObject API name

    The API name of the SObject to back up.

  --include-relationship-fields  Include parent relationship fields

    For every lookup/master-detail field, describe its parent SObject and include its identifying fields (e.g.
    RecordTypeId includes RecordType.Name and RecordType.DeveloperName). Polymorphic relationship fields, such as
    OwnerId, are skipped.
```

_See code: [@simplysf/simply-sobject](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-sobject@1.6.9/packages/simply-sobject/lib/commands/simply/sobject/backup.js)_

## `sf simply sobject deduplicate`

Identify and prepare deduplication of an SObject's records.

```
USAGE
  $ sf simply sobject deduplicate -o <value> -c <value> [--json] [--flags-dir <value>] [--api-version <value>] [--dry-run]
    [--output-dir <value>]

FLAGS
  -c, --config=<value>       (required) Path to a deduplication configuration file
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command
      --dry-run              Skip calculating associated object lookup replacements
      --output-dir=<value>   Output directory

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Identify and prepare deduplication of an SObject's records.

  Queries an SObject, groups records by a composite key built from configured fields, and writes CSV files listing which
  records are unique and which are duplicates that should be deleted. For each associated object with lookups to the
  primary object, also writes a CSV of the lookup field updates needed to re-point duplicate references at the surviving
  unique record. This command does not perform any deletes or updates in the org; it only prepares the CSV files for a
  subsequent data load.

EXAMPLES
  $ sf simply sobject deduplicate --target-org myOrg --config config/deduplicate-account.json

  $ sf simply sobject deduplicate --target-org myOrg --config config/deduplicate-account.json --dry-run

FLAG DESCRIPTIONS
  -c, --config=<value>  Path to a deduplication configuration file

    The path to a JSON file describing the primary object, its composite key fields, and any associated objects with
    lookups to it.

  --dry-run  Skip calculating associated object lookup replacements

    When set, only the primary object's unique/duplicate CSV files are generated; associated object lookup replacement
    files are not calculated.

  --output-dir=<value>  Output directory

    The directory to write the generated CSV files to. Defaults to ./temp/<primaryObjectApiName>.
```

_See code: [@simplysf/simply-sobject](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-sobject@1.6.9/packages/simply-sobject/lib/commands/simply/sobject/deduplicate.js)_

## `sf simply sobject history export`

Export field history for an SObject within a date range to a CSV file.

```
USAGE
  $ sf simply sobject history export -o <value> -s <value> --start-date <value> --end-date <value> [--json] [--flags-dir <value>]
    [--api-version <value>] [-d <value>]

FLAGS
  -d, --output-dir=<value>   Output directory
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
  -s, --sobject=<value>      (required) SObject API name
      --api-version=<value>  Override the api version used for api requests made by this command
      --end-date=<value>     (required) End date (YYYY-MM-DD)
      --start-date=<value>   (required) Start date (YYYY-MM-DD)

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Export field history for an SObject within a date range to a CSV file.

  Queries the field history object for the given SObject (e.g. `AccountHistory`, `Custom_Object__History`, or
  `OpportunityFieldHistory`) for changes created within the given date range, and writes the results to a timestamped
  CSV file.

EXAMPLES
  $ sf simply sobject history export --target-org myOrg --sobject Account --start-date 2026-01-01 --end-date 2026-01-31

  $ sf simply sobject history export --target-org myOrg --sobject Custom_Object__c --start-date 2026-01-01 --end-date 2026-01-31 --output-dir exports

FLAG DESCRIPTIONS
  -d, --output-dir=<value>  Output directory

    The directory to save the exported CSV file to. Defaults to the current directory.

  -s, --sobject=<value>  SObject API name

    The API name of the SObject to export field history for (e.g. Account or Custom_Object__c).

  --end-date=<value>  End date (YYYY-MM-DD)

    The end of the date range to export history for, inclusive.

  --start-date=<value>  Start date (YYYY-MM-DD)

    The start of the date range to export history for, inclusive.
```

_See code: [@simplysf/simply-sobject](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-sobject@1.6.9/packages/simply-sobject/lib/commands/simply/sobject/history/export.js)_

## `sf simply sobject history query`

Query the field history of an SObject, with optional filtering.

```
USAGE
  $ sf simply sobject history query -o <value> --object <value> [--json] [--flags-dir <value>] [--api-version <value>] [--filters
    <value>] [-d <value>]

FLAGS
  -d, --output-dir=<value>   Output directory
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command
      --filters=<value>      Path to a filter configuration file, or a raw JSON filter string
      --object=<value>       (required) SObject API name

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Query the field history of an SObject, with optional filtering.

  Queries the field history object for the given SObject (e.g. `AccountHistory`, `Custom_Object__History`, or
  `OpportunityFieldHistory`) and writes the results to a timestamped CSV file. An optional filter tree can be supplied
  to narrow the results: conditions on Field, CreatedById, CreatedDate, or the parent lookup field are pushed into the
  SOQL WHERE clause; conditions on any other field (e.g. OldValue or NewValue) are applied client-side after the query
  runs.

EXAMPLES
  $ sf simply sobject history query --target-org myOrg --object Account

  $ sf simply sobject history query --target-org myOrg --object Custom_Object__c --filters config/history-filters.json

  $ sf simply sobject history query --target-org myOrg --object Account --filters '{"logic":"AND","filters":[{"field":"Field","operator":"=","value":"Name"}]}'

FLAG DESCRIPTIONS
  -d, --output-dir=<value>  Output directory

    The directory to save the query results CSV file to. Defaults to the current directory.

  --filters=<value>  Path to a filter configuration file, or a raw JSON filter string

    A JSON object describing a tree of filter conditions: `{ "logic": "AND", "filters": [ { "field": "Field",
    "operator": "=", "value": "Status__c" } ] }`. Each entry in `filters` is either a condition (`field`, `operator`,
    `value`) or another nested group with its own `logic`/`filters`. Supported operators are =, !=, >, <, >=, <=, IN,
    NOT IN, and LIKE (using `%` as a wildcard).

  --object=<value>  SObject API name

    The API name of the SObject to query field history for (e.g. Account or Custom_Object__c).
```

_See code: [@simplysf/simply-sobject](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-sobject@1.6.9/packages/simply-sobject/lib/commands/simply/sobject/history/query.js)_

## `sf simply sobject history schema`

Report on which objects and fields have field history tracking enabled.

```
USAGE
  $ sf simply sobject history schema -o <value> [--json] [--flags-dir <value>] [--api-version <value>] [-d <value>]

FLAGS
  -d, --output-dir=<value>   Output directory
  -o, --target-org=<value>   (required) Username or alias of the target org. Not required if the `target-org`
                             configuration variable is already set.
      --api-version=<value>  Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Report on which objects and fields have field history tracking enabled.

  Identifies every object with field history tracking enabled, and every tracked field on each, resolving the
  managed/unlocked package each field belongs to, and writes the results to a timestamped CSV file and a browsable HTML
  report.

EXAMPLES
  $ sf simply sobject history schema --target-org myOrg

  $ sf simply sobject history schema --target-org myOrg --output-dir reports

FLAG DESCRIPTIONS
  -d, --output-dir=<value>  Output directory

    The directory to save the generated CSV and HTML report files to. Defaults to the current directory.
```

_See code: [@simplysf/simply-sobject](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-sobject@1.6.9/packages/simply-sobject/lib/commands/simply/sobject/history/schema.js)_

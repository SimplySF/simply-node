# @simplysf/simply-flow

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-flow?label=@simplysf/simply-flow)](https://npmjs.com/@simplysf/simply-flow) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-flow.svg)](https://npmjs.com/@simplysf/simply-flow) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

## Install

```bash
sf plugins install @simplysf/simply-flow
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See the repo's [CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for the repo structure, how to set up and build the project, our commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## Commands

<!-- commands -->

- [`sf simply flow delete`](#sf-simply-flow-delete)
- [`sf simply flow version prune`](#sf-simply-flow-version-prune)

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

_See code: [lib/commands/simply/flow/delete.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-flow@0.2.0/packages/simply-flow/lib/commands/simply/flow/delete.js)_

## `sf simply flow version prune`

Delete obsolete versions of Flows found in local source.

```
USAGE
  $ sf simply flow version prune -o <value> -d <value>... [--json] [--flags-dir <value>] [--api-version <value>]
  [--dry-run]

FLAGS
  -d, --source-dir=<value>...  (required) Directories to scan for *.flow-meta.xml files
  -o, --target-org=<value>     (required) Username or alias of the target org. Not required if the `target-org`
                               configuration variable is already set.
      --api-version=<value>    Override the api version used for api requests made by this command
      --dry-run                List obsolete versions without deleting them

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Delete obsolete versions of Flows found in local source.

  Scans one or more source directories for `*.flow-meta.xml` files, then deletes any Tooling API Flow version already
  `Status = 'Obsolete'` for those flows — keeping an org's Flow version history from accumulating indefinitely. Unlike
  `simply flow delete`, this never touches an active Flow; it only removes versions the org itself already marked
  obsolete.

  Use `--dry-run` to see what would be deleted without deleting anything.

EXAMPLES
  $ sf simply flow version prune --target-org myOrg --source-dir sfdx-source/core

  $ sf simply flow version prune --target-org myOrg --source-dir sfdx-source/core --dry-run
```

_See code: [lib/commands/simply/flow/version/prune.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-flow@0.2.0/packages/simply-flow/lib/commands/simply/flow/version/prune.js)_
<!-- commandsstop -->

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.

# @simplysf/simply-package

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-package.svg?label=@simplysf/simply-package)](https://www.npmjs.com/package/@simplysf/simply-package) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-package.svg)](https://npmjs.org/package/@simplysf/simply-package) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

## Install

```bash
sf plugins install @simplysf/simply-package
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See the repo's [CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for the repo structure, how to set up and build the project, our commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## Commands

<!-- commands -->

- [`sf simply package dependencies install`](#sf-simply-package-dependencies-install)
- [`sf simply package dependencies manage`](#sf-simply-package-dependencies-manage)
- [`sf simply package version cleanup`](#sf-simply-package-version-cleanup)
- [`sf simply package version get`](#sf-simply-package-version-get)

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

_See code: [lib/commands/simply/package/dependencies/install.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-package@2.9.0/packages/simply-package/lib/commands/simply/package/dependencies/install.js)_

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

_See code: [lib/commands/simply/package/dependencies/manage.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-package@2.9.0/packages/simply-package/lib/commands/simply/package/dependencies/manage.js)_

## `sf simply package version cleanup`

Cleanup package versions.

```
USAGE
  $ sf simply package version cleanup -p <value> -v <value> [--json] [--flags-dir <value>] [--api-version <value>] [-s <value> | -x
    <value>]

FLAGS
  -p, --package=<value>          (required) Package Id
  -s, --matcher=<value>          MAJOR.MINOR.PATCH to select on
  -v, --target-dev-hub=<value>   (required) Username or alias of the Dev Hub org. Not required if the `target-dev-hub`
                                 configuration variable is already set.
  -x, --exclude-matcher=<value>  MAJOR.MINOR.PATCH to exclude on
      --api-version=<value>      Override the api version used for api requests made by this command

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Cleanup package versions.

  Delete package versions for a given package provided a MAJOR.MINOR.PATCH matcher, either to select on or to exclude
  on. Does not delete released package versions.

  If --matcher is provided, only the unreleased versions matching MAJOR.MINOR.PATCH are deleted. If --exclude-matcher is
  provided instead, every unreleased version that does _not_ match MAJOR.MINOR.PATCH is deleted. Exactly one of
  --matcher or --exclude-matcher must be specified.

EXAMPLES
  $ sf simply package version cleanup --package 0Hoxx00000000CqCAI --matcher 2.10.0 --target-dev-hub myDevHub

  $ sf simply package version cleanup --package 0Hoxx00000000CqCAI --exclude-matcher 2.10.0 --target-dev-hub myDevHub

FLAG DESCRIPTIONS
  -p, --package=<value>  Package Id

    The 0Ht Package Id that you wish to cleanup versions for.

  -s, --matcher=<value>  MAJOR.MINOR.PATCH to select on

    The MAJOR.MINOR.PATCH matcher that should be used to find package versions to delete. Only versions matching this
    matcher are deleted. Mutually exclusive with --exclude-matcher.

  -x, --exclude-matcher=<value>  MAJOR.MINOR.PATCH to exclude on

    The MAJOR.MINOR.PATCH matcher that should be used to find package versions to keep. Every unreleased version that
    does not match this matcher is deleted. Mutually exclusive with --matcher.
```

_See code: [lib/commands/simply/package/version/cleanup.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-package@2.9.0/packages/simply-package/lib/commands/simply/package/version/cleanup.js)_

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

_See code: [lib/commands/simply/package/version/get.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-package@2.9.0/packages/simply-package/lib/commands/simply/package/version/get.js)_
<!-- commandsstop -->

## Configuration Files

`sf simply package dependencies install` and `sf simply package dependencies manage` don't take a separate config file — they read from your project's existing **`sfdx-project.json`**.

### `packageDirectories[].dependencies`

Each package directory's `dependencies` array lists the packages to install/manage:

```json
{
  "packageDirectories": [
    {
      "path": "force-app",
      "default": true,
      "dependencies": [
        { "package": "MyDependency@1.2.0-1" },
        { "package": "0Ho000000000001AAA", "versionNumber": "2.5.0.LATEST" },
        { "package": "0Ho000000000002AAA", "versionNumber": "3.1.0.LATEST", "branch": "release/2026-Q1" }
      ]
    }
  ]
}
```

| Field           | Type     | Required | Description                                                                                                                                                                           |
| --------------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package`       | `string` | Yes      | Either a package alias, a `SubscriberPackageVersionId` (`04t...`), or a `Package2Id` (`0Ho...`). A `Package2Id` requires `versionNumber` and must be resolved via `--target-dev-hub`. |
| `versionNumber` | `string` | No       | Required when `package` is a `Package2Id`. A `MAJOR.MINOR.PATCH.BUILD` version, where `BUILD` may be `LATEST` for a non-pinned build.                                                 |
| `branch`        | `string` | No       | Scopes dev hub version resolution to a specific build branch. Only used when `versionNumber` is also set.                                                                             |

### `plugins.simply` (used by `dependencies manage`)

`sf simply package dependencies manage` reads optional settings from a `plugins.simply` block in `sfdx-project.json`:

```json
{
  "plugins": {
    "simply": {
      "dependencies": {
        "ignore": ["MyLockedDependency", "0Ho000000000002AAA"]
      },
      "package": {
        "brancheswithreleasedversions": ["release/2026-Q1"]
      }
    }
  }
}
```

| Key                                                   | Type       | Description                                                                                   |
| ----------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `plugins.simply.dependencies.ignore`                  | `string[]` | `Package2Id`s or aliases that `dependencies manage` should leave unchanged.                   |
| `plugins.simply.package.brancheswithreleasedversions` | `string[]` | Branch names that contain released versions, considered in addition to the main build branch. |

## Report Files

### `sf simply package dependencies install --output-file`

The `--output-file` flag on `sf simply package dependencies install` writes a JSON array to the given path, with one entry per resolved dependency. It's the same array the command returns (e.g. via `--json`), just persisted to disk so you can consume it after the run — useful for feeding a follow-up step, or auditing what happened without having to scroll back through terminal output.

```json
[
  {
    "PackageName": "MyDependency@1.2.0-1",
    "ExistingSubscriberPackageVersionId": "04t000000000001AAA",
    "SubscriberPackageVersionId": "04t000000000001AAA",
    "Status": "Skipped"
  },
  {
    "PackageName": "AnotherDependency@2.5.0-3",
    "ExistingSubscriberPackageVersionId": "04t000000000002AAA",
    "SubscriberPackageVersionId": "04t000000000003AAA",
    "Status": "Installed"
  },
  {
    "PackageName": "NewDependency@1.0.0-1",
    "ExistingSubscriberPackageVersionId": "",
    "SubscriberPackageVersionId": "04t000000000004AAA",
    "Status": "Installed"
  }
]
```

In this example: `MyDependency` was already at the target version, so it was skipped; `AnotherDependency` had an older version installed (`...0002AAA`) and was upgraded to the target (`...0003AAA`); `NewDependency` had nothing installed yet (an empty `ExistingSubscriberPackageVersionId`) and was installed fresh.

| Field                                | Type     | Description                                                                                          |
| ------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------- |
| `PackageName`                        | `string` | The dependency's alias or ID, as declared in `sfdx-project.json`.                                    |
| `ExistingSubscriberPackageVersionId` | `string` | The `SubscriberPackageVersionId` already installed in the org for this package, or `""` if none was. |
| `SubscriberPackageVersionId`         | `string` | The `SubscriberPackageVersionId` this command attempted to install.                                  |
| `Status`                             | `string` | `""`, `"Skipped"`, `"Installing"`, `"Installed"`, or `"Failed"`.                                     |

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.

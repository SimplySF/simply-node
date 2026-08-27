---
title: '@simplysf/simply-permissions'
description: 'Utilities for working with permissions'
---

Utilities for working with permissions

```sh
sf plugins install @simplysf/simply-permissions
```

## Commands

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

_See code: [lib/commands/simply/permissions/analyze.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-permissions@1.2.31/packages/simply-permissions/lib/commands/simply/permissions/analyze.js)_

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

_See code: [lib/commands/simply/permissions/build.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-permissions@1.2.31/packages/simply-permissions/lib/commands/simply/permissions/build.js)_

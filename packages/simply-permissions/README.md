# @simplysf/simply-permissions

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-permissions?label=@simplysf/simply-permissions)](https://npmjs.com/@simplysf/simply-permissions) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-permissions.svg)](https://npmjs.com/@simplysf/simply-permissions) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

## Install

```bash
sf plugins install @simplysf/simply-permissions
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See the repo's [CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for the repo structure, how to set up and build the project, our commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## Commands

<!-- commands -->

- [`sf simply permissions analyze`](#sf-simply-permissions-analyze)
- [`sf simply permissions build`](#sf-simply-permissions-build)

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
<!-- commandsstop -->

- [`sf simply permissions analyze`](#sf-simply-permissions-analyze)
- [`sf simply permissions build`](#sf-simply-permissions-build)

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

_See code: [lib/commands/simply/permissions/analyze.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-permissions@1.2.13/packages/simply-permissions/lib/commands/simply/permissions/analyze.js)_

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

_See code: [lib/commands/simply/permissions/build.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-permissions@1.2.13/packages/simply-permissions/lib/commands/simply/permissions/build.js)_
<!-- commandsstop -->

## Configuration Files

### `sf simply permissions build --config`

The `--config` flag on `sf simply permissions build` takes the path to a JSON file that overrides the `--type` baseline permissions. Every top-level key is optional — only the settings you include are applied:

```json
{
  "objects": {
    "Account": { "read": true, "create": true, "edit": true, "viewAll": true }
  },
  "fields": {
    "Account.AnnualRevenue": { "readable": true, "editable": false }
  },
  "tabs": {
    "Account": { "visible": true }
  },
  "recordTypeVisibilities": {
    "Account.Enterprise": { "visible": true }
  },
  "userPermissions": {
    "ApiEnabled": true
  },
  "hasActivationRequired": false
}
```

| Field                    | Type                                   | Keyed by                     | Description                                                                                                                                              |
| ------------------------ | -------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `objects`                | `Record<string, ObjectPerm>`           | Object API name              | Overrides object-level access. `ObjectPerm` fields: `read`, `create`, `edit`, `delete`, `modifyAll`, `viewAll`, `viewAllFields` (all optional booleans). |
| `fields`                 | `Record<string, FieldPerm>`            | `Object.Field` API name      | Overrides field-level access. `FieldPerm` fields: `readable`, `editable` (optional booleans).                                                            |
| `tabs`                   | `Record<string, TabSetting>`           | Tab API name                 | Overrides tab visibility. `TabSetting` fields: `visible` (optional boolean).                                                                             |
| `recordTypeVisibilities` | `Record<string, RecordTypeVisibility>` | `Object.RecordType` API name | Overrides record type visibility. Fields: `visible` (optional boolean). Only applied when `--include-record-types` is also passed.                       |
| `userPermissions`        | `Record<string, boolean>`              | User permission API name     | Enables (`true`) or disables (`false`) individual user permissions.                                                                                      |
| `hasActivationRequired`  | `boolean`                              | —                            | Whether the generated permission set requires activation before it grants access. Defaults to `false`.                                                   |

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.

---
title: '@simplysf/simply-apex'
description: 'Utilities for working with Apex'
---

Utilities for working with Apex

```sh
sf plugins install @simplysf/simply-apex
```

## Commands

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

_See code: [lib/commands/simply/apex/execute.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-apex@1.6.10/packages/simply-apex/lib/commands/simply/apex/execute.js)_

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

_See code: [lib/commands/simply/apex/logs/purge.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-apex@1.6.10/packages/simply-apex/lib/commands/simply/apex/logs/purge.js)_

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

_See code: [lib/commands/simply/apex/test-suite/generate.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-apex@1.6.10/packages/simply-apex/lib/commands/simply/apex/test-suite/generate.js)_

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

_See code: [lib/commands/simply/apex/trace/setup.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-apex@1.6.10/packages/simply-apex/lib/commands/simply/apex/trace/setup.js)_

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

_See code: [lib/commands/simply/apex/trace/silence.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-apex@1.6.10/packages/simply-apex/lib/commands/simply/apex/trace/silence.js)_

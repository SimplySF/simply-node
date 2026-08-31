# @simplysf/simply-data

[![NPM](https://img.shields.io/npm/v/@simplysf/simply-data?label=@simplysf/simply-data)](https://npmjs.com/@simplysf/simply-data) [![Downloads/week](https://img.shields.io/npm/dw/@simplysf/simply-data.svg)](https://npmjs.com/@simplysf/simply-data) [![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt)

## Install

```bash
sf plugins install @simplysf/simply-data
```

## Issues

Please report any issues at https://github.com/SimplySF/simply-node/issues

## Contributing

This package is part of the [`@simplysf/simply`](https://github.com/SimplySF/simply-node) monorepo. See the repo's [CONTRIBUTING.md](https://github.com/SimplySF/simply-node/blob/main/CONTRIBUTING.md) for the repo structure, how to set up and build the project, our commit conventions, and how to submit a pull request. Please also read our [Code of Conduct](https://github.com/SimplySF/simply-node/blob/main/CODE_OF_CONDUCT.md).

## Commands

<!-- commands -->

- [`sf simply data file upload`](#sf-simply-data-file-upload)
- [`sf simply data files download`](#sf-simply-data-files-download)
- [`sf simply data files upload`](#sf-simply-data-files-upload)

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

_See code: [lib/commands/simply/data/file/upload.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-data@2.4.3/packages/simply-data/lib/commands/simply/data/file/upload.js)_

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

_See code: [lib/commands/simply/data/files/download.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-data@2.4.3/packages/simply-data/lib/commands/simply/data/files/download.js)_

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

_See code: [lib/commands/simply/data/files/upload.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-data@2.4.3/packages/simply-data/lib/commands/simply/data/files/upload.js)_
<!-- commandsstop -->

## License

Licensed under the [Apache-2.0](https://raw.githubusercontent.com/SimplySF/simply-node/main/LICENSE.txt) license.

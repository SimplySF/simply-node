# summary

List the AT4DX Selector field set inclusions configured in an org or local source.

# description

Reads `SelectorConfig_FieldSetInclusion__mdt` — either from a live org or from local Salesforce DX source — and lists every record found. Unlike `simply aep at4dx binding list`, there's no priority/winner concept: every `IsActive__c: true` record for a selector's SObject contributes its field set simultaneously, so this is a flat table, not a resolved one. Exactly one of `--target-org` or `--source-dir` must be specified.

# flags.target-org.summary

Username or alias of the org to read field set inclusions from. Use this for live-org discovery.

# flags.source-dir.summary

One or more paths to directories containing Salesforce DX source. Use this for local-source discovery.

# examples

- <%= config.bin %> <%= command.id %> --target-org myOrg

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --source-dir sfdx-source/app

- <%= config.bin %> <%= command.id %> --target-org myOrg --json

# error.targetOrgOrSourceDirRequired

You must specify either --target-org or --source-dir, but not both.

# error.at4dxNotDetected

AT4DX doesn't appear to be present in this source: the SelectorConfig_FieldSetInclusion__mdt Custom Metadata Type wasn't found.

# error.localScanFailed

Failed to scan the project directory: %s

# error.orgQueryFailed

Failed to query field set inclusions from the org: %s

# info.queryingOrg

Querying field set inclusions from %s...

# info.scanningLocalSource

Scanning local source for field set inclusions...

# info.complete

Found %s field set inclusion(s) in %s

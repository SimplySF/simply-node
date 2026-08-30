# summary

Validate the AT4DX Selector field set inclusions configured in an org or local source, failing when a wiring problem is found.

# description

Reads `SelectorConfig_FieldSetInclusion__mdt` — either from a live org or from local Salesforce DX source — and checks them for problems `simply aep at4dx field-set-inclusion list` doesn't fail on: a record with no resolvable SObject, an ambiguous SObject reference, a SObject reference naming a standard object that can't actually go through an EntityDefinition metadata relationship, two records sharing a FieldsetName__c value (unique org-wide, not per-SObject), and the same DeveloperName defined more than once. Exactly one of `--target-org` or `--source-dir` must be specified.

Prints a table of every issue found. Exits non-zero when any issue is an error (a warning alone doesn't fail the command) — use this in CI to gate on AT4DX field set inclusion wiring problems before they reach an org.

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

# info.valid

No issues found across %s field set inclusion(s) in %s

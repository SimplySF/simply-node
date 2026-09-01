# summary

List the AT4DX Platform Event Distributor subscriptions configured in an org or local source.

# description

Reads `PlatformEvents_Subscription__mdt` — either from a live org or from local Salesforce DX source — and lists every record found, grouped by event bus then category. Unlike `simply aep at4dx binding list`, there's no priority/winner concept: every `IsActive__c: true` subscription for a matching event is invoked by the distributor, so this is a flat table, not a resolved one. Exactly one of `--target-org` or `--source-dir` must be specified.

# flags.target-org.summary

Username or alias of the org to read platform event subscriptions from. Use this for live-org discovery.

# flags.source-dir.summary

One or more paths to directories containing Salesforce DX source. Use this for local-source discovery.

# examples

- <%= config.bin %> <%= command.id %> --target-org myOrg

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --source-dir sfdx-source/app

- <%= config.bin %> <%= command.id %> --target-org myOrg --json

# error.targetOrgOrSourceDirRequired

You must specify either --target-org or --source-dir, but not both.

# error.at4dxNotDetected

AT4DX doesn't appear to be present in this source: the PlatformEvents_Subscription__mdt Custom Metadata Type wasn't found.

# error.localScanFailed

Failed to scan the project directory: %s

# error.orgQueryFailed

Failed to query platform event subscriptions from the org: %s

# info.queryingOrg

Querying platform event subscriptions from %s...

# info.scanningLocalSource

Scanning local source for platform event subscriptions...

# info.complete

Found %s platform event subscription(s) in %s

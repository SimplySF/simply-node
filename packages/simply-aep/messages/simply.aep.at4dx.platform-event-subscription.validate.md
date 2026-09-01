# summary

Validate the AT4DX Platform Event Distributor subscriptions configured in an org or local source, failing when a wiring problem is found.

# description

Reads `PlatformEvents_Subscription__mdt` — either from a live org or from local Salesforce DX source — and checks them for problems `simply aep at4dx platform-event-subscription list` doesn't fail on: a blank or unrecognized EventBus__c/Consumer__c/MatcherRule__c, a matcher rule that dereferences a blank match field (a real NullPointerException risk at runtime), a MatchEventBus record the distributor's own pre-filter can never admit, an event bus missing fields the distributor reads (only checked for a bus this command can see the field list of), two records sharing a Consumer__c value (unique org-wide), and the same DeveloperName defined more than once. Exactly one of `--target-org` or `--source-dir` must be specified.

Several of these problems fail silently at runtime in a real org — PlatformEventDistributor's consumer construction only logs to System.debug on failure, and one malformed record can take down every subscription's DI module. Catching them here, before deploy, is the whole point of this command.

Prints a table of every issue found. Exits non-zero when any issue is an error (a warning alone doesn't fail the command) — use this in CI to gate on AT4DX platform event subscription wiring problems before they reach an org.

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

# info.valid

No issues found across %s platform event subscription(s) in %s

# summary

List the AT4DX Trigger Action Framework bindings configured in an org or local source, in execution order.

# description

Reads AT4DX's Trigger Action Framework Custom Metadata Type — `DomainProcessBinding__mdt` — either from a live org or from local Salesforce DX source, showing which criteria/action classes are bound to each SObject's trigger events (or domain method tokens), and the order they run in. Exactly one of `--target-org` or `--source-dir` must be specified.

Unlike `simply aep at4dx binding list`, there's no "winner" here — every active record in a group (same SObject, process context, and trigger operation or domain method token) runs, in `OrderOfExecution__c` order. Two active records sharing the same order within a group are flagged as a collision, since AT4DX doesn't guarantee which one runs first in that case.

# flags.target-org.summary

Username or alias of the org to read bindings from. Use this for live-org discovery.

# flags.source-dir.summary

One or more paths to directories containing Salesforce DX source. Use this for local-source discovery.

# flags.sobject.summary

SObject API name(s) to filter to. If not specified, bindings for every SObject are included.

# flags.active-only.summary

Only show active bindings; hide inactive records.

# examples

- <%= config.bin %> <%= command.id %> --target-org myOrg

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --source-dir sfdx-source/app

- <%= config.bin %> <%= command.id %> --target-org myOrg --sobject Account

- <%= config.bin %> <%= command.id %> --target-org myOrg --active-only --json

# error.targetOrgOrSourceDirRequired

You must specify either --target-org or --source-dir, but not both.

# error.at4dxNotDetected

AT4DX's Trigger Action Framework doesn't appear to be present in this source: the DomainProcessBinding__mdt Custom Metadata Type wasn't found.

# error.localScanFailed

Failed to scan the project directory: %s

# error.orgQueryFailed

Failed to query bindings from the org: %s

# info.queryingOrg

Querying bindings from %s...

# info.scanningLocalSource

Scanning local source for bindings...

# info.complete

Found %s binding(s) in %s

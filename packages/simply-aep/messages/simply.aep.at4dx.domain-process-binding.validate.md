# summary

Validate the AT4DX Trigger Action Framework bindings configured in an org or local source, failing when a wiring problem is found.

# description

Reads AT4DX's Trigger Action Framework Custom Metadata Type — `DomainProcessBinding__mdt` — either from a live org or from local Salesforce DX source, and checks it for problems `simply aep at4dx domain-process-binding list` doesn't fail on: two active records silently fighting over the same execution slot, a binding with no resolvable SObject, a binding whose declared process context doesn't match the field that's actually populated (so it never runs), the same DeveloperName defined more than once, and an ambiguous SObject reference. Exactly one of `--target-org` or `--source-dir` must be specified.

Prints a table of every issue found. When --sobject is specified, scan-wide issues (a duplicate DeveloperName, or a binding with no resolvable SObject) print in their own section below the filtered table, since they can't be attributed to one SObject. Exits non-zero when any issue is an error (a warning alone doesn't fail the command) — use this in CI to gate on AT4DX wiring problems before they reach an org.

# flags.target-org.summary

Username or alias of the org to read bindings from. Use this for live-org discovery.

# flags.source-dir.summary

One or more paths to directories containing Salesforce DX source. Use this for local-source discovery.

# flags.sobject.summary

SObject API name(s) to filter to. Applies only to issues that name an SObject; issues that span the whole scan (a duplicate DeveloperName, or a binding with no resolvable SObject) are always reported, since filtering could hide the exact conflict they exist to catch. If not specified, every issue is included.

# examples

- <%= config.bin %> <%= command.id %> --target-org myOrg

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --source-dir sfdx-source/app

- <%= config.bin %> <%= command.id %> --target-org myOrg --sobject Account

- <%= config.bin %> <%= command.id %> --target-org myOrg --json

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

# info.valid

No issues found across %s binding(s) in %s

# info.scanWideHeader

Scan-wide issues (not limited to the --sobject filter above):

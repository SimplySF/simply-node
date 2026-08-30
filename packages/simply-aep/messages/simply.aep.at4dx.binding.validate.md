# summary

Validate the AT4DX Application Factory bindings configured in an org or local source, failing when a wiring problem is found.

# description

Reads `ApplicationFactory_ServiceBinding__mdt`, `ApplicationFactory_SelectorBinding__mdt`, and `ApplicationFactory_DomainBinding__mdt` — either from a live org or from local Salesforce DX source — and checks them for problems `simply aep at4dx binding list` doesn't fail on: a binding with no resolvable key, a Selector/Domain binding whose SObject reference is ambiguous or names a standard object that can't actually go through an EntityDefinition metadata relationship, two records sharing a platform-unique `To__c`, two Domain records resolving to the same SObject, and the same DeveloperName defined more than once within one binding type. Exactly one of `--target-org` or `--source-dir` must be specified.

`ApplicationFactory_UnitOfWorkBinding__mdt` records are scanned when `--type` includes `unit-of-work` (to keep `--type`'s meaning consistent with `binding list`) but never contribute an issue — every record contributes to one ordered registration list with no possible wiring conflict.

Prints a table of every issue found. Exits non-zero when any issue is an error (a warning alone doesn't fail the command) — use this in CI to gate on AT4DX Application Factory wiring problems before they reach an org.

# flags.target-org.summary

Username or alias of the org to read bindings from. Use this for live-org discovery.

# flags.source-dir.summary

One or more paths to directories containing Salesforce DX source. Use this for local-source discovery.

# flags.type.summary

Binding type(s) to include: service, selector, domain, unit-of-work.

# flags.type.description

Comma-separated list of binding types to include. If not specified, all four are included.

# examples

- <%= config.bin %> <%= command.id %> --target-org myOrg

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --source-dir sfdx-source/app

- <%= config.bin %> <%= command.id %> --target-org myOrg --type service,selector

- <%= config.bin %> <%= command.id %> --target-org myOrg --json

# error.targetOrgOrSourceDirRequired

You must specify either --target-org or --source-dir, but not both.

# error.at4dxNotDetected

AT4DX doesn't appear to be present in this source: none of the requested Application Factory binding Custom Metadata Types were found.

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

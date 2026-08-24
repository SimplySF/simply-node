# summary

List the AT4DX Application Factory bindings configured in an org or local source, resolved to show which record wins for each binding key.

# description

Reads the four AT4DX Application Factory Custom Metadata Types — `ApplicationFactory_ServiceBinding__mdt`, `ApplicationFactory_SelectorBinding__mdt`, `ApplicationFactory_DomainBinding__mdt`, and `ApplicationFactory_UnitOfWorkBinding__mdt` — either from a live org or from local Salesforce DX source, and reproduces the resolution rules AT4DX applies at runtime so you can see which record actually wins for a given interface or SObject, and which ones are shadowed. Exactly one of `--target-org` or `--source-dir` must be specified.

Service and Selector bindings resolve deterministically on `Priority__c` (highest wins). Domain bindings have no priority field, so a duplicated key is flagged `ambiguous` rather than reporting a guessed winner. UnitOfWork bindings have no winner concept at all — every record contributes to one ordered registration list.

# flags.target-org.summary

Username or alias of the org to read bindings from. Use this for live-org discovery.

# flags.source-dir.summary

One or more paths to directories containing Salesforce DX source. Use this for local-source discovery.

# flags.type.summary

Binding type(s) to include: service, selector, domain, unit-of-work.

# flags.type.description

Comma-separated list of binding types to include. If not specified, all four are included.

# flags.effective-only.summary

Only show the bindings that actually win for their key; hide shadowed/non-winning records.

# examples

- <%= config.bin %> <%= command.id %> --target-org myOrg

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --source-dir sfdx-source/app

- <%= config.bin %> <%= command.id %> --target-org myOrg --type service,selector

- <%= config.bin %> <%= command.id %> --target-org myOrg --effective-only --json

# error.targetOrgOrSourceDirRequired

You must specify either --target-org or --source-dir, but not both.

# error.at4dxNotDetected

AT4DX doesn't appear to be present in this source: none of the Application Factory binding Custom Metadata Types were found.

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

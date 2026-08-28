# summary

Deactivate and delete every version of one or more Flows.

# description

Deactivates every active version of each named Flow (so it no longer counts as "active" against Salesforce's restriction on deleting a Flow that still has one), then hard-deletes every version of it via the Tooling API. This is the pre-step a destructive metadata deploy needs before it can remove a Flow.

Flows can be named either via `--manifest`, pointing at a `destructiveChanges.xml`/`package.xml`-shaped file whose `Flow` type members are the flows to delete, or via one or more `--flow-name` flags for scripted or one-off use. Exactly one of the two must be given.

A failure deactivating or deleting one flow doesn't stop the others from being attempted — every failure is collected and reported, and the command exits non-zero if any occurred.

# flags.manifest.summary

Path to a destructiveChanges.xml/package.xml-shaped file

# flags.flow-name.summary

Flow DeveloperName(s) to delete

# examples

- <%= config.bin %> <%= command.id %> --manifest destructive/pre/destructiveChanges.xml --target-org myOrg

- <%= config.bin %> <%= command.id %> --flow-name My_Flow --flow-name Another_Flow --target-org myOrg

- <%= config.bin %> <%= command.id %> --manifest destructive/pre/destructiveChanges.xml --target-org myOrg --json

# error.manifestOrFlowNameRequired

You must specify either --manifest or --flow-name, but not both.

# info.nothingToDelete

No Flow members found; nothing to delete.

# info.deactivating

Deactivating active Flow versions...

# info.deleting

Deleting Flow versions...

# info.summary

Deactivated %s flow(s), deleted %s version(s), %s failure(s).

# summary

Delete obsolete versions of Flows found in local source.

# description

Flows can be named either via one or more `--source-dir` directories, scanned for `*.flow-meta.xml` files, or via one or more `--flow-name` flags for scripted or one-off use. Exactly one of the two must be given. The command then deletes any Tooling API Flow version already `Status = 'Obsolete'` for those flows — keeping an org's Flow version history from accumulating indefinitely. Unlike `simply flow delete`, this never touches an active Flow; it only removes versions the org itself already marked obsolete.

Use `--dry-run` to see what would be deleted without deleting anything.

# flags.source-dir.summary

Directories to scan for *.flow-meta.xml files

# flags.flow-name.summary

Flow DeveloperName(s) to prune obsolete versions for

# flags.dry-run.summary

List obsolete versions without deleting them

# examples

- <%= config.bin %> <%= command.id %> --target-org myOrg --source-dir sfdx-source/core

- <%= config.bin %> <%= command.id %> --target-org myOrg --source-dir sfdx-source/core --dry-run

- <%= config.bin %> <%= command.id %> --target-org myOrg --flow-name My_Flow --flow-name Another_Flow

# error.sourceDirOrFlowNameRequired

You must specify either --source-dir or --flow-name, but not both.

# info.scanningLocalSource

Scanning local source for Flows...

# info.queryingObsoleteVersions

Querying obsolete Flow versions...

# info.deleting

Deleting obsolete Flow versions...

# info.dryRunSummary

Found %s obsolete version(s). Nothing was deleted (--dry-run).

# info.summary

Deleted %s obsolete version(s), %s failure(s).

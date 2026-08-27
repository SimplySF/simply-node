# summary

Delete obsolete versions of Flows found in local source.

# description

Scans one or more source directories for `*.flow-meta.xml` files, then deletes any Tooling API Flow version already `Status = 'Obsolete'` for those flows — keeping an org's Flow version history from accumulating indefinitely. Unlike `simply flow delete`, this never touches an active Flow; it only removes versions the org itself already marked obsolete.

Use `--dry-run` to see what would be deleted without deleting anything.

# flags.source-dir.summary

Directories to scan for *.flow-meta.xml files

# flags.dry-run.summary

List obsolete versions without deleting them

# examples

- <%= config.bin %> <%= command.id %> --target-org myOrg --source-dir sfdx-source/core

- <%= config.bin %> <%= command.id %> --target-org myOrg --source-dir sfdx-source/core --dry-run

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

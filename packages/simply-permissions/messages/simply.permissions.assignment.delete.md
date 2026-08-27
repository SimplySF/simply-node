# summary

Delete PermissionSetAssignments for one or more PermissionSets/PermissionSetGroups.

# description

Deletes every `PermissionSetAssignment` against the named `PermissionSet`s and/or `PermissionSetGroup`s — the pre-step a destructive metadata deploy of the permission set/group itself needs, so it doesn't fail or leave orphaned assignments behind.

Targets can be named either via `--file`, pointing at a `destructiveChanges.xml`/`package.xml`-shaped file whose `PermissionSet`/`PermissionSetGroup` type members are the targets, or via `--permission-set-name`/`--permission-set-group-name` flags (which may be combined with each other) for scripted or one-off use. `--file` is mutually exclusive with the two explicit-name flags.

# flags.file.summary

Path to a destructiveChanges.xml/package.xml-shaped file

# flags.permission-set-name.summary

PermissionSet Name(s) to delete assignments for

# flags.permission-set-group-name.summary

PermissionSetGroup DeveloperName(s) to delete assignments for

# examples

- <%= config.bin %> <%= command.id %> --file destructive/pre/destructiveChanges.xml --target-org myOrg

- <%= config.bin %> <%= command.id %> --permission-set-name My_Permission_Set --target-org myOrg

- <%= config.bin %> <%= command.id %> --permission-set-group-name My_Permission_Set_Group --target-org myOrg

# error.fileOrNameFlagsRequired

You must specify either --file, or --permission-set-name/--permission-set-group-name, but not both.

# info.nothingToDelete

No matching PermissionSetAssignments found; nothing to delete.

# info.queryingAssignments

Querying PermissionSetAssignments...

# info.deleting

Deleting PermissionSetAssignments...

# info.summary

Deleted %s assignment(s), %s failure(s).

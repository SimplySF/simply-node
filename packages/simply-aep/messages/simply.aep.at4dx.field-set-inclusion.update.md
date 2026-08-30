# summary

Update an existing AT4DX Selector field set inclusion (SelectorConfig_FieldSetInclusion__mdt) in local source and/or a connected org.

# description

Finds the field set inclusion named --developer-name in local source and/or a connected org, applies only the fields given as flags — everything else, including which SObject reference field it uses, is preserved from the found record — and rewrites its `.md-meta.xml` file. Validates the resulting record — alongside everything else already in scope — with the same rules `simply aep at4dx field-set-inclusion validate` uses, and refuses to write if that introduces an error-severity issue unless --force is passed.

When --source-dir is given, the record is located there (searched across every directory given, same as `list`/`validate`) and that exact file is rewritten; the found file is also deployed if --target-org is given. When only --target-org is given, the record is located and updated directly in the org via a temporary file, deployed, then discarded — no working-tree footprint.

--developer-name identifies the record to update and can't itself be changed by this command.

# flags.source-dir.summary

One or more paths to directories containing Salesforce DX source, searched for the record to update.

# flags.target-org.summary

Locate (when --source-dir isn't given) and/or deploy the record to this org.

# flags.wait.summary

Deploy poll timeout, in minutes. Only meaningful with --target-org.

# flags.developer-name.summary

The DeveloperName of the record to update.

# flags.label.summary

The record's label. If not given, the existing label is kept.

# flags.sobject.summary

The SObject API name to bind the field set to. If not given, the existing value is kept.

# flags.sobject-alternate.summary

Write --sobject to BindingSObjectAlternate__c instead of BindingSObject__c, for a SObject that can't be referenced through an EntityDefinition field at all (for example ServiceResource and other Setup objects). If not given, the record keeps whichever field it already uses — this flag only needs to be passed to change it.

# flags.fieldset-name.summary

FieldsetName__c — the field set to add to the selector's queried field list. Changing it changes which field set is included. If not given, the existing value is kept.

# flags.active.summary

IsActive__c. If not given, the existing value is kept. Pass --no-active to deactivate.

# flags.force.summary

Write (and deploy) even if validation finds an error-severity issue. Validation still runs and its issues are still printed and returned.

# examples

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --source-dir sfdx-source/app --developer-name Account_Contact_Fields --no-active

- <%= config.bin %> <%= command.id %> --target-org myOrg --developer-name Account_Contact_Fields --fieldset-name ContactRelatedFieldsV2

# error.sourceDirOrTargetOrgRequired

You must specify at least one of --source-dir or --target-org.

# error.invalidDeveloperName

%s

# error.labelTooLong

%s

# error.developerNameAlreadyExists

%s

# error.developerNameNotFound

%s

# error.noFieldsToUpdate

At least one field besides --developer-name must be given to update.

# error.at4dxNotDetected

%s

# error.validationFailed

Writing this record would introduce a wiring problem AT4DX validation already knows how to catch. Pass --force to write anyway.

# error.deployFailed

%s

# info.updated

Updated %s

# info.updatedInOrg

Updated %s in the org

# info.deployed

Deployed (id: %s)

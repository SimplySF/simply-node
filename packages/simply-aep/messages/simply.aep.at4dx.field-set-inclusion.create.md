# summary

Create a new AT4DX Selector field set inclusion (SelectorConfig_FieldSetInclusion__mdt) in local source and/or a connected org.

# description

Generates a `SelectorConfig_FieldSetInclusion.<DeveloperName>.md-meta.xml` file from the given flags and writes it under --source-dir, deploys it to --target-org, or both. Validates the resulting record — alongside everything else already in scope — with the same rules `simply aep at4dx field-set-inclusion validate` uses, and refuses to write if that introduces an error-severity issue unless --force is passed. At least one of --source-dir/--target-org is required; both may be given at once (write to source and deploy it live in the same run). Given --target-org alone, the file is written to a temporary directory, deployed, and discarded — no working-tree footprint.

--sobject writes BindingSObject__c by default (pass --sobject-alternate to write BindingSObjectAlternate__c instead, for a SObject — such as ServiceResource and other Setup objects — that can't be referenced through an EntityDefinition field at all).

# flags.source-dir.summary

The package directory to create the field set inclusion's .md-meta.xml under. Created if the customMetadata folder doesn't exist yet.

# flags.target-org.summary

Deploy the generated field set inclusion to this org after writing it.

# flags.wait.summary

Deploy poll timeout, in minutes. Only meaningful with --target-org.

# flags.developer-name.summary

The record's DeveloperName. Must start with a letter, contain only letters, numbers, and single underscores, not end with an underscore, and be 40 characters or fewer.

# flags.label.summary

The record's label. Defaults to --developer-name. Must be 40 characters or fewer.

# flags.sobject.summary

The SObject API name to bind the field set to (BindingSObject__c, or BindingSObjectAlternate__c with --sobject-alternate).

# flags.sobject-alternate.summary

Write --sobject to BindingSObjectAlternate__c instead of BindingSObject__c. Use this for a SObject that can't be referenced through an EntityDefinition field at all (for example ServiceResource and other Setup objects).

# flags.fieldset-name.summary

FieldsetName__c — the field set to add to the selector's queried field list. Unique org-wide across every SObject, not per-SObject.

# flags.active.summary

IsActive__c. Defaults to true, matching the Custom Metadata Type's own default. Pass --no-active to create it inactive.

# flags.force.summary

Write (and deploy) even if validation finds an error-severity issue. Validation still runs and its issues are still printed and returned.

# examples

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --developer-name Account_Contact_Fields --sobject Account --fieldset-name ContactRelatedFields

- <%= config.bin %> <%= command.id %> --target-org myOrg --developer-name ServiceResource_Skills --sobject ServiceResource --sobject-alternate --fieldset-name SkillFields

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

# info.created

Created %s

# info.createdInOrg

Created %s in the org

# info.deployed

Deployed (id: %s)

# summary

Update an existing AT4DX Application Factory binding (Service, Selector, or Domain) in local source and/or a connected org.

# description

Finds the binding named --developer-name (of the given --type) in local source and/or a connected org, applies only the fields given as flags — everything else, including which SObject reference field a Selector/Domain binding uses, is preserved from the found record — and rewrites its `.md-meta.xml` file. Validates the resulting binding — alongside everything else of the same --type already in scope — with the same rules `simply aep at4dx binding validate` uses, and refuses to write if that introduces an error-severity issue unless --force is passed.

When --source-dir is given, the binding is located there (searched across every directory given, same as `list`/`validate`) and that exact file is rewritten; the found file is also deployed if --target-org is given. When only --target-org is given, the binding is located and updated directly in the org via a temporary file, deployed, then discarded — no working-tree footprint.

--developer-name identifies the binding to update and can't itself be changed by this command. --type identifies which Application Factory Custom Metadata Type to look in and can't be changed either — bindings don't move between types.

# flags.source-dir.summary

One or more paths to directories containing Salesforce DX source, searched for the binding to update.

# flags.target-org.summary

Locate (when --source-dir isn't given) and/or deploy the binding to this org.

# flags.wait.summary

Deploy poll timeout, in minutes. Only meaningful with --target-org.

# flags.type.summary

Which Application Factory binding type to look in: service, selector, or domain.

# flags.developer-name.summary

The DeveloperName of the binding to update.

# flags.label.summary

The binding's label. If not given, the existing label is kept.

# flags.to.summary

The interface/SObject's implementing Apex class (To__c). If not given, the existing value is kept.

# flags.binding-interface.summary

BindingInterface__c — the Apex interface this binding maps to. Only allowed when --type is service. If not given, the existing value is kept.

# flags.sobject.summary

The SObject API name to bind against. Only allowed when --type is selector or domain. If not given, the existing value is kept.

# flags.sobject-alternate.summary

Write --sobject to BindingSObjectAlternate__c instead of BindingSObject__c, for a SObject that can't be referenced through an EntityDefinition field at all (for example ServiceResource and other Setup objects). Only allowed when --type is selector or domain. If not given, the binding keeps whichever field it already uses — this flag only needs to be passed to change it.

# flags.priority.summary

Priority__c. Only allowed when --type is service or selector — Domain has no Priority__c field. If not given, the existing value is kept.

# flags.force.summary

Write (and deploy) even if validation finds an error-severity issue. Validation still runs and its issues are still printed and returned.

# examples

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --source-dir sfdx-source/app --type selector --developer-name Account_Selector --priority 5

- <%= config.bin %> <%= command.id %> --target-org myOrg --type domain --developer-name Account_Domain --to AccountDomainV2

# error.sourceDirOrTargetOrgRequired

You must specify at least one of --source-dir or --target-org.

# error.invalidPriority

"%s" is not a valid --priority: it must be a number.

# error.typeFieldMismatch

%s

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

Writing this binding would introduce a wiring problem AT4DX validation already knows how to catch. Pass --force to write anyway.

# error.deployFailed

%s

# info.updated

Updated %s

# info.updatedInOrg

Updated %s in the org

# info.deployed

Deployed (id: %s)

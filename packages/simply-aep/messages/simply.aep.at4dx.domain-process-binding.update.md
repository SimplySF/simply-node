# summary

Update an existing AT4DX Trigger Action Framework binding (DomainProcessBinding__mdt) in local source and/or a connected org.

# description

Finds the binding named --developer-name in local source and/or a connected org, applies only the fields given as flags — everything else, including which SObject reference field the binding uses, is preserved from the found record — and rewrites the `DomainProcessBinding.<DeveloperName>.md-meta.xml` file. Validates the resulting binding — alongside everything else already in scope — with the same rules `simply aep at4dx domain-process-binding validate` uses, and refuses to write if that introduces an error-severity issue unless --force is passed.

When --source-dir is given, the binding is located there (searched across every directory given, same as `list`/`validate`) and that exact file is rewritten; the found file is also deployed if --target-org is given. When only --target-org is given, the binding is located and updated directly in the org via a temporary file, deployed, then discarded — no working-tree footprint.

--developer-name identifies the binding to update and can't itself be changed by this command.

# flags.source-dir.summary

One or more paths to directories containing Salesforce DX source, searched for the binding to update.

# flags.target-org.summary

Locate (when --source-dir isn't given) and/or deploy the binding to this org.

# flags.wait.summary

Deploy poll timeout, in minutes. Only meaningful with --target-org.

# flags.developer-name.summary

The DeveloperName of the binding to update.

# flags.label.summary

The binding's label. If not given, the existing label is kept.

# flags.sobject.summary

The SObject API name to bind against. If not given, the existing value is kept.

# flags.sobject-alternate.summary

Write --sobject to RelatedDomainBindingSObjectAlternate__c instead of RelatedDomainBindingSObject__c, for a SObject that can't be referenced through an EntityDefinition field at all (for example ServiceResource and other Setup objects). If not given, the binding keeps whichever field it already uses — this flag only needs to be passed to change it.

# flags.process-context.summary

What kind of process invokes this binding: TriggerExecution or DomainMethodExecution. If not given, the existing value is kept.

# flags.trigger-operation.summary

The trigger event this binding fires on. If you change --process-context to TriggerExecution, pass this too.

# flags.domain-method-token.summary

The domain method's process token this binding matches. If you change --process-context to DomainMethodExecution, pass this too.

# flags.type.summary

Whether this binding contributes a Criteria filter or an Action. If not given, the existing value is kept.

# flags.class-to-inject.summary

The Apex class this binding wires in. If not given, the existing value is kept.

# flags.order.summary

OrderOfExecution__c. Numeric; decimals are allowed. If not given, the existing value is kept.

# flags.active.summary

IsActive__c. If not given, the existing value is kept.

# flags.execute-asynchronous.summary

ExecuteAsynchronous__c. If not given, the existing value is kept.

# flags.logical-inverse.summary

LogicalInverse__c. If not given, the existing value is kept.

# flags.prevent-recursive.summary

PreventRecursive__c. If not given, the existing value is kept.

# flags.description.summary

Description__c. If not given, the existing value is kept.

# flags.force.summary

Write (and deploy) even if validation finds an error-severity issue. Validation still runs and its issues are still printed and returned.

# examples

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --source-dir sfdx-source/app --developer-name Account_Before_Insert_Assign_Owner --order 20 --no-active

- <%= config.bin %> <%= command.id %> --target-org myOrg --developer-name Account_Before_Insert_Assign_Owner --class-to-inject AccountAssignOwnerActionV2

# error.sourceDirOrTargetOrgRequired

You must specify at least one of --source-dir or --target-org.

# error.invalidOrder

"%s" is not a valid --order: it must be a number.

# error.contextFieldMismatch

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

AT4DX's Trigger Action Framework doesn't appear to be present in this source or org: the DomainProcessBinding__mdt Custom Metadata Type wasn't found.

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

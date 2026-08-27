# summary

Create a new AT4DX Trigger Action Framework binding (DomainProcessBinding__mdt) in local source and/or a connected org.

# description

Generates a `DomainProcessBinding.<DeveloperName>.md-meta.xml` file from the given flags and writes it under --source-dir, deploys it to --target-org, or both. Validates the resulting binding — alongside everything else already in scope — with the same rules `simply aep at4dx domain-process-binding validate` uses, and refuses to write if that introduces an error-severity issue unless --force is passed. At least one of --source-dir/--target-org is required; unlike `list`/`validate`, both may be given at once (write to source and deploy it live in the same run). Given --target-org alone, the file is written to a temporary directory, deployed, and discarded — no working-tree footprint.

Writes RelatedDomainBindingSObject__c by default. Pass --sobject-alternate to write RelatedDomainBindingSObjectAlternate__c instead, for a SObject (such as ServiceResource and other Setup objects) that can't be referenced through an EntityDefinition field at all.

# flags.source-dir.summary

The package directory to create customMetadata/DomainProcessBinding.<name>.md-meta.xml under. Created if the customMetadata folder doesn't exist yet.

# flags.target-org.summary

Deploy the generated binding to this org after writing it.

# flags.wait.summary

Deploy poll timeout, in minutes. Only meaningful with --target-org.

# flags.developer-name.summary

The binding's DeveloperName. Must start with a letter, contain only letters, numbers, and single underscores, not end with an underscore, and be 40 characters or fewer.

# flags.label.summary

The binding's label. Defaults to --developer-name. Must be 40 characters or fewer.

# flags.sobject.summary

The SObject API name to bind against.

# flags.sobject-alternate.summary

Write --sobject to RelatedDomainBindingSObjectAlternate__c instead of RelatedDomainBindingSObject__c. Use this for a SObject that can't be referenced through an EntityDefinition field at all (for example ServiceResource and other Setup objects).

# flags.process-context.summary

What kind of process invokes this binding: TriggerExecution or DomainMethodExecution.

# flags.trigger-operation.summary

The trigger event this binding fires on. Required, and only allowed, when --process-context is TriggerExecution.

# flags.domain-method-token.summary

The domain method's process token this binding matches. Required, and only allowed, when --process-context is DomainMethodExecution.

# flags.type.summary

Whether this binding contributes a Criteria filter or an Action.

# flags.class-to-inject.summary

The Apex class this binding wires in.

# flags.order.summary

OrderOfExecution__c. Numeric; decimals are allowed.

# flags.active.summary

IsActive__c.

# flags.execute-asynchronous.summary

ExecuteAsynchronous__c.

# flags.logical-inverse.summary

LogicalInverse__c.

# flags.prevent-recursive.summary

PreventRecursive__c.

# flags.description.summary

Description__c.

# flags.force.summary

Write (and deploy) even if validation finds an error-severity issue. Validation still runs and its issues are still printed and returned.

# examples

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --developer-name Account_Before_Insert_Assign_Owner --sobject Account --process-context TriggerExecution --trigger-operation Before_Insert --type Action --class-to-inject AccountAssignOwnerAction --order 10

- <%= config.bin %> <%= command.id %> --target-org myOrg --developer-name Account_Before_Insert_Assign_Owner --sobject Account --process-context TriggerExecution --trigger-operation Before_Insert --type Action --class-to-inject AccountAssignOwnerAction --order 10

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --target-org myOrg --developer-name Account_Before_Insert_Assign_Owner --sobject Account --process-context TriggerExecution --trigger-operation Before_Insert --type Action --class-to-inject AccountAssignOwnerAction --order 10

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --developer-name ServiceResource_Before_Update_Sync --sobject ServiceResource --sobject-alternate --process-context TriggerExecution --trigger-operation Before_Update --type Action --class-to-inject ServiceResourceSyncAction --order 10

# error.sourceDirOrTargetOrgRequired

You must specify at least one of --source-dir or --target-org.

# error.triggerOperationRequired

--trigger-operation is required when --process-context is TriggerExecution.

# error.domainMethodTokenRequired

--domain-method-token is required when --process-context is DomainMethodExecution.

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

AT4DX's Trigger Action Framework doesn't appear to be present in this org: the DomainProcessBinding__mdt Custom Metadata Type wasn't found.

# error.validationFailed

Writing this binding would introduce a wiring problem AT4DX validation already knows how to catch. Pass --force to write anyway.

# error.deployFailed

%s

# info.created

Created %s

# info.createdInOrg

Created %s in the org

# info.deployed

Deployed (id: %s)

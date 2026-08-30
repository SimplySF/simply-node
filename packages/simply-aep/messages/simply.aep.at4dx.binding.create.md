# summary

Create a new AT4DX Application Factory binding (Service, Selector, Domain, or UnitOfWork) in local source and/or a connected org.

# description

Generates a `<LocalObjectName>.<DeveloperName>.md-meta.xml` file from the given flags and writes it under --source-dir, deploys it to --target-org, or both. Validates the resulting binding — alongside everything else of the same --type already in scope — with the same rules `simply aep at4dx binding validate` uses, and refuses to write if that introduces an error-severity issue unless --force is passed. At least one of --source-dir/--target-org is required; both may be given at once (write to source and deploy it live in the same run). Given --target-org alone, the file is written to a temporary directory, deployed, and discarded — no working-tree footprint.

`--type service` uses --binding-interface (BindingInterface__c) and rejects --sobject/--sobject-alternate; `--type selector`/`domain`/`unit-of-work` use --sobject and write it to BindingSObject__c by default (pass --sobject-alternate to write BindingSObjectAlternate__c instead, for a SObject — such as ServiceResource and other Setup objects — that can't be referenced through an EntityDefinition field at all). `--to` is required for `--type service`/`selector`/`domain` and rejected for `--type unit-of-work`, which has no To__c field at all. `--priority` is accepted for `--type service`/`selector` only; Domain and UnitOfWork have no such field. `--sequence` (BindingSequence__c) is accepted for `--type unit-of-work` only.

# flags.source-dir.summary

The package directory to create the binding's .md-meta.xml under. Created if the customMetadata folder doesn't exist yet.

# flags.target-org.summary

Deploy the generated binding to this org after writing it.

# flags.wait.summary

Deploy poll timeout, in minutes. Only meaningful with --target-org.

# flags.type.summary

Which Application Factory binding type to create: service, selector, domain, or unit-of-work.

# flags.developer-name.summary

The binding's DeveloperName. Must start with a letter, contain only letters, numbers, and single underscores, not end with an underscore, and be 40 characters or fewer.

# flags.label.summary

The binding's label. Defaults to --developer-name. Must be 40 characters or fewer.

# flags.to.summary

The interface/SObject's implementing Apex class (To__c). Required, and only allowed, when --type is service, selector, or domain — UnitOfWork has no To__c field.

# flags.binding-interface.summary

BindingInterface__c — the Apex interface this binding maps to. Required, and only allowed, when --type is service.

# flags.sobject.summary

The SObject API name to bind against (BindingSObject__c, or BindingSObjectAlternate__c with --sobject-alternate). Required, and only allowed, when --type is selector, domain, or unit-of-work.

# flags.sobject-alternate.summary

Write --sobject to BindingSObjectAlternate__c instead of BindingSObject__c. Use this for a SObject that can't be referenced through an EntityDefinition field at all (for example ServiceResource and other Setup objects). Only allowed when --type is selector, domain, or unit-of-work.

# flags.priority.summary

Priority__c. Higher numbers are higher priority; omit for least priority. Only allowed when --type is service or selector — Domain and UnitOfWork have no Priority__c field.

# flags.sequence.summary

BindingSequence__c — where this SObject falls in the Unit of Work's commit order (lower runs first). Only allowed when --type is unit-of-work.

# flags.force.summary

Write (and deploy) even if validation finds an error-severity issue. Validation still runs and its issues are still printed and returned.

# examples

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --type service --developer-name My_Service_Binding --binding-interface IMyService --to MyServiceImpl

- <%= config.bin %> <%= command.id %> --target-org myOrg --type selector --developer-name Account_Selector --sobject Account --to AccountsSelector --priority 1

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --type domain --developer-name Account_Domain --sobject Account --to AccountDomain

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --type selector --developer-name ServiceResource_Selector --sobject ServiceResource --sobject-alternate --to ServiceResourceSelector

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --type unit-of-work --developer-name Account_UOW --sobject Account --sequence 10

# error.sourceDirOrTargetOrgRequired

You must specify at least one of --source-dir or --target-org.

# error.invalidPriority

"%s" is not a valid --priority: it must be a number.

# error.invalidSequence

"%s" is not a valid --sequence: it must be a number.

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

# info.created

Created %s

# info.createdInOrg

Created %s in the org

# info.deployed

Deployed (id: %s)

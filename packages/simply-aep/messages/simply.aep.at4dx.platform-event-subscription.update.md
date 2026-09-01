# summary

Update an existing AT4DX Platform Event Distributor subscription (PlatformEvents_Subscription__mdt) in local source and/or a connected org.

# description

Finds the platform event subscription named --developer-name in local source and/or a connected org, applies only the fields given as flags — everything else is preserved from the found record — and rewrites its `.md-meta.xml` file. Validates the resulting record — alongside everything else already in scope — with the same rules `simply aep at4dx platform-event-subscription validate` uses, and refuses to write if that introduces an error-severity issue unless --force is passed.

When --source-dir is given, the record is located there (searched across every directory given, same as `list`/`validate`) and that exact file is rewritten; the found file is also deployed if --target-org is given. When only --target-org is given, the record is located and updated directly in the org via a temporary file, deployed, then discarded — no working-tree footprint.

--developer-name identifies the record to update and can't itself be changed by this command. --consumer, unlike --developer-name, is an ordinary field on this record — changing it is a plain value update, not a delete-and-recreate, even though it reads as the subscription's identity in most tooling.

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

# flags.event-bus.summary

EventBus__c. If not given, the existing value is kept.

# flags.consumer.summary

Consumer__c. If not given, the existing value is kept. Unique org-wide across every subscription.

# flags.matcher-rule.summary

MatcherRule__c — which of --event-category/--event-name the distributor's matcher dereferences for this subscription. If not given, the existing value is kept.

# flags.event-category.summary

EventCategory__c. If not given, the existing value is kept. Required when the record's MatcherRule__c is MatchCategory or MatchCategoryAndEvent — leaving it blank for those raises matcher-rule-missing-field.

# flags.event-name.summary

Event__c. If not given, the existing value is kept. Required when the record's MatcherRule__c is MatchEvent or MatchCategoryAndEvent — leaving it blank for those raises matcher-rule-missing-field.

# flags.active.summary

IsActive__c. If not given, the existing value is kept. Pass --no-active to deactivate.

# flags.synchronous.summary

Execute_Synchronous__c. If not given, the existing value is kept. Pass --no-synchronous to have the distributor invoke this consumer asynchronously.

# flags.force.summary

Write (and deploy) even if validation finds an error-severity issue. Validation still runs and its issues are still printed and returned.

# examples

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --developer-name Account_Change_Subscriber --no-active

- <%= config.bin %> <%= command.id %> --target-org myOrg --developer-name Account_Change_Subscriber --consumer AccountChangeConsumerV2

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

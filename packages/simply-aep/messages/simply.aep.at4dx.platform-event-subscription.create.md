# summary

Create a new AT4DX Platform Event Distributor subscription (PlatformEvents_Subscription__mdt) in local source and/or a connected org.

# description

Generates a `PlatformEvents_Subscription.<DeveloperName>.md-meta.xml` file from the given flags and writes it under --source-dir, deploys it to --target-org, or both. Validates the resulting record — alongside everything else already in scope — with the same rules `simply aep at4dx platform-event-subscription validate` uses, and refuses to write if that introduces an error-severity issue unless --force is passed. At least one of --source-dir/--target-org is required; both may be given at once (write to source and deploy it live in the same run). Given --target-org alone, the file is written to a temporary directory, deployed, and discarded — no working-tree footprint.

--matcher-rule controls which of --event-category/--event-name the distributor's matcher dereferences for this subscription: MatchEventBus dereferences neither (the whole bus matches, once a category or event name gets it past the distributor's pre-filter — see `simply aep at4dx platform-event-subscription validate`'s unreachable-subscription rule for why at least one should usually be set anyway), MatchCategory requires --event-category, MatchEvent requires --event-name, and MatchCategoryAndEvent requires both. Leaving the field a MatcherRule needs blank is exactly the matcher-rule-missing-field hazard validation catches — see that command's description for why it matters at runtime.

# flags.source-dir.summary

The package directory to create the platform event subscription's .md-meta.xml under. Created if the customMetadata folder doesn't exist yet.

# flags.target-org.summary

Deploy the generated platform event subscription to this org after writing it.

# flags.wait.summary

Deploy poll timeout, in minutes. Only meaningful with --target-org.

# flags.developer-name.summary

The record's DeveloperName. Must start with a letter, contain only letters, numbers, and single underscores, not end with an underscore, and be 40 characters or fewer.

# flags.label.summary

The record's label. Defaults to --developer-name. Must be 40 characters or fewer.

# flags.event-bus.summary

EventBus__c — the platform event object API name this subscription registers against, e.g. My_Event__e.

# flags.consumer.summary

Consumer__c — the IEventsConsumer-implementing Apex class name. Unique org-wide across every subscription.

# flags.matcher-rule.summary

MatcherRule__c — which of --event-category/--event-name the distributor's matcher dereferences for this subscription. One of MatchEventBus, MatchCategory, MatchEvent, MatchCategoryAndEvent.

# flags.event-category.summary

EventCategory__c. Required when --matcher-rule is MatchCategory or MatchCategoryAndEvent — leaving it blank for those raises matcher-rule-missing-field.

# flags.event-name.summary

Event__c. Required when --matcher-rule is MatchEvent or MatchCategoryAndEvent — leaving it blank for those raises matcher-rule-missing-field.

# flags.active.summary

IsActive__c. Defaults to true, matching the Custom Metadata Type's own default. Pass --no-active to create it inactive.

# flags.synchronous.summary

Execute_Synchronous__c. Defaults to false. Pass --synchronous to have the distributor invoke this consumer synchronously.

# flags.force.summary

Write (and deploy) even if validation finds an error-severity issue. Validation still runs and its issues are still printed and returned.

# examples

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --developer-name Account_Change_Subscriber --event-bus Account_Change__e --consumer AccountChangeConsumer --matcher-rule MatchCategory --event-category Finance

- <%= config.bin %> <%= command.id %> --target-org myOrg --developer-name Account_Change_Subscriber --event-bus Account_Change__e --consumer AccountChangeConsumer --matcher-rule MatchCategoryAndEvent --event-category Finance --event-name AccountUpdated

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

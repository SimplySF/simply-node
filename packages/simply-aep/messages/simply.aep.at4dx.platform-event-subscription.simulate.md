# summary

Simulate the AT4DX Platform Event Distributor's consumer resolution for a hypothetical event, and show which subscriptions would receive it and why the rest wouldn't.

# description

Reads `PlatformEvents_Subscription__mdt` — either from a live org or from local Salesforce DX source — and reimplements `PlatformEventDistributor`'s decision sequence against a hypothetical event you describe with `--event-bus`, `--category`, and `--event-name`: restrict to subscriptions on that bus, drop inactive records the distributor's own query never loads, apply `triggerHandler`'s pre-filter, then each record's `MatcherRule__c` branch. Exactly one of `--target-org` or `--source-dir` must be specified.

Prints the exact consumer set the distributor would build, in order, tagged synchronous or asynchronous from `Execute_Synchronous__c`, plus every subscription on that bus that would _not_ receive the event and the structured reason why: `inactive`, `prefiltered` (the pre-filter rejected it before any matcher rule ran), `matcher-rule-missing-field` (the matcher rule dereferences a blank match field — a real NullPointerException in the org), or `no-match` (every field the matcher rule needs is present, but the values don't match this event).

This is the same evaluation `simply aep at4dx platform-event-subscription validate` uses to derive `matcher-rule-missing-field` and `unreachable-subscription` — running it here against a concrete hypothetical event is how you confirm a subscription actually receives what you expect it to, beyond what `validate`'s static checks can tell you.

# flags.target-org.summary

Username or alias of the org to read platform event subscriptions from. Use this for live-org discovery.

# flags.source-dir.summary

One or more paths to directories containing Salesforce DX source. Use this for local-source discovery.

# flags.event-bus.summary

The platform event object API name (EventBus__c) of the hypothetical event to simulate, e.g. My_Event__e.

# flags.category.summary

The hypothetical event's Category__c value. Omit to simulate an event with no category.

# flags.event-name.summary

The hypothetical event's EventName__c value. Omit to simulate an event with no event name.

# examples

- <%= config.bin %> <%= command.id %> --target-org myOrg --event-bus Account_Change__e --category Finance --event-name AccountUpdated

- <%= config.bin %> <%= command.id %> --source-dir sfdx-source/core --event-bus Account_Change__e --event-name AccountUpdated

- <%= config.bin %> <%= command.id %> --target-org myOrg --event-bus Account_Change__e --json

# error.targetOrgOrSourceDirRequired

You must specify either --target-org or --source-dir, but not both.

# error.at4dxNotDetected

AT4DX doesn't appear to be present in this source: the PlatformEvents_Subscription__mdt Custom Metadata Type wasn't found.

# error.localScanFailed

Failed to scan the project directory: %s

# error.orgQueryFailed

Failed to query platform event subscriptions from the org: %s

# info.queryingOrg

Querying platform event subscriptions from %s...

# info.scanningLocalSource

Scanning local source for platform event subscriptions...

# info.noMatches

No subscription would receive this event.

# header.matches

Matched consumers

# header.misses

Non-matching subscriptions

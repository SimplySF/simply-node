# 0025 — AT4DX Platform Event Subscription support

**Status:** Draft
**Package:** `packages/simply-aep-core`, `packages/simply-aep`
**Date:** 2026-09-01

> Drafted from exploratory work in a Claude Design canvas ("AT4DX Bindings Redesign"), not written
> directly against this repo. Two things that follow from that, called out once here rather than
> silently: (1) the canvas's own visual mockups (referred to below as "cards") aren't reproduced in
> this doc — every behavior they informed is instead spelled out in prose, so this doc should be
> self-contained without them; (2) a few artifacts the canvas's own material refers to —
> `HANDOFF-05-platform-event-cli.md`, `SPEC-CONVENTIONS.md`, and a `simply-vscode` repo's design doc
> `0014` — live outside `simply-node` and aren't available to check against. Where those would have
> supplied exact wording or file-by-file mechanics, this doc says so explicitly instead of citing a
> path nobody here can open. See Open questions.

## Problem

`simply-aep-core` covers three AT4DX metadata families: Application Factory bindings
(`at4dxBindingTypes.ts` et al), Domain Process bindings, and Selector field set inclusions.
`PlatformEvents_Subscription__mdt` — the Platform Event Distributor's registration table — has no
support at all: no scan, no validate, no write, and no resolution.

That gap matters more than the other three did, because of how `PlatformEventDistributor` fails.

**Failures are silent by construction.** Consumer construction sits inside a `try`/`catch` whose entire
handler is three `System.debug` calls:

```apex
catch (Exception ex)
{
    System.debug( ex );
    System.debug( subscriptionRecord );
    System.debug( eventBatchForSubscriber );
}
```

A subscription that names a missing class, or a class that doesn't implement `IEventsConsumer`, is
indistinguishable at runtime from one that never matched. Nothing surfaces in the org.

**Two hazard classes are unpreventable by schema.** `MatcherRule__c` is required and restricted to four
values. `EventCategory__c` and `Event__c` are both optional. Three of the four rules dereference one or
both of those optional fields with no null guard:

```apex
&& subscriptionRecord.EventCategory__c.equalsIgnoreCase( (String)event.get( CATEGORY_FIELD_NAME ) )
&& subscriptionRecord.Event__c.equalsIgnoreCase( (String)event.get( EVENT_NAME_FIELD_NAME ) )
```

So a record that passes every platform validation still throws a `NullPointerException` for every event
published on its bus. No Salesforce-side validation rule can catch it — the constraint is a
relationship between a picklist value and two unrelated optional fields.

**One hazard class is invisible to any per-record check.** Before the matcher runs, `triggerHandler`
pre-filters the subscription list:

```apex
if (eventCategorySet.contains(platformEventSubscription.EventCategory__c) || eventNameSet.contains(platformEventSubscription.Event__c))
```

A `MatchEventBus` record — the rule that means "give me everything on this bus" — with both match
fields blank can never satisfy that condition. It is a legal, active, correctly-authored record that
provably never receives an event. Only a tool that models the pre-filter can tell the author.

**And one failure takes down everything.** `PlatformEventDistributorDIModule.configure()` throws
`ModuleException` on the first record with a blank `EventBus__c` or `Consumer__c`. Not that record —
the whole DI module. Every subscription in the org stops resolving.

## Decision

Add a fourth metadata family to `simply-aep-core`, following the file/type/rule-table pattern the
existing three already share, plus one capability none of them have: a distribution _simulator_.

### The family

Six new modules, named on the `FieldSetInclusion` precedent (family token
`PlatformEventSubscription`):

| Module                                       | Mirrors                              | Exports                                                                                                   |
| -------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `at4dxPlatformEventSubscriptionTypes.ts`     | `at4dxFieldSetInclusionTypes.ts`     | constants, record/issue types, `PLATFORM_EVENT_SUBSCRIPTION_RULES`, `PlatformEventSubscriptionWriteError` |
| `at4dxPlatformEventSubscriptionLocalScan.ts` | `at4dxFieldSetInclusionLocalScan.ts` | `scanLocalPlatformEventSubscriptions`                                                                     |
| `at4dxPlatformEventSubscriptionOrgScan.ts`   | `at4dxFieldSetInclusionOrgScan.ts`   | `scanOrgPlatformEventSubscriptions`                                                                       |
| `at4dxPlatformEventSubscriptionResolve.ts`   | `at4dxFieldSetInclusionResolve.ts`   | `validatePlatformEventSubscriptions`, `resolvePlatformEventDistribution`                                  |
| `at4dxPlatformEventSubscriptionBuildXml.ts`  | `at4dxFieldSetInclusionBuildXml.ts`  | `buildPlatformEventSubscriptionXml`                                                                       |
| `at4dxPlatformEventSubscriptionWrite.ts`     | `at4dxFieldSetInclusionWrite.ts`     | `createPlatformEventSubscription`, `updatePlatformEventSubscription`                                      |

### The simulator is the reason this family is worth building

`resolvePlatformEventDistribution(input, records)` takes a hypothetical event — bus, `Category__c`,
`EventName__c` — and returns the exact consumer set `PlatformEventDistributor` would build, in order,
each tagged sync or async, plus every subscription that did _not_ match and the structured reason it
missed.

This is the CLI analogue of `resolveBindings`. It reimplements the distributor's decision sequence —
pre-filter, then rule branch — as a pure function over scanned records. No org round-trip: everything
it needs is in the metadata plus the event bus's field list.

The simulator is also how `matcher-rule-missing-field` and `unreachable-subscription` get their
authority. Both rules are statements about what the distributor will do; deriving them from the same
code path that answers "what would happen to this event" keeps them from drifting apart.

### Rules

Six:

| Rule id                         | Severity | Scope  | Detects                                                                                                            |
| ------------------------------- | -------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `missing-event-bus-or-consumer` | error    | record | Blank `EventBus__c` or `Consumer__c` — `configure()` throws `ModuleException` and the entire DI module fails       |
| `matcher-rule-missing-field`    | error    | record | The record's `MatcherRule__c` dereferences a match field that is blank — runtime `NullPointerException` per event  |
| `unreachable-subscription`      | warning  | record | Legal and active, but the distributor's pre-filter can never admit it                                              |
| `non-conforming-event-bus`      | error    | record | The bus is missing `Category__c` and/or `EventName__c` — `PlatformEventDistributorException` for every event on it |
| `duplicate-consumer`            | error    | scan   | Two records share a `Consumer__c` — the field is `unique` on this CMDT, so both cannot deploy                      |
| `duplicate-developer-name`      | error    | scan   | Standard across all four families                                                                                  |

`IsActive__c = FALSE` is deliberately **not** a rule. The module's static SOQL filters it out, so an
inactive record is inert rather than wrong — it belongs in `list` output as a status rather than a
validation finding (a dimmed row with a derived status, no checkbox).

### What makes this family shaped differently

Three departures from the other three families, each forced by the CMDT rather than chosen:

**No SObject key, and no `EntityDefinition` question.** `EventBus__c` is `DeveloperControlled` plain
text, not an `EntityDefinition` reference, and there is no `*Alternate__c` field. So there is no
`ambiguous` diagnostic, no `sobjectField: 'primary' | 'alternate'`, and none of the
`unsupported-entity-definition-object` / `unnecessary-entity-definition-alternate` pair. The scan
envelope is `{ records, malformed }` — two keys, not three.

**The unique key is the consumer, not the SObject.** `Consumer__c` is `unique: true`. There is no
priority field, no winner resolution, and no shadowing: a consumer subscribes once org-wide or not at
all. `duplicate-consumer` is the analogue of `duplicate-fieldset-name`, not of `duplicate-to`.

**One rule needs schema outside the CMDT.** `non-conforming-event-bus` requires the platform event
object's field list. `entityDefinitionEligibility.ts` solved the comparable problem with a hardcoded
standard-object baseline, which is not available here — platform events are all custom. So the field
list is an _optional input_: `validatePlatformEventSubscriptions` accepts an
`eventBusFields?: ReadonlyMap<string, ReadonlySet<string>>` and skips the rule for any bus absent from
it. Local scans populate it by reading `objects/<Bus>__e/fields/` out of the same source dirs; org
scans use `describe`. When the bus can't be seen, the rule doesn't fire — the tool never asserts a bus
is broken on the strength of not having looked at it.

## Behavior

### `list`

One row per record, grouped Event Bus → Category → subscription. Bus-level status
(`CONFORMS` / `NOT A VALID BUS`) comes from `non-conforming-event-bus`. Records with no
`EventCategory__c` group under a "No category" band as bus-wide subscriptions.

### `validate`

Same contract as the other three families: one issue per problem, `error` severity sets the exit code,
`warning` is advisory. `At4dxPlatformEventSubscriptionValidateResult` is `{ source, recordCount, issues }`.

### `simulate`

New verb, no precedent in the other families. Takes `--event-bus`, `--category`, `--event-name` and
prints the matched consumer set plus the non-matches with reasons. `--json` returns the
`PlatformEventDistributionResult` envelope directly.

### `create` / `update`

Same `WriteError` code list as `FieldSetInclusionWriteErrorCode`, with `validation-failed` now able to
carry `matcher-rule-missing-field` — which means the common authoring mistake is caught at write time,
before deploy, rather than at runtime never.

`update` on `Consumer__c` is a value change like any other, **not** the create-plus-delete dance
`DeveloperName` requires. Worth stating because the consumer reads as the record's identity in the UI;
it isn't the record's key.

## Alternatives considered

**Extend the existing `binding` family instead of adding a fourth.** `PlatformEvents_Subscription__mdt`
shares no field with `ApplicationFactory_*__mdt` — no `To__c`, no `BindingSObject__c`, no priority, no
sequence. Every `BINDING_RULES` entry would need a "not for this type" branch, and `BindingType` would
gain a member that participates in none of the existing rules. The three-family split exists precisely
because these CMDTs don't share a shape.

**Skip the simulator; ship scan + validate + write only.** Cheaper, and the four hazard rules already
justify the family. Rejected because two of those rules (`matcher-rule-missing-field`,
`unreachable-subscription`) are assertions about the distributor's control flow, and implementing that
control flow once — as the simulator — is how they stay honest. Without it, both rules are hand-copied
conditions that drift the first time AT4DX changes the pre-filter.

**Make `non-conforming-event-bus` a hard requirement rather than an optional input.** Would mean
`validate` errors when it can't find the bus definition, which punishes the ordinary case of a
subscription in one package and the platform event in another. Skipping the rule when the bus is
invisible is the same posture `at4dxFieldSetInclusionLocalScan.ts` takes toward "AT4DX isn't configured
here": absence of evidence, not evidence of a problem.

**Detect consumer-class-not-found and does-not-implement-`IEventsConsumer`.** Deferred. Both are
workspace Apex-resolution checks — a different, harder class of validation (resolving and inspecting
compiled Apex symbols, not just CMDT field values) than anything the other three families do today.
Worth its own doc once there's a concrete approach for that class of check in this codebase, rather
than bolting a first attempt onto this one.

## Implementation plan

Three landable stages. Each compiles, tests, and ships on its own.

**Stage 1 — read. Landed.** `Types`, `LocalScan`, `OrgScan`, and `Resolve`'s
`validatePlatformEventSubscriptions` with the four record-scope rules plus `duplicate-consumer` and
`duplicate-developer-name`. Exports added to `index.ts`. `list` and `validate` commands.

`non-conforming-event-bus` landed in `validatePlatformEventSubscriptions` itself, but neither CLI
command populates `eventBusFields` yet — the local `objects/<Bus>__e/fields/` read and the org
`describe` call this doc describes for that input are deferred to a follow-up, so the rule is
currently silent on every real invocation. `missing-event-bus-or-consumer`'s `scope` was set to
`'record'` per Open question 1 below, matching [0011](0011-domain-process-binding-issue-scoping.md)'s
own definition rather than `field-set-inclusion`'s `'scan'` precedent for the comparable rule. The
`MatcherRule__c` picklist's four values (`MatchEventBus`, `MatchCategory`, `MatchEvent`,
`MatchCategoryAndEvent`) are implemented as specified in this doc, but — per the missing-reference-
material caveat at the top — weren't independently confirmed against the source material's exact API
names; see the code comment in `at4dxPlatformEventSubscriptionTypes.ts`.

**Stage 2 — simulate. Landed.** `resolvePlatformEventDistribution` in the same `Resolve` module, and the
`simulate` command. `matcher-rule-missing-field` and `unreachable-subscription` are refactored onto two
shared helpers this stage introduces (`isMissingMatcherField` — already private in Stage 1, now reused —
and a new `hasPreFilterMatchField`), so field-presence and pre-filter-reachability logic is stated once,
not duplicated between `validatePlatformEventSubscriptions` and the simulator.

The evaluation order this stage settled on, in the absence of source material to confirm it against
(see the provenance caveat at the top): per candidate record, in sequence, (1) restrict to records on
`input.eventBus` — a different bus isn't a candidate at all, not even as a reported miss, matching how
the real trigger's own query scopes to one bus; (2) `IsActive__c: false` misses with reason `inactive`,
ahead of everything else, since the distributor's own static SOQL never loads it; (3) `triggerHandler`'s
pre-filter runs _before_ the matcher rule and independently of which fields that record's `MatcherRule__c`
needs — so a record can pass the pre-filter via `Event__c` while its matcher rule is `MatchCategory` and
`EventCategory__c` is blank, which is how `matcher-rule-missing-field` actually manifests in a real org:
the pre-filter doesn't know or care which field the matcher rule dereferences. A miss from this step is
tagged `prefiltered`. (4) Only once a record has passed the pre-filter does a blank required field become
the `matcher-rule-missing-field` hazard — modeled as a miss rather than a thrown exception, since this is
a simulation. (5) Everything else is `no-match`: every field the matcher rule needs is present, but the
value(s) don't equal the simulated event's. `MatchEventBus` never reaches step 4 or 5 with a `false`
result — it dereferences nothing, so once it clears the pre-filter it always matches.

`resolvePlatformEventDistribution`'s `matches` are returned in scan order, not a resolved winner
order — there is no priority/sequence field on this CMDT (see "What makes this family shaped
differently" above), so this mirrors `list`'s flat posture rather than `binding list`'s resolved one.
Answers Open question 3 below: `simulate` does belong in the CLI, landed as
`platform-event-subscription simulate` with `--event-bus` (required), `--category`, `--event-name`.

**Stage 3 — write.** `BuildXml`, `Write`, `create`/`update` commands, `PlatformEventSubscriptionWriteError`.

File-by-file mechanics, full type sketches, the rule table's exact display copy, and message
templates aren't specified at that level of detail in this doc (see the caveat at the top) — the
implementer works those out against this repo's existing three families as the pattern to match,
the same way `field-set-inclusion` was matched against `domain-process-binding` in
[0016](0016-at4dx-selector-config-field-set-inclusion.md).

## Testing

Per [0010](0010-at4dx-domain-process-binding-validate.md)'s unit tier, mirroring the existing families' suites:

- **Scan:** each of the seven fields parsed; a record with blank `EventBus__c` or `Consumer__c` lands in
  `malformed` and not `records`; `IsActive__c` defaults true and `Execute_Synchronous__c` defaults false
  when the `<values>` pair is absent; `MatcherRule__c` round-trips all four values.
- **Validate:** one case per rule, plus the negative case for each. Specifically: all three
  field-dereferencing rules trip `matcher-rule-missing-field`; `MatchEventBus` does not; a
  `MatchEventBus` record with both match fields blank raises `unreachable-subscription` and _not_
  `matcher-rule-missing-field`; `non-conforming-event-bus` is silent when `eventBusFields` omits the bus.
- **Simulate:** the pre-filter drops a record before its rule is consulted; each of the four rules
  matches and misses correctly; an inactive record never appears; sync/async is read from
  `Execute_Synchronous__c`; the skipped-reason discriminant is right for each miss.
- **Write:** the `WriteError` code list; `matcher-rule-missing-field` blocks a create without `--force`
  and is still reported in the result with it.

## Open questions

1. **`scope` on malformed-derived rules.** `FIELD_SET_INCLUSION_RULES['missing-sobject-reference']` is
   `scope: 'scan'`, but the condition is computable from one record — which is what `'record'` means per
   [0011](0011-domain-process-binding-issue-scoping.md). This doc specs `missing-event-bus-or-consumer` as
   `'record'`, deliberately diverging. Either the new rule should match the existing convention, or the
   existing entry is a long-standing mistake worth correcting; both are defensible, and copying it
   silently is not.
2. **Command topic naming.** This doc specifies the core library precisely and the command surface only
   in outline. `platform-event-subscription` is a long topic segment; whether it shortens (e.g.
   `pe-subscription`, `subscription`) is a `simply-aep` CLI-package decision, not made here.
3. **Does `simulate` belong in the CLI at all?** ~~It's specified here as a command because the library
   function has to exist either way and a command is nearly free to add on top of it.~~ **Resolved in
   Stage 2:** yes — landed as `platform-event-subscription simulate`.
4. **Should `unreachable-subscription` fire for non-`MatchEventBus` rules?** As specified it cannot:
   any other rule with a blank match field is already the harder `matcher-rule-missing-field` error. If
   a future AT4DX release adds the missing null guards, that error becomes a warning and this rule's
   scope widens to all four.
5. **Missing reference material.** `HANDOFF-05-platform-event-cli.md` and `SPEC-CONVENTIONS.md`, cited
   in the source material this doc was drafted from, aren't part of this repo and weren't available
   when writing this version — see the caveat at the top. If they can be shared into this repo (or
   their relevant content pasted into a follow-up to this doc), the Implementation plan and Testing
   sections above should get more specific from them. A `simply-vscode` repo design doc `0014` is
   referenced by the same source material as gating a panel-side consumer of this work; that's a
   decision for that repo, not this one.

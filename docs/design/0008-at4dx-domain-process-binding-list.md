# 0008 — `simply aep at4dx domain-process-binding list`

**Status:** Implemented (PR #125)
**Package:** `packages/simply-aep`
**Date:** 2026-08-24

## Problem

AT4DX's Trigger Action Framework wires an SObject's trigger events (or a domain method's explicit
"process token") to ordered criteria/action Apex classes through `DomainProcessBinding__mdt` — a
second, structurally different binding mechanism from the four `ApplicationFactory_*Binding__mdt`
types [0007](0007-at4dx-binding-list.md) already covers. [0007](0007-at4dx-binding-list.md) explicitly
deferred it: "a legitimate second command... tracked as an open question," rejected from that command
because the row shape (trigger operation, execution order, active/inverse flags) and resolution model
(no interface/SObject "key", no priority-based winner) don't fit the Application Factory row type.

Today, answering "what runs, and in what order, when `Account` fires `Before_Insert`?" means opening
Setup and reading `DomainProcessBinding__mdt` records one at a time, with no visibility into whether
two active records at the same `OrderOfExecution__c` are silently fighting over the same execution
slot.

This is also the concrete forcing function: a companion VS Code extension
(`simply-vscode/extensions/simply-at4dx`) needs this data to render a per-SObject Before/After Save
handler view (execution order, active/inactive state, criteria vs. action) and currently has nothing
to call.

## Decision

Add `sf simply aep at4dx domain-process-binding list` to `packages/simply-aep`, as a sibling to
`simply aep at4dx binding list` — same package (both are AT4DX binding metadata), same
local/org-scan → resolve → `this.table()` shape, same `src/index.ts` barrel-export convention for the
VS Code extension, but its own row type, scan functions, and resolver, because the resolution
semantics are genuinely different (see Behavior).

The shared low-level XML-parsing helpers (`fieldValue`, `toNumber`, plus new `toBoolean` and
`extractValues`, needed because `DomainProcessBinding__mdt` has boolean fields and
`ApplicationFactory_*Binding__mdt` doesn't) move out of `at4dxLocalScan.ts` into
`src/common/customMetadataXml.ts` so both local scanners share one implementation instead of
duplicating the `<values>` XML shape.

## Behavior

```sh
sf simply aep at4dx domain-process-binding list --target-org my-org
sf simply aep at4dx domain-process-binding list --source-dir sfdx-source/core --source-dir sfdx-source/app
sf simply aep at4dx domain-process-binding list --target-org my-org --sobject Account
sf simply aep at4dx domain-process-binding list --target-org my-org --active-only --json
```

`requiresProject = false`. Exactly one of `--target-org`/`--source-dir` is required, same rule and
error (`error.targetOrgOrSourceDirRequired`) as the sibling command.

### Flags

| Flag            | Char | Purpose                                                                                      |
| --------------- | ---- | -------------------------------------------------------------------------------------------- |
| `--target-org`  | `-o` | Read bindings from this org via SOQL. Mutually exclusive with `--source-dir`.                |
| `--api-version` |      | Standard org API version override.                                                           |
| `--source-dir`  | `-d` | Read bindings from local DX source (repeatable). Mutually exclusive with `--target-org`.     |
| `--sobject`     | `-s` | Filter to one or more SObject API names (repeatable). Default: all SObjects.                 |
| `--active-only` |      | Hide inactive records. Default: `false` — showing every record, active or not, is the point. |

### Row shape (shared by table and JSON)

```ts
type DomainProcessBindingRow = {
  developerName: string;
  sobject: string;
  processContext: 'TriggerExecution' | 'DomainMethodExecution';
  triggerOperation?: TriggerOperation; // present when processContext is TriggerExecution
  domainMethodToken?: string; // present when processContext is DomainMethodExecution
  type: 'Action' | 'Criteria';
  classToInject: string;
  order: number; // OrderOfExecution__c
  isActive: boolean;
  executeAsynchronous: boolean;
  logicalInverse: boolean;
  preventRecursive: boolean;
  description?: string;
  source: string; // local package directory name, or the org username
  orderCollision?: boolean; // see Resolution rules
};
```

Table columns: `SOBJECT`, `CONTEXT` (trigger operation or domain method token), `TYPE`, `ORDER`
(annotated `(collision)` when flagged), `CLASS`, `ACTIVE`, `ASYNC`, `SOURCE`.

### Resolution rules

Unlike Application Factory bindings, `DomainProcessBinding__mdt` has no interface/SObject "key" with
a single winner — every **active** record in scope actually runs, ordered by `OrderOfExecution__c`.
So instead of `effective`/`ambiguous`, this command flags `orderCollision: true`.

Verified against AT4DX's actual runtime resolver
(`DomainProcessCoordinator.primeDomainLogicInjections`, `framework-domain-process-injection`), not
guessed: each `DomainProcessCoordinator` instance is scoped to one SObject (its constructing query
filters `RelatedDomainBindingSObject__r.QualifiedApiName = :sobjAPIName` — or
`RelatedDomainBindingSObjectAlternate__c`, in a second query, since CMDT SOQL can't `OR` across two
fields — **and `IsActive__c = true`**, so inactive records are never even loaded). Query results are
primed into a nested map keyed, in order, by `ProcessContext__c` → `TriggerOperation__c`/
`DomainMethodToken__c` (lowercased) → the _integer_ part of `OrderOfExecution__c` → `Type__c`
(`Criteria`/`Action`) → the _exact decimal_ `OrderOfExecution__c` value. That last map level is a
plain `put()` — the record building it up **overwrites** any prior record already at that key.

This means a "collision" is not just "these two run in an unspecified order" — it's **one of the two
records never runs at all**, silently. And critically, the map only collapses two records into one
slot when they share the same `SObject` **and** `ProcessContext__c` **and** trigger
operation/domain-method-token **and** `Type__c` **and** exact `OrderOfExecution__c`. A `Criteria` and
an `Action` at the same order do **not** collide — they're independent map branches (criteria for a
sequence run first and narrow the record set; actions for that same sequence then run against
whatever the criteria left). A collision-detector that groups by `(sobject, processContext, token)`
alone, without also partitioning by `type`, produces false positives on every Criteria/Action pair
that happens to share an order — which is a normal, intended configuration (a criteria and its
paired action are commonly given the same `OrderOfExecution__c`).

Because AT4DX's query orders by `ProcessContext__c, TriggerOperation__c, OrderOfExecution__c, Type__c`
with no `DeveloperName`/`Id` tiebreaker, which record "wins" a true collision (i.e., which one
actually overwrites the other in the map) is not something SOQL guarantees across executions. So,
matching [0007](0007-at4dx-binding-list.md)'s precedent for ambiguous Domain bindings, this command
flags every colliding _active_ record `orderCollision: true` and does not attempt to name a winner.

| Grouping scope (must all match for two records to collide)                           | Effect when two **active** records tie                                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `sobject`, `processContext`, `triggerOperation`/`domainMethodToken`, `type`, `order` | Both flagged `orderCollision: true` — one is silently dropped by AT4DX at runtime, non-deterministically.                       |
| Same group, different `order`                                                        | No collision — both run, in ascending `order`.                                                                                  |
| Same group and `order`, one or both records inactive                                 | No collision — AT4DX's query excludes inactive records before priming the map, so an inactive record never contends for a slot. |

`RelatedDomainBindingSObject__c` (an `EntityDefinition` reference; needs
`__r.QualifiedApiName` traversal in org SOQL, since local source XML stores the plain API name
directly) is preferred for `sobject`, falling back to `RelatedDomainBindingSObjectAlternate__c` when
blank — matching the field's own stated contract ("Only specify... or this one; not both"), same
fallback order `at4dxOrgScan.ts`/`at4dxLocalScan.ts` already use for `BindingSObject__c`. (AT4DX's
real query technically unions "primary matches" OR "alternate matches" as two separate queries rather
than "prefer primary, fall back to alternate," so a record populating _both_ fields with _different_
SObjects would double-register under both in a live org — a misuse the field's own description
disclaims, and not worth modeling here.)

### Local vs. org discovery

Same pattern as the sibling command: `connection.autoFetchQuery` against `DomainProcessBinding__mdt`
for `--target-org` (catching `INVALID_TYPE` to report "not detected" rather than a query failure), or
`ComponentSet.fromSource` filtered to `DomainProcessBinding.*` `CustomMetadata` components for
`--source-dir`, parsing each record's `<values>` pairs. Local source has no independent "type doesn't
exist" signal — an empty result is treated as "not detected," same caveat [0007](0007-at4dx-binding-list.md)
notes for its four types.

### Errors

| Condition                                                                                                  | Behavior                                      |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Neither/both of `--target-org`/`--source-dir` given                                                        | `error.targetOrgOrSourceDirRequired`          |
| `DomainProcessBinding__mdt` doesn't exist (org `INVALID_TYPE`, or local scan finds no matching components) | `error.at4dxNotDetected`                      |
| Local `ComponentSet.fromSource` throws                                                                     | `error.localScanFailed`, wrapping the message |
| Org query fails for a reason other than "type doesn't exist"                                               | `error.orgQueryFailed`, wrapping the message  |

## Alternatives considered

**Folding this into `simply aep at4dx binding list`, or splitting `binding list`'s four existing
types into four separate commands for symmetry.** Both rejected, by the same test: **one command per
resolution model, not one command per Custom Metadata Type and not one command for all of them.**
`ApplicationFactory_{Service,Selector,Domain,UnitOfWork}Binding__mdt` all answer the same _kind_ of
question — a keyed lookup with a priority-ordered winner (`di_Module`-style: "who implements X") —
with only small per-type gaps (UnitOfWork has no `to`; Domain has no priority field). That shared
model is why they stay one command with a `bindingType` discriminator and a `--type` filter: splitting
them would multiply the CLI surface without changing what's being asked, and breaks the "see every
binding type together" use case the Problem section in
[0007](0007-at4dx-binding-list.md) calls out (a design review or CI check scanning all AT4DX wiring at
once).

`DomainProcessBinding__mdt` fails that same test in the other direction — it isn't a keyed lookup at
all. There's no "key" a record resolves for and no winner; every active record in a group runs, in
execution order (see Resolution rules). Forcing it into `At4dxBindingRow` means either a row that's
mostly null for one side or the other, or a `--json` result whose shape depends on `--type` — worse
for a human table, and worse for the VS Code extension consuming a single stable type per command.
That's why it gets its own command and its own row shape, for the same reason [0007](0007-at4dx-binding-list.md)
already gave when it deferred this ("a legitimate second command... tracked as an open question"):
same reasoning, now made explicit as the rule to apply the next time a third binding type shows up.

**Naming the flag `orderCollision` "ambiguous" (matching the Domain binding flag in
[0007](0007-at4dx-binding-list.md)).** Rejected: `ambiguous` in that command means "can't determine a
winner, but every candidate is still a plausible one." Here, exactly one of the colliding records
runs and the other is dropped entirely — a stronger, more consequential fact than ambiguity, so it
gets its own name and its own explanation rather than reusing a term that would undersell it.

**Modeling `RelatedDomainBindingSObject__c`/`RelatedDomainBindingSObjectAlternate__c` as AT4DX's
literal two-query union** (letting one record register under two different SObjects if both fields
are populated with different values). Rejected: the Alternate field's own description says "Only
specify... or this one; not both," so this would model a documented misuse case at the cost of a more
complex row-to-SObject mapping (one record → potentially many rows) for no known real-world benefit.
Revisit only if a real project is found relying on it.

**Flagging `orderCollision` for _any_ two active records sharing `(sobject, processContext, token,
order)`, ignoring `type`.** This was the first-pass implementation and is wrong: it treats a
Criteria/Action pair sharing an order (a normal, common configuration — "if this criteria passes, run
this action, both at sequence 10") as a collision, when AT4DX's map keys `Criteria` and `Action`
separately and they never contend for the same slot. Grouping must include `type`.

## Implementation plan

All steps below landed in PR #125, mirroring [0007](0007-at4dx-binding-list.md)'s file layout.

1. **`src/common/customMetadataXml.ts`** — `fieldValue`, `toNumber`, `toBoolean`, `extractValues`
   extracted out of `at4dxLocalScan.ts`, which now imports them.
2. **`src/common/at4dxDomainProcessBindingTypes.ts`** — `RawDomainProcessBindingRecord`,
   `DomainProcessBindingRow`, `DomainProcessType`, `ProcessContext`, `TriggerOperation`,
   `ALL_TRIGGER_OPERATIONS`.
3. **`src/common/at4dxDomainProcessOrgScan.ts`** — one SOQL query with the
   `RelatedDomainBindingSObject__r.QualifiedApiName` traversal, `INVALID_TYPE` handling.
4. **`src/common/at4dxDomainProcessLocalScan.ts`** — `ComponentSet.fromSource` scan for
   `DomainProcessBinding.*` components.
5. **`src/common/at4dxDomainProcessResolve.ts`** — `groupKey()` groups by `(sobject, processContext,
triggerOperation ?? domainMethodToken, type)`, so a same-order Criteria/Action pair doesn't flag a
   false-positive collision (see Resolution rules / Alternatives considered).
6. **`src/commands/simply/aep/at4dx/domain-process-binding/list.ts`** — flags, exclusivity check,
   scan → filter → resolve → `this.table()`.
7. **`messages/simply.aep.at4dx.domain-process-binding.list.md`** — done.
8. **`src/index.ts`** barrel — exports added alongside the existing Application Factory exports.
9. **Tests** — `test/common/at4dxDomainProcessResolve.test.ts` (including both cases from the Testing
   table below), `test/common/at4dxDomainProcessLocalScan.test.ts`,
   `test/commands/simply/aep/at4dx/domain-process-binding/list.test.ts`.
10. **Housekeeping**, per `CLAUDE.md`: `pnpm run readme` and `pnpm run build` run for
    `packages/simply-aep`; root `pnpm run build` picked up the new command in `packages/simply`'s
    `command-snapshot.json` (already an `oclif.plugins`/dependency entry from
    [0007](0007-at4dx-binding-list.md)).
11. **Manual smoke test** and **keeping `simply-vscode/extensions/simply-at4dx`'s `at4dxCli.ts` type
    mirror in sync** remain open — tracked under Open questions.

## Testing

**Unit** — `test/common/at4dxDomainProcessResolve.test.ts`:

| Case                                                                                   | What it pins down                                                             |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Records sorted within a group by `order` ascending                                     | Done.                                                                         |
| Two active records, same group, same `order`                                           | Done — both flagged `orderCollision: true`.                                   |
| Active + inactive record sharing an order                                              | Done — neither flagged (inactive never contends for a slot).                  |
| Different SObject, context, or trigger operation                                       | Done — no false-positive collision.                                           |
| `DomainMethodExecution` grouped by `domainMethodToken`, not `triggerOperation`         | Done.                                                                         |
| Empty input                                                                            | Done.                                                                         |
| **Criteria and Action record, same group, same `order`** (missing — add after the fix) | **Not** a collision — `type` partitions the group; neither row is flagged.    |
| Two active Criteria records (or two active Action records), same group, same `order`   | **Is** a collision — same `type` means they do contend for the same map slot. |

**Unit** — `test/common/at4dxDomainProcessLocalScan.test.ts`, `test/commands/.../list.test.ts`: already
cover local-source parsing (fixture-based, temp directories) and command-level flag validation/error
paths (missing type, org query failure, `--target-org`/`--source-dir` exclusivity), mirroring the
sibling command's test style.

**NUT** — none, matching the sibling command (no NUT infrastructure exists yet for either AT4DX
command despite [0007](0007-at4dx-binding-list.md) mentioning one; a real NUT reference project is
still an open item for both commands, not unique to this one).

## Open questions

- **Manual smoke test** against real AT4DX local source (`--source-dir <real AT4DX project> --json`)
  hasn't been run — both to sanity-check the parsed shape and because
  `simply-vscode/extensions/simply-at4dx`'s consumption of it hasn't been smoke-tested against real
  data either.
- **Keeping `simply-vscode/extensions/simply-at4dx`'s `at4dxCli.ts` type mirror in sync** with any
  future shape change here — that extension shells out to this command and has its own copy of
  `DomainProcessBindingRow`.
- **VS Code extension integration details** beyond `DomainProcessBindingRow[]` (e.g., whether the
  extension wants incremental/watch-mode scanning, or the criteria/action pairing implied by shared
  `order` surfaced more explicitly than "same order, different `type`") are intentionally undecided
  here, matching [0007](0007-at4dx-binding-list.md)'s stance on its own VS Code integration.
- **Namespaced AT4DX installs** — out of scope, same reasoning as [0007](0007-at4dx-binding-list.md).

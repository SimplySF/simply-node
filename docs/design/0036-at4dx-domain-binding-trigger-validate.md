# 0036 — `simply-aep-core`: `missing-domain-trigger` binding validation rule

**Status:** Draft
**Package:** `packages/simply-aep-core` (consumed by `simply-plugins`' `packages/simply-aep`, see that
repo's [0034](https://github.com/SimplySF/simply-plugins/blob/main/docs/design/0034-at4dx-domain-binding-trigger-validate.md))
**Date:** 2026-09-03

## Problem

An AT4DX Application Factory `Domain` binding (`ApplicationFactory_DomainBinding__mdt`, `key` = SObject,
`to` = the implementing Apex class — see `RawBindingRecord` in `at4dxBindingTypes.ts`) only registers a
SObject-to-class mapping for AT4DX's DI factory (`Application.Domain.newInstance(...)`). It does **not**
make that Domain class run. Per the `fflib_SObjectDomain` enterprise pattern this package already
validates other pieces of, a Domain class only ever executes when the SObject's own Apex trigger calls:

```apex
fflib_SObjectDomain.triggerHandler(AccountsDomain.class);
```

Teams routinely author the `Domain` binding — often generated via `simply aep at4dx binding create` — and
never add or update that trigger call, or delete/rename the trigger later without noticing the binding
still points at it. The result is a Domain class (and, transitively, every `DomainProcessBinding__mdt`
targeting that SObject — see
[0010](0010-at4dx-domain-process-binding-validate.md)) that is fully configured and silently dead: no
compile error, no deploy error, no runtime error. It just never fires. `validateBindings`
(`at4dxValidate.ts`) has no rule that catches this today — every existing `Domain`-scoped rule
(`duplicate-domain-sobject`, `unsupported-entity-definition-object`, etc.) only inspects the binding
record itself, never cross-references anything outside the Custom Metadata records `scanLocalBindings`/
`scanOrgBindings` already read.

## Decision

Add a sixth input to the AT4DX binding family — Apex Trigger source — and a new `validateBindings` rule,
`missing-domain-trigger` (`error`, `record`-scoped), that flags a `Domain` binding whose SObject has no
_Active_ Apex trigger containing a `fflib_SObjectDomain.triggerHandler(<ThatClass>.class)` call.

This is a new scan family, mirroring the existing pattern (`at4dxFieldSetInclusion*`,
`at4dxPlatformEventSubscription*`) of a sibling `Types`/`LocalScan`/`OrgScan` trio rather than extending
`scanLocalBindings`/`scanOrgBindings` — those two only know how to read Custom Metadata `CustomMetadata`
components/records; `ApexTrigger` is a different component type (local: `apextrigger` in
`ComponentSet.fromSource`; org: a Tooling API query) read for a structurally different reason (finding a
call inside a method body, not extracting `<values>` pairs).

`validateBindings` takes this as an **optional** third input — a caller that doesn't pass it (or that
never validates `Domain`-type records) sees no behavior change, matching how
`validatePlatformEventSubscriptions`'s `eventBusFields` parameter already works.

## Behavior

### New types (`at4dxApexTriggerTypes.ts`, new file)

```ts
/** One Apex trigger, normalized from either local source or an org's Tooling API. */
export type RawApexTriggerRecord = {
  /** The trigger's own name, e.g. `AccountTrigger`. */
  name: string;
  /** The SObject this trigger fires on, parsed from its `trigger X on <SObject> (...)` header. */
  sobject: string;
  /** Every class named inside a `fflib_SObjectDomain.triggerHandler(<Class>.class)` call found in this trigger's body. Empty when the trigger never calls it. */
  triggerHandlerClasses: string[];
  /** `false` for a trigger whose `Status`/`-meta.xml` `<status>` is `Inactive` — an inactive trigger never runs, so it can't satisfy `missing-domain-trigger` even if it calls the right class. */
  active: boolean;
  /** Local package directory name, or the org username when read from `--target-org`. */
  source: string;
  /** Absolute path to the `.trigger` file. Local scans only. */
  filePath?: string;
};
```

The `fflib_SObjectDomain.triggerHandler(...)` extraction and the `trigger X on Y (...)` header
extraction are both plain regex over the trigger body text — consistent with every existing scan module
in this package (`customMetadataXml.ts`'s `<values>` extraction, `at4dxLocalScan.ts`'s component-name
splitting): none of them use an Apex parser, and this doesn't need to be the first. The
`triggerHandler` pattern tolerates an optional leading namespace/alias segment
(`(?:\w+\.)?fflib_SObjectDomain\s*\.\s*triggerHandler\s*\(\s*([\w.]+)\s*\.\s*class\s*\)`) so a
namespaced install of apex-common still matches.

### New scan functions

```ts
// at4dxApexTriggerLocalScan.ts
export function scanLocalApexTriggers(sourceDirs: string[]): RawApexTriggerRecord[];

// at4dxApexTriggerOrgScan.ts
export async function scanOrgApexTriggers(connection: AepConnection): Promise<RawApexTriggerRecord[]>;
```

Org scan runs one Tooling query: `SELECT Name, Body, Status FROM ApexTrigger`. Deliberately not
filtering by `TableEnumOrId` — the trigger header line already gives an unambiguous SObject name for
both local and org source, so there's no need to trust (or handle the historical inconsistency of)
`TableEnumOrId`'s custom-object representation.

### `validateBindings` changes (`at4dxValidate.ts`, `at4dxBindingTypes.ts`)

```ts
export type BindingIssueRule =
  | 'missing-sobject-reference'
  | 'ambiguous-sobject-reference'
  | 'unsupported-entity-definition-object'
  | 'unnecessary-entity-definition-alternate'
  | 'duplicate-to'
  | 'duplicate-domain-sobject'
  | 'duplicate-unit-of-work-sobject'
  | 'sequence-collision'
  | 'duplicate-developer-name'
  | 'missing-domain-trigger'; // new

export function validateBindings(
  scan: Pick<LocalScanResult, 'records' | 'malformed' | 'ambiguous'>,
  triggers?: RawApexTriggerRecord[],
): BindingIssue[];
```

| Rule                     | Severity | Scope    | Detects                                                                                                                                          |
| ------------------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `missing-domain-trigger` | `error`  | `record` | A `Domain` binding whose `key` (SObject) has no Active Apex trigger whose body calls `fflib_SObjectDomain.triggerHandler(<binding's to>.class)`. |

Skipped entirely for a `Domain` record whose `to` is blank — there's no class name to look for, and no
existing rule flags a blank `To__c` on a Domain binding at all (see Open questions). Skipped entirely
when `triggers` isn't passed, so existing callers are unaffected until they opt in.

Three message shapes, depending on what was found on `record.key` (matched case-insensitively against
`triggers[].sobject`):

- **No trigger at all**: `"AccountsDomainBinding: no Apex trigger exists on Account — fflib_SObjectDomain.triggerHandler(AccountsDomain.class) is never called, so this Domain's logic (and any Domain Process Bindings on Account) never fires."`
- **Trigger(s) exist, none call the right class**: `"...: found AccountTrigger on Account, but it doesn't call fflib_SObjectDomain.triggerHandler(AccountsDomain.class) — ..."`
- **Only an Inactive trigger calls it**: `"...: AccountTrigger calls fflib_SObjectDomain.triggerHandler(AccountsDomain.class), but the trigger's Status is Inactive — ..."`

## Alternatives considered

**Putting this in `domain-process-binding validate` instead.** Rejected — wrong Custom Metadata Type.
`DomainProcessBinding__mdt` ([0010](0010-at4dx-domain-process-binding-validate.md)) is AT4DX's _process
injection_ mechanism (`IDomainProcess` classes layered onto an existing Domain via
`DomainProcessCoordinator`); it presupposes the base Domain is already wired up correctly. The gap here
is one layer below that — the base `ApplicationFactory_DomainBinding__mdt` binding this doc's
`at4dxValidate.ts` already validates.

**Parsing Apex with a real parser/AST library instead of regex.** Rejected. No Apex parser dependency
exists anywhere in this monorepo; every scan module here already extracts one narrow signal from source
text via string/regex logic (component names, XML `<values>`, now a trigger header and one static-call
shape). Pulling in a parser for one method-call pattern is disproportionate, and the false-positive
surface a regex leaves (see Open questions) is a known, bounded trade a parser wouldn't fully close
anyway without also modeling `fflib_SObjectDomain` subclassing.

**A live org probe (temporarily invoke the trigger path, or introspect via Apex) instead of a static
check.** Rejected — this package's entire model is static analysis over Custom Metadata/source; a dynamic
probe needs write/execute access to the target org for what is fundamentally a config-wiring question,
wildly disproportionate to every other rule here.

**`warning` instead of `error` severity.** Rejected — a missing trigger means the Domain binding is
completely inert, the same "this literally does not work" class as `missing-sobject-reference`, not an
advisory style issue like `unnecessary-entity-definition-alternate`.

**Extending `scanLocalBindings`/`scanOrgBindings` directly instead of a sibling `at4dxApexTrigger*`
family.** Rejected — those two are scoped to one Custom Metadata shape; `ApexTrigger` is an unrelated
component type with a different reason to fail (I/O vs. a describe/query error). A sibling family matches
how `at4dxFieldSetInclusion*`/`at4dxPlatformEventSubscription*` are already separate from
`at4dxLocalScan`/`at4dxOrgScan` rather than folded in.

## Implementation plan

1. **`at4dxApexTriggerTypes.ts`** (new) — `RawApexTriggerRecord`, the shared header/`triggerHandler`
   regexes (exported so local/org scans and any future consumer share one definition).
2. **`at4dxApexTriggerLocalScan.ts`** (new) — `scanLocalApexTriggers`, using
   `ComponentSet.fromSource(sourceDirs)` filtered to `component.type.id === 'apextrigger'`, reading
   `component.content` for the body and its `-meta.xml` for `<status>`.
3. **`at4dxApexTriggerOrgScan.ts`** (new) — `scanOrgApexTriggers`, one Tooling query.
4. **`at4dxBindingTypes.ts`** — add `'missing-domain-trigger'` to `BindingIssueRule` and `BINDING_RULES`.
5. **`at4dxValidate.ts`** — `missingDomainTriggerIssues(records, triggers)`; `validateBindings` gains the
   optional `triggers` parameter and includes this check in its return array.
6. **`index.ts`** barrel — export the new types/functions.
7. **Tests** — see Testing below.
8. **Housekeeping** — `pnpm run readme` (new `## API` entries); root `pnpm run build`.

## Testing

**Unit** (`simply-aep-core`):

| Case                                                                                 | What it pins down                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Domain binding, matching Active trigger calling `triggerHandler` for its class       | No issue.                                                          |
| Domain binding, zero triggers on that SObject                                        | `missing-domain-trigger`, "no Apex trigger exists" message.        |
| Domain binding, trigger(s) exist on the SObject but none call the right class        | `missing-domain-trigger`, "found ... but it doesn't call" message. |
| Domain binding, only an Inactive trigger calls the right class                       | `missing-domain-trigger`, "Status is Inactive" message.            |
| Domain binding with a namespaced `triggerHandler` call (`ns.fflib_SObjectDomain...`) | No issue — namespace-tolerant regex confirmed.                     |
| Domain binding with blank `to`                                                       | No issue from this rule (nothing to check).                        |
| `triggers` argument omitted                                                          | No issue from this rule regardless of binding shape.               |
| Non-`Domain` binding types (Service/Selector/UnitOfWork)                             | Never evaluated by this rule.                                      |

`at4dxApexTriggerLocalScan`/`at4dxApexTriggerOrgScan`: header parsing across a few real trigger shapes
(multiple event keywords, extra whitespace/newlines before `{`), multiple `triggerHandler` calls in one
trigger, a trigger with no such call, Inactive status from both a local `-meta.xml` and an org `Status`
field.

## Open questions

- **Non-literal `triggerHandler` conventions.** A base-trigger-handler wrapper class, or a call written
  across multiple statements, won't match the regex — a real false-positive source. Documented as a known
  v1 limitation rather than solved here; revisit if it proves common enough to need a configurable
  pattern.
- **A `Domain` binding with blank `To__c`.** Nothing today flags this (this rule included — it has no
  class name to check against). Worth a `missing-to`-shaped rule of its own; deliberately not folded into
  this doc's scope.
- **Whether "Inactive-only" deserves its own rule** (e.g. `inactive-domain-trigger`, distinct
  severity/filtering) instead of a message variant under `missing-domain-trigger`. Starting folded in;
  split out later if a caller wants to treat it differently (e.g. `warning` instead of `error`).
- **Tooling query cost at scale.** `SELECT ... FROM ApexTrigger` with no filter could be large in an org
  with many/huge triggers. Whether to pre-filter by the SObjects actually seen in scanned `Domain`
  bindings (once the binding scan has already run) is an implementation-time call, not a design blocker.

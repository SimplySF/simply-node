# 0010 — `simply aep at4dx domain-process-binding validate`

**Status:** Draft
**Package:** `packages/simply-aep-core`, `packages/simply-aep`
**Date:** 2026-08-25

## Problem

[0008](0008-at4dx-domain-process-binding-list.md) taught `domain-process-binding list` to flag
`orderCollision: true` on rows that silently fight over the same execution slot in AT4DX's
`DomainProcessCoordinator` map — a genuine "one of these two never runs, non-deterministically" bug
class that today only surfaces as a `(collision)` annotation a human has to notice while reading a
table. There's no way to ask "does this project's AT4DX wiring have any problems?" and get a yes/no
answer with a non-zero exit code — the shape a CI gate (a pre-merge check, a pre-deploy check) actually
needs.

Worse, `list` isn't even complete for this purpose: both scanners
(`scanOrgDomainProcessBindings`/`scanLocalDomainProcessBindings`) silently **drop** any record whose
`RelatedDomainBindingSObject__c`/`RelatedDomainBindingSObjectAlternate__c` don't resolve to a SObject
(`at4dxDomainProcessOrgScan.ts:60-83`, `at4dxDomainProcessLocalScan.ts:41-51`, `toRawRecord` returning
`undefined`). A metadata author who leaves both fields blank gets no row, no warning, nothing — the
binding just doesn't exist as far as this package is concerned, even though it's sitting in the org or
source tree doing nothing. And AT4DX has at least two more silent-failure shapes `list` never surfaces
today:

- **A binding whose declared `ProcessContext__c` doesn't match the field that's actually populated** —
  `TriggerExecution` with a blank `TriggerOperation__c`, or `DomainMethodExecution` with a blank
  `DomainMethodToken__c`. `DomainProcessCoordinator` keys its map by exactly that field for the
  declared context; if it's blank, the binding can never match any real execution and is dead on
  arrival, with no error at deploy time or run time.
- **Two records with the same `DeveloperName`** authored across two different `--source-dir`
  directories (e.g. a `core` and an `app` package both defining
  `DomainProcessBinding.SomeBinding.md-meta.xml`). Custom Metadata records are keyed by
  `DeveloperName`; deploying both together is a metadata conflict AT4DX itself has no way to detect,
  since from AT4DX's perspective (reading the org after deploy) there's only ever one winner and no
  visibility into the fact a second definition was silently discarded or overwritten.

## Decision

Add `sf simply aep at4dx domain-process-binding validate` to `packages/simply-aep`, as a second sibling
to `list` alongside `binding list` — same package, same local/org-scan flag shape, same
`--target-org`/`--source-dir` exclusivity rule — but its own purpose: report every wiring problem it can
detect and fail (non-zero exit) when any of them is a real bug, so it's usable as a CI gate. It does not
replace `list`'s table of "what runs and in what order" — it answers "is this correct," which is a
different question with a different output shape (an issue list, not a binding table) and a different
consequence (failing exit code, not just an annotated cell).

The detection logic lives in `packages/simply-aep-core` as a new `validateDomainProcessBindings`
function, alongside the existing `resolveDomainProcessBindings` — reusing its `orderCollision` logic
rather than duplicating it — so the same rules are available to a future non-CLI consumer (the
`simply-vscode/extensions/simply-at4dx` companion extension [0008](0008-at4dx-domain-process-binding-list.md)
was built for) without shelling out to the CLI.

Getting the two silently-dropped-record checks (missing SObject reference, duplicate `DeveloperName`)
requires the scanners to stop discarding the records they currently drop. Both
`scanOrgDomainProcessBindings` and `scanLocalDomainProcessBindings` change to also return the
records they can't resolve a SObject for, instead of filtering them out entirely — additive for the org
scanner's already-object-shaped `{ records, missing }` return, but a breaking shape change for the local
scanner, which today returns a bare array (see Behavior).

## Behavior

```sh
sf simply aep at4dx domain-process-binding validate --target-org my-org
sf simply aep at4dx domain-process-binding validate --source-dir sfdx-source/core --source-dir sfdx-source/app
sf simply aep at4dx domain-process-binding validate --target-org my-org --sobject Account
sf simply aep at4dx domain-process-binding validate --target-org my-org --json
```

`requiresProject = false`. Exactly one of `--target-org`/`--source-dir` is required, same rule and
error (`error.targetOrgOrSourceDirRequired`) as both existing AT4DX commands.

### Flags

| Flag            | Char | Purpose                                                                                  |
| --------------- | ---- | ---------------------------------------------------------------------------------------- |
| `--target-org`  | `-o` | Read bindings from this org via SOQL. Mutually exclusive with `--source-dir`.            |
| `--api-version` |      | Standard org API version override.                                                       |
| `--source-dir`  | `-d` | Read bindings from local DX source (repeatable). Mutually exclusive with `--target-org`. |
| `--sobject`     | `-s` | Filter to one or more SObject API names (repeatable). Default: all SObjects.             |

No `--active-only` — unlike `list`, every check here (other than `order-collision`, which is inherently
active-only per [0008](0008-at4dx-domain-process-binding-list.md)'s Resolution rules) applies to a
binding whether or not it's currently active. An inactive binding with a dead context/field mismatch is
still worth catching before someone flips `IsActive__c` to `true` and finds out it never actually runs.

### Validation rules (this doc's scope)

| Rule                          | Severity  | Detects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `order-collision`             | `error`   | Two **active** records of the same `type`, same group (see [0008](0008-at4dx-domain-process-binding-list.md)), same `order` — one silently never runs. Reuses `resolveDomainProcessBindings`.                                                                                                                                                                                                                                                                                                                                                         |
| `missing-sobject-reference`   | `error`   | Neither `RelatedDomainBindingSObject__c` nor `RelatedDomainBindingSObjectAlternate__c` is set — the record has no SObject to bind against and is currently invisible to `list` too.                                                                                                                                                                                                                                                                                                                                                                   |
| `missing-context-field`       | `error`   | `processContext` is `TriggerExecution` with a blank `TriggerOperation__c`, or `DomainMethodExecution` with a blank `DomainMethodToken__c` — dead binding, never matches any execution.                                                                                                                                                                                                                                                                                                                                                                |
| `duplicate-developer-name`    | `error`   | The same `DeveloperName` appears more than once across everything scanned (only reachable with multiple `--source-dir` values or malformed local source; impossible from a single org, since `DeveloperName` is that CMDT's unique name field).                                                                                                                                                                                                                                                                                                       |
| `ambiguous-sobject-reference` | `warning` | Both `RelatedDomainBindingSObject__c` and `RelatedDomainBindingSObjectAlternate__c` are set. Not fatal the way the others are — `resolveSObject` still picks a SObject (primary wins, per [0008](0008-at4dx-domain-process-binding-list.md)'s existing fallback) — but the field's own description says "only specify... or this one; not both," and AT4DX's real query unions both as separate `OR`ed queries, so a record with _different_ values in each field double-registers under both SObjects live, which is very unlikely to be the intent. |

Only `order-collision` and `missing-context-field` require inspecting every field of a resolved
`RawDomainProcessBindingRecord`; `missing-sobject-reference` and `ambiguous-sobject-reference` require
information the scanners currently discard (see below); `duplicate-developer-name` requires seeing
every scanned record's name in one place, including the ones the other checks would otherwise drop.

### Scanner changes (`simply-aep-core`)

Today, `toRawRecord` in both `at4dxDomainProcessOrgScan.ts` and `at4dxDomainProcessLocalScan.ts` returns
`undefined` — and the record is dropped — whenever no SObject resolves, and never records that a second,
different-valued field was also populated. Both scanners change to keep that information instead of
discarding it:

```ts
/** A `DomainProcessBinding__mdt` record with neither `RelatedDomainBindingSObject__c` nor
 *  `RelatedDomainBindingSObjectAlternate__c` set — no SObject to resolve, so it's excluded from
 *  `records` entirely and reported here instead. */
export type MalformedDomainProcessBindingRecord = {
  developerName: string;
  source: string;
};

/** A `DomainProcessBinding__mdt` record with both SObject reference fields set to different values.
 *  Still included in `records` (using the primary field's value, per the existing fallback), but also
 *  reported here for `validateDomainProcessBindings` to flag. */
export type AmbiguousDomainProcessBindingRecord = {
  developerName: string;
  sobject: string; // RelatedDomainBindingSObject__c's resolved value — what `records` uses
  alternateSobject: string; // RelatedDomainBindingSObjectAlternate__c's raw value
  source: string;
};

export type DomainProcessOrgScanResult = {
  records: RawDomainProcessBindingRecord[];
  malformed: MalformedDomainProcessBindingRecord[];
  ambiguous: AmbiguousDomainProcessBindingRecord[];
  missing: boolean;
};

export type DomainProcessLocalScanResult = {
  records: RawDomainProcessBindingRecord[];
  malformed: MalformedDomainProcessBindingRecord[];
  ambiguous: AmbiguousDomainProcessBindingRecord[];
};
```

`scanOrgDomainProcessBindings`'s return type gains two fields — additive, doesn't break a consumer that
only reads `.records`/`.missing`. `scanLocalDomainProcessBindings` changes from returning a bare
`RawDomainProcessBindingRecord[]` to returning `DomainProcessLocalScanResult` — a breaking change to
`simply-aep-core`'s public surface (see Alternatives considered for why this is the right place to take
it). `domain-process-binding/list.ts`'s existing call site updates to destructure `{ records }` and
otherwise behaves identically — `list` doesn't consume `malformed`/`ambiguous` and keeps silently
excluding those records, unchanged from today.

### `validateDomainProcessBindings` (`simply-aep-core`)

```ts
export type DomainProcessBindingIssueSeverity = 'error' | 'warning';

export type DomainProcessBindingIssueRule =
  | 'order-collision'
  | 'missing-sobject-reference'
  | 'missing-context-field'
  | 'duplicate-developer-name'
  | 'ambiguous-sobject-reference';

export type DomainProcessBindingIssue = {
  severity: DomainProcessBindingIssueSeverity;
  rule: DomainProcessBindingIssueRule;
  message: string;
  developerName?: string;
  sobject?: string;
  source: string;
};

export function validateDomainProcessBindings(
  records: RawDomainProcessBindingRecord[],
  diagnostics: { malformed: MalformedDomainProcessBindingRecord[]; ambiguous: AmbiguousDomainProcessBindingRecord[] },
): DomainProcessBindingIssue[];
```

Plain function, no `Messages` dependency (matching every other `simply-aep-core` export, per
[0009](0009-aep-library-consumption.md)) — issue `message` strings are built directly in TypeScript.
Internally calls `resolveDomainProcessBindings(records)` for `order-collision` (one issue per flagged
row, not one per colliding pair, matching how `list` already annotates rows individually) and runs the
other four checks independently over `records` + `diagnostics`.

### Command behavior

`sf simply aep at4dx domain-process-binding validate` scans (same local/org logic as `list`, same
`--sobject` pre-filter applied to `records`, `malformed`, and `ambiguous` alike), calls
`validateDomainProcessBindings`, and:

1. Prints a table of issues (`SEVERITY`, `RULE`, `SOBJECT`, `DEVELOPER NAME`, `SOURCE`, `MESSAGE`) when
   `issues.length > 0`; otherwise prints an `info.valid` success message.
2. Always **returns** `{ source, bindingCount, issues }` — the full structured result — so `--json`
   output carries every issue's full detail regardless of pass/fail, the same way `list`'s `--json`
   output is unconditional.
3. Sets `process.exitCode = 1` when any issue has `severity: 'error'` (warnings alone don't fail the
   command). This is the refinement on the originally-discussed "`this.exit()`" approach: `this.exit()`
   throws immediately, which would skip `SfCommand`'s JSON-printing step and lose the structured issue
   list from `--json` output on the exact runs where it matters most. Setting `process.exitCode`
   directly lets `run()` return normally — `SfCommand` prints the JSON result exactly as it would for a
   clean run — while still failing the process for a CI caller checking the exit code.

### Errors

Same as `list` (`error.targetOrgOrSourceDirRequired`, `error.at4dxNotDetected`, `error.localScanFailed`,
`error.orgQueryFailed`) — this command shares the same "can't even see the bindings" failure modes,
which are distinct from "saw the bindings, found a problem" (that's an `issues` entry, not a thrown
error).

## Alternatives considered

**A `--strict`/`--fail-on-collision` flag on `list` instead of a new command.** Rejected: `list`'s job
is "show me the bindings," and its table is shaped for a human skimming execution order — cramming four
more issue types into annotated cells (only one of which, `order-collision`, even maps onto an existing
row) either clutters that table or requires printing rows for `malformed`/`duplicate` records that have
no real position in the execution-order table to sit in. A CI gate command that only prints a table when
something's wrong, and is silent (or minimal) when everything's fine, is a different shape than a
listing command — same reasoning [0008](0008-at4dx-domain-process-binding-list.md) already applied
between `binding list` and this package's own `list` sibling: one command per job, not one command
overloaded with a mode flag.

**Throwing an `SfError` when errors are found (matching `simply cicd deploy validate`'s
log-then-throw precedent).** Considered for consistency with an existing "validate" command in this
repo. Rejected here specifically because `--json` matters more for this command than for
`deploy validate` — the entire point of a structured `issues` array is for a caller (CI, or eventually
the VS Code extension) to parse _which_ bindings are broken, not just that something is. `SfCommand`'s
JSON envelope for a thrown error carries the message, not arbitrary structured data (no `SfError.data`
attachment convention exists anywhere in this repo to piggyback on), so throwing would mean `--json`
mode gives strictly less information on the runs where the caller needs it most. Returning the full
result and setting `process.exitCode` separately gets both a real CI-usable exit code and full `--json`
detail.

**Modeling "malformed"/"ambiguous" as extra fields on `RawDomainProcessBindingRecord` itself (e.g.
`sobject?: string`, `hasAmbiguousSObjectReference?: boolean`) instead of separate sibling arrays.**
Rejected: `sobject` is required today specifically because every consumer of `records` — `list`,
`resolveDomainProcessBindings` — can already assume a resolved SObject exists on every record they see.
Making it optional would push a null-check onto every existing consumer for a case that, for them,
should keep behaving exactly as it does today (silently excluded). Sibling arrays keep
`RawDomainProcessBindingRecord` and its existing consumers untouched and additive; only the scan result
envelope's shape changes.

**Taking the local scanner's breaking change as a reason to keep filtering silently and detect
`missing-sobject-reference` some other way (e.g. a second, separate raw-XML pass inside `validate`
only).** Rejected: that would mean two independent parsers for the same `DomainProcessBinding__mdt`
XML/query shape — one in the scanners, one duplicated inside validation — which is exactly the kind of
drift [0008](0008-at4dx-domain-process-binding-list.md)'s `customMetadataXml.ts` extraction was meant to
prevent. `simply-aep-core` is already pre-1.0 (`0.2.0`) and [0009](0009-aep-library-consumption.md)
already established that a breaking shape change here gets called out via conventional-commit `!`/
`BREAKING CHANGE:`, not avoided at the cost of a duplicated parser.

## Implementation plan

1. **`at4dxDomainProcessBindingTypes.ts`** — add `MalformedDomainProcessBindingRecord`,
   `AmbiguousDomainProcessBindingRecord`, `DomainProcessBindingIssueSeverity`,
   `DomainProcessBindingIssueRule`, `DomainProcessBindingIssue`.
2. **`at4dxDomainProcessOrgScan.ts`** — `toRawRecord` (or a sibling helper) also returns the malformed/
   ambiguous cases instead of only `undefined`; `scanOrgDomainProcessBindings` assembles `malformed` and
   `ambiguous` arrays alongside `records`.
3. **`at4dxDomainProcessLocalScan.ts`** — same change; `scanLocalDomainProcessBindings` returns
   `DomainProcessLocalScanResult` instead of a bare array.
4. **`at4dxDomainProcessResolve.ts`** — add `validateDomainProcessBindings`, reusing
   `resolveDomainProcessBindings` internally for `order-collision`.
5. **`packages/simply-aep/src/commands/simply/aep/at4dx/domain-process-binding/list.ts`** — update the
   `scanLocalDomainProcessBindings` call site for the new return shape (`{ records } = ...`); no other
   behavior change.
6. **`packages/simply-aep/src/commands/simply/aep/at4dx/domain-process-binding/validate.ts`** — new
   command: flags, exclusivity check, scan → `--sobject` filter → `validateDomainProcessBindings` →
   table-or-success-message → `process.exitCode`.
7. **`messages/simply.aep.at4dx.domain-process-binding.validate.md`** — summary, description, flag
   summaries, examples, the four shared error keys, `info.valid`/`info.invalid`.
8. **`src/index.ts`** barrel (`simply-aep-core`) — export the new function and types.
9. **Tests**:
   - `test/at4dxDomainProcessResolve.test.ts` (or a new `test/at4dxDomainProcessValidate.test.ts`) —
     one case per rule in the Testing table below.
   - `test/at4dxDomainProcessOrgScan.test.ts`, `test/at4dxDomainProcessLocalScan.test.ts` — malformed/
     ambiguous records surfaced correctly, well-formed records unaffected.
   - `test/index.test.ts` — exported-keys assertion updated.
   - `packages/simply-aep/test/commands/simply/aep/at4dx/domain-process-binding/validate.test.ts` —
     flag validation/error paths (mirroring `list.test.ts`), plus an end-to-end fixture that exercises
     `process.exitCode` being set on a failing run and left `0` on a clean one.
10. **Housekeeping**, per `CLAUDE.md`: `pnpm run readme` for both `simply-aep-core` (its `## API`
    section gains the new import) and `simply-aep` (new command reference); `pnpm run build` at the
    root so `command-snapshot.json` picks up the new command.
11. **Commit the local-scanner shape change as a breaking change** to `@simplysf/simply-aep-core`
    (`!`/`BREAKING CHANGE:` footer), per [0009](0009-aep-library-consumption.md)'s established
    convention for this package.

## Testing

**Unit** (`simply-aep-core`):

| Case                                                      | What it pins down                                                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Two active same-type records tied on `order`              | `order-collision`, `error` — delegates to the existing `resolveDomainProcessBindings` behavior.                               |
| Record with neither SObject field set                     | `missing-sobject-reference`, `error`.                                                                                         |
| `TriggerExecution` with blank `TriggerOperation__c`       | `missing-context-field`, `error`.                                                                                             |
| `DomainMethodExecution` with blank `DomainMethodToken__c` | `missing-context-field`, `error`.                                                                                             |
| Same `DeveloperName` from two different `source` values   | `duplicate-developer-name`, `error`.                                                                                          |
| Both SObject fields set, different values                 | `ambiguous-sobject-reference`, `warning` — and confirm the record still appears in `records` using the primary field's value. |
| Both SObject fields set, **same** value                   | No issue — not a real ambiguity.                                                                                              |
| Fully well-formed input, no collisions                    | Empty `issues` array.                                                                                                         |
| Empty input                                               | Empty `issues` array.                                                                                                         |

**Command** (`simply-aep`) — mirroring `list.test.ts`'s style (mocked `Connection`, temp-dir local
fixtures): flag exclusivity/`at4dxNotDetected`/scan-failure error paths (shared with `list`), plus:

| Case                                          | What it pins down                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Scan with zero issues                         | `process.exitCode` left unset/`0`; success message printed.                                    |
| Scan with only `warning`-severity issues      | `process.exitCode` left unset/`0`; issues still printed and returned.                          |
| Scan with at least one `error`-severity issue | `process.exitCode === 1`; `run()` still resolves with the full `issues` array (doesn't throw). |
| `--json` on a failing run                     | JSON output contains the full `issues` array, not an error envelope.                           |

**NUT** — none, matching both existing AT4DX commands (no NUT infrastructure exists yet for this
package).

## Open questions

- **Whether a `--fail-on-warning` flag is worth adding** once `ambiguous-sobject-reference` (or a future
  warning-severity rule) exists, for a CI caller that wants zero tolerance even for advisory issues. Not
  in this doc's initial scope — start with the two-tier severity model and revisit if a real project
  asks for it.
- **`simply-vscode/extensions/simply-at4dx`'s `at4dxCli.ts` type mirror** needs the same follow-up
  [0008](0008-at4dx-domain-process-binding-list.md) already left open, now also covering
  `DomainProcessBindingIssue` and the changed scan result shapes.
- **Namespaced AT4DX installs** — out of scope, same reasoning as
  [0007](0007-at4dx-binding-list.md)/[0008](0008-at4dx-domain-process-binding-list.md).

### Deferred to a v2 of this design (explicitly out of scope here)

Two enhancements were raised during design review and deliberately deferred rather than folded in, since
each adds a materially different kind of check (referential validation against schema/source, not just
shape validation of the binding records themselves) and deserves its own sizing:

- **Verify `RelatedDomainBindingSObject__c`/`RelatedDomainBindingSObjectAlternate__c` actually name an
  existing SObject.** Both fields are plain strings with no platform-enforced referential integrity (the
  org field is an `EntityDefinition` reference for the _primary_ field only — the Alternate field is a
  plain text field with no reference type at all) — nothing today stops either from naming a SObject
  that doesn't exist, or that existed and was deleted. Checking this needs a describe/global-describe
  call (org) or cross-referencing scanned SObject/Custom Object source components (local), which is a
  different, heavier kind of lookup than every check in this doc (all of which only need the
  `DomainProcessBinding__mdt` records themselves).
- **Verify `ClassToInject__c` actually names an Apex class that exists, checked against both `--target-org`
  and `--source-dir`.** Same shape of gap as the SObject check above (a plain string with no enforced
  reference), but the "check both org and source" requirement raised in review is broader than the
  local-only version originally scoped for this doc — for `--target-org`, it means an additional
  `ApexClass` query; for `--source-dir`, cross-referencing the same `ComponentSet` scan against
  `ApexClass` components. Both are real, valuable checks (a typo'd class name is a runtime reflection
  failure with no compile-time signal), just orthogonal enough in implementation cost to size and design
  separately.

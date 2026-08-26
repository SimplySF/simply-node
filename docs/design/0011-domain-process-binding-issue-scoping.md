# 0011 — Scoped domain-process-binding validation for interactive consumers

**Status:** Implemented
**Package:** `packages/simply-aep-core`, `packages/simply-aep`
**Date:** 2026-08-26

## Problem

[0010](0010-at4dx-domain-process-binding-validate.md) built `validateDomainProcessBindings` for a CI
gate: scan everything once, print every issue, set an exit code. That shape is right for a command
that runs once and exits. It is the wrong shape for the consumer 0010's own Open Questions named as
next — `simply-vscode/extensions/simply-at4dx`, which since
[0006 over there](https://github.com/SimplySF/simply-vscode/blob/main/docs/design/0006-at4dx-direct-library-imports.md)
imports these functions directly rather than shelling out to the CLI.

The extension's panel scans once and then shows **slices**: the user picks an SObject and a trigger
event from two dropdowns, and the webview re-renders from the already-fetched rows, client-side, with
no round trip. "Validate the bindings I'm looking at" therefore means projecting a whole-scan
validation onto the currently-visible slice — and the library gives a consumer no correct way to do
that today:

1. **Rule scope isn't expressed anywhere, so filtering before validating silently changes the
   answers.** `duplicate-developer-name` is inherently scan-scoped: it can only be computed by seeing
   every scanned record's name at once. `missing-sobject-reference` is worse — the records it reports
   have _no_ SObject by definition, so any SObject filter drops all of them. The four other rules are
   record-scoped and filter cleanly. Nothing in the types says which is which, so every consumer has
   to rediscover it by reading `at4dxDomainProcessResolve.ts`.

   This isn't hypothetical, and it isn't only the extension's problem: **our own `validate` command
   has this bug today.** `validate.ts` filters `records` by `--sobject` and _then_ validates, so
   `sf simply aep at4dx domain-process-binding validate --sobject Account` cannot detect a
   `DeveloperName` shared between an Account binding and a Contact binding — the exact conflict the
   rule exists to catch. It also passes `malformed` through unfiltered while filtering `ambiguous`,
   an unexplained asymmetry that is in fact the correct behavior for exactly the reason above, encoded
   as a convention in one call site rather than as a property of the rules.

2. **An issue can't be tied back to the row it's about.** The panel wants to badge the specific row
   on screen. `DomainProcessBindingIssue` carries `developerName`, `sobject?`, and `source`, and
   nothing states that `(developerName, source)` is meant to be the join key — or that it is exactly
   the pair that is _not_ unique in the case `duplicate-developer-name` exists to report.

3. **`message` is CLI table prose.** Each string leads with `` `${developerName}: ` `` and explains
   the rule inline, because it has to stand alone in a `MESSAGE` column. A UI wants a short rule
   label for a badge, a per-rule explanation for a tooltip, and the record identity rendered as its
   own element — not one sentence to string-match against.

4. **A local record doesn't carry the file it came from.** `source` is the package directory name
   (`deriveProjectName` deliberately throws away `component.xml`), so an editor-side consumer that
   wants "click the issue, open the offending `.md-meta.xml`" has to re-glob the workspace and guess.

## Decision

Add the scoping, identity, and presentation metadata that a viewing consumer needs, as **additive**
changes to `simply-aep-core`'s public surface — no breaking change this time, unlike
[0010](0010-at4dx-domain-process-binding-validate.md)'s scan-result reshape:

- Every rule gains a declared `scope` (`'record' | 'scan'`), exported both as a lookup table
  (`DOMAIN_PROCESS_BINDING_RULES`) and stamped onto each `DomainProcessBindingIssue` it produces.
- One projection function, `filterDomainProcessBindingIssues`, implements **validate-then-filter**
  with defined semantics for scan-scoped issues. It is the normative definition of the projection —
  `simply-aep`'s `validate` calls it, and the round-trip test in Testing is what pins its meaning.
  The VS Code panel cannot call it (its filtering happens inside a webview, a separate JS context with
  no access to this package), which is exactly why `scope` is stamped onto each issue as well: the
  client's filter is then a two-property check against data this package produced, not a hand-copied
  reimplementation of which rules are scan-scoped.
- `validateDomainProcessBindings` gains an overload taking a scan result envelope directly, since
  both real callers already hold one.
- The local scanner records each record's `filePath`.

And `packages/simply-aep`'s `validate` command switches to validate-then-filter, fixing the
`--sobject` + `duplicate-developer-name` gap above and printing scan-scoped issues in their own
section rather than pretending they belong to the filtered SObject.

The extension-side design that consumes all of this is
[0007 in `simply-vscode`](https://github.com/SimplySF/simply-vscode/blob/main/docs/design/0007-at4dx-validate-viewed-bindings.md).

## Behavior

### Rule scope

| Rule                          | Severity  | Scope    | Why                                                                                                                                                              |
| ----------------------------- | --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `order-collision`             | `error`   | `record` | A collision is computed within one (SObject, context, operation/token, type) group, so it never spans SObjects — filtering by SObject can't change the answer.   |
| `missing-context-field`       | `error`   | `record` | Depends on one record's own fields only.                                                                                                                         |
| `ambiguous-sobject-reference` | `warning` | `record` | Depends on one record's own two fields; the issue carries the primary SObject, which is what the record resolves as.                                             |
| `duplicate-developer-name`    | `error`   | `scan`   | Only computable across every scanned record. Two records sharing a `DeveloperName` routinely sit under different SObjects — filtering to one hides the conflict. |
| `missing-sobject-reference`   | `error`   | `scan`   | The reported records have no SObject at all, so no SObject filter can ever match them.                                                                           |

"Record-scoped" means precisely: _filtering the issue list by SObject after validating gives the same
result as filtering the records by SObject before validating._ That equivalence is what makes
validate-once-project-many safe, and it's what the tests in Testing pin down.

### `DOMAIN_PROCESS_BINDING_RULES`

```ts
export type DomainProcessBindingIssueScope = 'record' | 'scan';

export type DomainProcessBindingRuleInfo = {
  rule: DomainProcessBindingIssueRule;
  severity: DomainProcessBindingIssueSeverity;
  scope: DomainProcessBindingIssueScope;
  /** Short label for a badge or table cell, e.g. `Order collision`. */
  title: string;
  /** One sentence on what the rule detects, independent of any one record — tooltip/help copy. */
  summary: string;
};

export const DOMAIN_PROCESS_BINDING_RULES: Readonly<
  Record<DomainProcessBindingIssueRule, DomainProcessBindingRuleInfo>
>;
```

`severity` moves here as its single source of truth; `validateDomainProcessBindings` reads it from
this table when constructing an issue rather than repeating the literal at each `issues.push` site.
`title`/`summary` are plain English in TypeScript, not `Messages` keys — `simply-aep-core` stays
`Messages`-free, per [0009](0009-aep-library-consumption.md).

### `DomainProcessBindingIssue` additions

```ts
export type DomainProcessBindingIssue = {
  severity: DomainProcessBindingIssueSeverity;
  rule: DomainProcessBindingIssueRule;
  /** Copied from `DOMAIN_PROCESS_BINDING_RULES[rule].scope` — see below for why it's duplicated. */
  scope: DomainProcessBindingIssueScope;
  message: string;
  developerName?: string;
  sobject?: string;
  source: string;
  /** Absolute path to the `.md-meta.xml` this record was parsed from. Local scans only. */
  filePath?: string;
};
```

`scope` is redundant with the rules table on purpose. An issue that has crossed a `--json` boundary —
or a `postMessage` into a webview, which is the extension's actual case — arrives without the table,
and the alternative is every such consumer hard-coding its own copy of the five-rule mapping. Making
the issue self-describing means the consumer-side projection is `issue.scope === 'scan'`, a property
check, rather than rule knowledge duplicated in a second language. The table stays the source of
truth; `validateDomainProcessBindings` is the only thing that copies from it.

### Issue identity

`(developerName, source)` is the documented join key from an issue back to a
`RawDomainProcessBindingRecord`, and this doc makes it an invariant rather than a coincidence:

- **Local:** `source` is the package directory containing `customMetadata/`, and two
  `DomainProcessBinding.<name>.md-meta.xml` files can't share a name within one directory.
- **Org:** `source` is the username and `DeveloperName` is the CMDT's unique name field.

The one hole: two `--source-dir` roots whose package directories share a _basename_ (say
`sfdx-source/core` and `vendor/core`) both derive `source: 'core'`. That's precisely a
`duplicate-developer-name` situation, and it's why `filePath` is added — for local scans it is the
unambiguous identity, and a consumer that needs to distinguish two same-named records should key on it.
`RawDomainProcessBindingRecord` and both diagnostic record types gain the same optional `filePath`.

No synthetic id is introduced. A generated key would have to be stable across a re-scan to be useful
to a UI, which makes it a hash of exactly the fields above — the same information with an extra layer.

### `filterDomainProcessBindingIssues`

```ts
export function filterDomainProcessBindingIssues(
  issues: DomainProcessBindingIssue[],
  filter: { sobjects?: string[] },
): { inScope: DomainProcessBindingIssue[]; scanWide: DomainProcessBindingIssue[] };
```

- `inScope`: record-scoped issues whose `sobject` is in `filter.sobjects` (every record-scoped issue
  when `sobjects` is omitted or empty).
- `scanWide`: every `scope: 'scan'` issue, **always, unfiltered**. A scan-scoped issue is never
  silently dropped by a filter — that's the failure mode this whole doc exists to prevent. A caller
  that genuinely wants only the filtered slice ignores `scanWide`; a caller that shows counts is
  forced by the return shape to decide what to do with it rather than losing it by omission.

Returning a partition rather than one array is deliberate: the two halves get presented differently
(`validate` prints them as separate tables; the VS Code panel groups them as "in this SObject" and
"elsewhere in this scan"), and a single concatenated array would make "how many problems are in what
I'm looking at?" unanswerable without re-deriving the split.

### `validateDomainProcessBindings` overload

```ts
export function validateDomainProcessBindings(
  scan: Pick<DomainProcessLocalScanResult, 'records' | 'malformed' | 'ambiguous'>,
): DomainProcessBindingIssue[];
export function validateDomainProcessBindings(
  records: RawDomainProcessBindingRecord[],
  diagnostics: { malformed: MalformedDomainProcessBindingRecord[]; ambiguous: AmbiguousDomainProcessBindingRecord[] },
): DomainProcessBindingIssue[];
```

Both scan functions already return exactly that envelope (`DomainProcessOrgScanResult` structurally
satisfies it), and both known callers destructure it apart only to hand the pieces back in. The
two-argument form stays — 0010 shipped it and it's the right call when a caller has assembled records
from somewhere else — so this is purely additive.

### `validate` command changes (`packages/simply-aep`)

`--sobject` becomes a projection over issues instead of a pre-filter over records:

|                                                                                       | Today                                                                       | After                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Order of operations                                                                   | filter records → validate                                                   | validate whole scan → `filterDomainProcessBindingIssues`                                                                                                                                                       |
| `--sobject Account` with a `DeveloperName` shared by an Account and a Contact binding | Not reported                                                                | Reported, under Scan-wide issues                                                                                                                                                                               |
| `--sobject Account` with a malformed record                                           | All malformed records reported, via the unfiltered `malformed` pass-through | Same records reported, now because they're scan-scoped by rule                                                                                                                                                 |
| Output                                                                                | One table                                                                   | Same table for in-scope issues, plus a `Scan-wide issues` table when `scanWide` is non-empty and a `--sobject` filter is active (without a filter there's no distinction worth drawing, so it stays one table) |
| `bindingCount` in the result                                                          | Count of filtered records                                                   | Unchanged                                                                                                                                                                                                      |
| Exit code                                                                             | `1` if any issue is `error`                                                 | Unchanged — computed over `inScope` **and** `scanWide`, which is what makes the duplicate case above actually fail CI                                                                                          |

`--json` output gains `scope`/`filePath` on each issue and is otherwise the same
`At4dxDomainProcessBindingValidateResult` shape: `issues` stays one flat array (both halves
concatenated, `inScope` first), since a JSON consumer has `scope` on every element and doesn't need
the presentational split. `list` is untouched.

This is a user-visible behavior change to a shipped command, so it ships as a `fix(simply-aep)` for
the `--sobject` correctness gap plus `feat(simply-aep-core)` for the additive API — not a breaking
change, since no output field is removed and no previously-reported issue stops being reported.

## Alternatives considered

**Do nothing in this repo; let the extension filter issues itself.** It would work today, by
hard-coding "these two rules are scan-scoped" in TypeScript on the other side of a repo boundary —
the exact drift [0006 over there](https://github.com/SimplySF/simply-vscode/blob/main/docs/design/0006-at4dx-direct-library-imports.md)
and [0009](0009-aep-library-consumption.md) were both written to stop. A sixth rule added here would
be silently mis-scoped there, with no test in either repo that fails. And it leaves our own
`--sobject` bug unfixed, since that bug is the same missing concept.

**Make `validateDomainProcessBindings` take the SObject filter as a parameter** (e.g.
`validate(scan, { sobjects })`) instead of validating everything and projecting after. Rejected: it
reads like it fixes the problem while preserving it — a caller that passes `sobjects` still gets a
`duplicate-developer-name` answer computed over a subset, unless the function internally validates
everything and filters, at which point the filter parameter is just `filterDomainProcessBindingIssues`
with a worse name and no way to see what was filtered out. Keeping the two steps separate makes the
"validate the whole scan, always" rule structural: there is no argument you can pass to make it not
happen.

**Split into `validateRecordScoped` / `validateScanScoped` functions instead of tagging issues with a
scope.** Rejected: it pushes the same knowledge into function selection, so a consumer must call both
and remember which result is safe to filter — and the CLI, which wants one flat list, would have to
re-merge them. A `scope` field travels with the data through `--json` and `postMessage`; a function
boundary doesn't.

**Put `title`/`summary` in `simply-aep`'s `messages/*.md` and have the extension duplicate the copy.**
Rejected: the extension can't read another package's `messages/` (it isn't a plugin, and
`simply-aep-core` deliberately has no `Messages` dependency), so this guarantees two copies of the
rule descriptions that drift. Plain strings in the library are the only place both consumers can share.

**Have the local scanner return the `SourceComponent` (or the full parsed XML) so consumers can get
the path and anything else they want.** Rejected: it makes `@salesforce/source-deploy-retrieve`'s types
part of this package's public API for the benefit of one string, and pins consumers to our SDR major
version. `filePath: string` is the entire ask.

**Give `RawDomainProcessBindingRecord` a `line`/`range` too, so a consumer could render editor
squiggles.** Rejected here, deliberately: the CMDT XML is parsed with SDR's `parseXmlSync`, which
returns a plain object with no positional information, so offsets would need a second, position-aware
parse of every file — real work, for a feature no one has designed yet. `simply-vscode`'s 0007 records
this as the reason it renders issues in its own panel instead of VS Code's Problems view; if that view
is ever wanted, it gets its own doc and this is the change it starts from.

## Implementation plan

1. **`at4dxDomainProcessBindingTypes.ts`** — add `DomainProcessBindingIssueScope`,
   `DomainProcessBindingRuleInfo`, `DOMAIN_PROCESS_BINDING_RULES`; add `scope` and `filePath?` to
   `DomainProcessBindingIssue`; add `filePath?` to `RawDomainProcessBindingRecord`,
   `MalformedDomainProcessBindingRecord`, `AmbiguousDomainProcessBindingRecord`.
2. **`at4dxDomainProcessLocalScan.ts`** — thread `component.xml` through `toRawRecord` onto all three
   record shapes, alongside the existing `deriveProjectName(component.xml)` call that already has it.
3. **`at4dxDomainProcessOrgScan.ts`** — no change (no file to report); confirms `filePath` is
   genuinely optional rather than "undefined for now."
4. **`at4dxDomainProcessResolve.ts`** — read `severity` from `DOMAIN_PROCESS_BINDING_RULES`, stamp
   `scope` and pass `filePath` through on every issue; add the scan-envelope overload; add
   `filterDomainProcessBindingIssues`.
5. **`src/index.ts`** barrel — export the new function, constant, and types.
6. **`packages/simply-aep/.../validate.ts`** — validate the unfiltered scan, then
   `filterDomainProcessBindingIssues`; print the second table when a filter is active and `scanWide`
   is non-empty; compute the exit code over both halves; return `[...inScope, ...scanWide]`.
7. **`messages/simply.aep.at4dx.domain-process-binding.validate.md`** — new `info.scanWideHeader` key;
   amend `flags.sobject.summary` to say the filter applies to issues that name an SObject and that
   scan-wide issues are always reported.
8. **Tests** (see Testing).
9. **Housekeeping**, per `CLAUDE.md`: `pnpm run readme` in `simply-aep-core` (its `## API` table gains
   the new exports) and in `simply-aep`; `pnpm run build` at the root for `command-snapshot.json`.
10. **Cross-reference** — add a pointer from
    [0010](0010-at4dx-domain-process-binding-validate.md)'s `--sobject` behavior to this doc, so that
    doc doesn't sit describing filter-then-validate as current. Add this row to the index table.

## Testing

**Unit** (`simply-aep-core`):

| Case                                                                                                                            | What it pins down                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Every `DomainProcessBindingIssueRule` has an entry in `DOMAIN_PROCESS_BINDING_RULES`                                            | The table can't fall behind the union type when a sixth rule is added.                                                      |
| Every issue's `severity`/`scope` equals its rule's table entry                                                                  | The stamped copies can't drift from the source of truth.                                                                    |
| **Round-trip:** for each record-scoped rule, `validate(all)` then filter by SObject === `validate(records filtered by SObject)` | The equivalence that makes validate-once-project-many correct. This is the test that would have caught the `--sobject` bug. |
| Duplicate `DeveloperName` across an Account record and a Contact record, filtered to `Account`                                  | Reported in `scanWide`, not dropped — the bug being fixed.                                                                  |
| Malformed record, any SObject filter                                                                                            | Reported in `scanWide`.                                                                                                     |
| `filterDomainProcessBindingIssues(issues, {})` and `{ sobjects: [] }`                                                           | Every record-scoped issue in `inScope`; no filtering.                                                                       |
| Local scan of a fixture directory                                                                                               | `filePath` is the actual `.md-meta.xml` path on records and on both diagnostic shapes.                                      |
| Org scan                                                                                                                        | `filePath` is `undefined` throughout.                                                                                       |
| `validateDomainProcessBindings(scanResult)` vs. the two-argument form on the same data                                          | Identical output — the overload is a convenience, not a second implementation.                                              |
| `test/index.test.ts` exported-keys assertion                                                                                    | Updated for the new exports (existing convention).                                                                          |

**Command** (`simply-aep`), extending `validate.test.ts`:

| Case                                                       | What it pins down                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `--sobject` with a cross-SObject duplicate `DeveloperName` | `process.exitCode === 1` and the issue present in `--json` — end to end. |
| `--sobject` with only in-scope issues                      | No `Scan-wide issues` table printed.                                     |
| No `--sobject`                                             | Single table, byte-identical to today's output for the same input.       |
| `--json`                                                   | `issues` flat, `inScope` first, every element carrying `scope`.          |

**NUT** — none, matching every other AT4DX command.

## Open questions

- **Should `list` surface `filePath` too?** It's on the row type either way once the scanner sets it,
  and `--json` consumers would get it for free, but no `list` column is proposed here — the table is
  already wide. Left to whoever wants it.
- **A `--scope` flag on `validate`** (`record` / `scan` / `all`) for a CI caller that wants to gate
  only on issues within a filtered SObject. Not proposed: no one has asked, and the safe default
  (never lose a scan-scoped error) is the one that belongs in a gate.
- **The two deferred v2 rules from [0010](0010-at4dx-domain-process-binding-validate.md)** — verifying
  the SObject and `ClassToInject__c` actually exist — are both record-scoped _and_ need I/O (a describe
  call, or an Apex class cross-reference). Nothing in this doc blocks them, but they'd be the first
  rules whose evaluation isn't free, which matters for a consumer like the extension that currently
  gets validation at no cost. Whichever doc adds them should say what that means for an interactive
  caller.

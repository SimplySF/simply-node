# 0012 — `simply aep at4dx domain-process-binding create` / `set`

**Status:** Draft
**Package:** `packages/simply-aep-core`, `packages/simply-aep`
**Date:** 2026-08-26

## Problem

`simply-aep`/`simply-aep-core` can read AT4DX `DomainProcessBinding__mdt` wiring
([0008](0008-at4dx-domain-process-binding-list.md) `list`,
[0010](0010-at4dx-domain-process-binding-validate.md)/[0011](0011-domain-process-binding-issue-scoping.md)
`validate`) but there is no way to author it. Adding or changing a binding today means hand-writing a
`DomainProcessBinding.<Name>.md-meta.xml` file from memory — the `<label>`/`<protected>`/`<values>` XML
shape, `xsi:type` quirks, booleans serialized as the strings `"true"`/`"false"`, and the org-vs-source
difference between an `EntityDefinition` reference and a plain API name — or clicking through Setup. In
both cases, none of the wiring-correctness checks `validate` already knows how to run get applied until
some later CI run, if ever.

This is also the concrete forcing function [0008](0008-at4dx-domain-process-binding-list.md) and
[0011](0011-domain-process-binding-issue-scoping.md) both leave as an open question:
`simply-vscode/extensions/simply-at4dx`'s companion panel wants an "add/edit binding" UI, and per
[0009](0009-aep-library-consumption.md) it imports `simply-aep-core` functions directly rather than
shelling out — so the record-building logic needs to live there, not only behind a CLI command.

## Decision

Add two commands to `packages/simply-aep` — `domain-process-binding create` and
`domain-process-binding set` — plus the record-building and writing functions they call in
`packages/simply-aep-core`, so `simply-vscode/extensions/simply-at4dx` can call the same functions
directly.

Both commands are fundamentally **local-source generators**: they compute a target
`.md-meta.xml` file's full contents in memory and write it to a directory, in exactly the shape
`scanLocalDomainProcessBindings` already parses. Writing to a connected org is additive, not an
alternative source: given `--target-org`, the same file content is deployed with
`ComponentSet.fromSource`, the pattern already proven in
`packages/simply-community/src/commands/simply/community/url/set.ts`'s `--deploy` path. Because of
this, **`--source-dir` and `--target-org` are not mutually exclusive here**, unlike every existing
AT4DX command's read-side flags — a deliberate divergence from
[0008](0008-at4dx-domain-process-binding-list.md)/[0010](0010-at4dx-domain-process-binding-validate.md)'s
XOR rule (see Alternatives considered).

Both commands run the existing `validateDomainProcessBindings` against the full record set the write
would produce — before writing anything — and refuse to write (non-zero exit, no file touched, nothing
deployed) if that set contains any `error`-severity issue, unless `--force` is passed. This reuses
[0010](0010-at4dx-domain-process-binding-validate.md)/[0011](0011-domain-process-binding-issue-scoping.md)'s
rules rather than re-deriving "is this binding going to work," and follows the same reasoning
[0008](0008-at4dx-domain-process-binding-list.md) gives for `orderCollision` existing at all: better to
refuse a silent runtime bug than author a `DeveloperName` that will never fire, or that collides with one
that already exists.

Both commands populate `RelatedDomainBindingSObject__c` by default and never populate both fields at
once — [0010](0010-at4dx-domain-process-binding-validate.md)'s `ambiguous-sobject-reference` rule and the
field's own description ("only specify... or this one; not both") make setting both a known-bad pattern,
so the two fields are always exactly one write target, never two. But `RelatedDomainBindingSObjectAlternate__c`
is not a legacy fallback to avoid — it's the *only* way to bind against certain Setup objects (e.g.
`ServiceResource`) that cannot be referenced through an `EntityDefinition`-type field at all. A generator
that only ever wrote the Primary field would be unable to author a real, valid binding for exactly those
objects. `--sobject-alternate` (see Behavior) makes the target field an explicit choice instead of an
implicit default, so the common case (Primary, which gets real referential validation at deploy time) stays
the default while the Setup-object case stays fully supported.

## Behavior

### `domain-process-binding create`

```sh
sf simply aep at4dx domain-process-binding create \
  --source-dir sfdx-source/core \
  --developer-name Account_Before_Insert_Assign_Owner \
  --sobject Account --process-context TriggerExecution --trigger-operation Before_Insert \
  --type Action --class-to-inject AccountAssignOwnerAction --order 10

sf simply aep at4dx domain-process-binding create \
  --target-org my-scratch \
  --developer-name Account_Before_Insert_Assign_Owner \
  --sobject Account --process-context TriggerExecution --trigger-operation Before_Insert \
  --type Action --class-to-inject AccountAssignOwnerAction --order 10

sf simply aep at4dx domain-process-binding create \
  --source-dir sfdx-source/core --target-org my-scratch \
  --developer-name Account_Before_Insert_Assign_Owner --label "Account Assign Owner" \
  --sobject Account --process-context TriggerExecution --trigger-operation Before_Insert \
  --type Action --class-to-inject AccountAssignOwnerAction --order 10 --description "Assigns the default owner"

sf simply aep at4dx domain-process-binding create \
  --source-dir sfdx-source/core \
  --developer-name ServiceResource_Before_Update_Sync \
  --sobject ServiceResource --sobject-alternate \
  --process-context TriggerExecution --trigger-operation Before_Update \
  --type Action --class-to-inject ServiceResourceSyncAction --order 10
```

`requiresProject = false`. At least one of `--target-org`/`--source-dir` is required (both may be given);
this is the one place an AT4DX command's flag rule is not XOR — see Alternatives considered.

#### Flags

| Flag                     | Char | Required | Purpose                                                                                                                                              |
| ------------------------ | ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--source-dir`           | `-d` | No\*     | The package directory to create `customMetadata/DomainProcessBinding.<name>.md-meta.xml` under (created if absent). Exactly one — not `multiple`, unlike `list`/`validate`, since a create needs one destination, not a search scope. |
| `--target-org`           | `-o` | No\*     | Deploy the generated record to this org after writing/building it.                                                                                    |
| `--api-version`          |      | No       | Standard org API version override.                                                                                                                    |
| `--wait`                 |      | No       | Deploy poll timeout in minutes, only meaningful with `--target-org`. Default `33`, matching `simply community url set`.                               |
| `--developer-name`       | `-n` | Yes      | `DeveloperName`. Must match `^[A-Za-z][A-Za-z0-9_]*$`, max 40 chars, no consecutive/trailing underscore.                                              |
| `--label`                |      | No       | `label`. Defaults to `--developer-name` verbatim. Max 40 chars.                                                                                       |
| `--sobject`              | `-s` | Yes      | The SObject API name to bind against.                                                                                                                  |
| `--sobject-alternate`    |      | No       | Write `--sobject` to `RelatedDomainBindingSObjectAlternate__c` instead of `RelatedDomainBindingSObject__c`. For SObjects that can't be referenced through an `EntityDefinition` field at all (e.g. `ServiceResource` and other Setup objects) — see Decision. `allowNo: true`, **no `default`** (tri-state `true`/`false`/unset — `set` relies on "unset" meaning "don't change this"; `create` treats unset the same as `false`). Never sets both fields. |
| `--process-context`      |      | Yes      | `TriggerExecution` \| `DomainMethodExecution`.                                                                                                        |
| `--trigger-operation`    |      | See note | One of `ALL_TRIGGER_OPERATIONS`. Required (and only allowed) when `--process-context TriggerExecution`.                                              |
| `--domain-method-token`  |      | See note | Required (and only allowed) when `--process-context DomainMethodExecution`.                                                                           |
| `--type`                 | `-t` | Yes      | `Action` \| `Criteria`.                                                                                                                                |
| `--class-to-inject`      | `-c` | Yes      | `ClassToInject__c`.                                                                                                                                    |
| `--order`                |      | Yes      | `OrderOfExecution__c`. Numeric, decimals allowed (AT4DX convention: same integer "slot" with a Criteria/Action decimal split, per [0008](0008-at4dx-domain-process-binding-list.md)). |
| `--active`               |      | No       | `IsActive__c`. Default `true`. `allowNo` (`--no-active`).                                                                                              |
| `--execute-asynchronous` |      | No       | `ExecuteAsynchronous__c`. Default `false`.                                                                                                            |
| `--logical-inverse`      |      | No       | `LogicalInverse__c`. Default `false`.                                                                                                                 |
| `--prevent-recursive`    |      | No       | `PreventRecursive__c`. Default `false`.                                                                                                               |
| `--description`          |      | No       | `Description__c`.                                                                                                                                     |
| `--force`                |      | No       | Write/deploy even if validation finds an `error`-severity issue. Validation still runs and its issues are still printed/returned.                    |

\* At least one of `--source-dir`/`--target-org` required; both may be given.

#### Resolution

1. Parse and cross-check flags (`--trigger-operation`/`--domain-method-token` match `--process-context`;
   `--developer-name`/`--label` format).
2. Scan for context: `scanLocalDomainProcessBindings([sourceDir])` if `--source-dir` given, else
   `scanOrgDomainProcessBindings(connection)`. (When both are given, the local scan is the validation
   context — see Alternatives considered.)
3. If a record with this `DeveloperName` already exists in that scan → `error.developerNameAlreadyExists`.
4. Build the candidate `RawDomainProcessBindingRecord` from flags (`sobjectField: 'alternate'` when
   `--sobject-alternate` is truthy, else `'primary'`), append it to the scanned `records`, and
   call `validateDomainProcessBindings({ records: [...records, candidate], malformed, ambiguous })`. Print
   any issues. If any is `error`-severity and `--force` is not set → throw `error.validationFailed`
   (nothing written).
5. Serialize the candidate with `buildDomainProcessBindingXml` (see below).
6. Write `<source-dir>/customMetadata/DomainProcessBinding.<DeveloperName>.md-meta.xml` when `--source-dir`
   is given. When only `--target-org` is given, write the same content to a temp directory instead (never
   touching the working tree).
7. When `--target-org` is given, deploy that exact file with `ComponentSet.fromSource` and poll to a
   terminal state; delete the temp directory afterward if that's what was used.

### `domain-process-binding set`

```sh
sf simply aep at4dx domain-process-binding set \
  --source-dir sfdx-source/core --source-dir sfdx-source/app \
  --developer-name Account_Before_Insert_Assign_Owner --order 20 --no-active

sf simply aep at4dx domain-process-binding set \
  --target-org my-scratch --developer-name Account_Before_Insert_Assign_Owner --class-to-inject AccountAssignOwnerActionV2
```

`requiresProject = false`. Same "at least one, both allowed" rule as `create`.

#### Flags

Same flag set as `create`, with these differences:

| Flag               | Difference from `create`                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--source-dir`     | `multiple: true` — a search scope across one or more roots, same convention as `list`/`validate`, since `set` locates an existing file rather than choosing where to create one. |
| `--developer-name` | Identifies the record to update; not itself updatable (renaming a `DeveloperName` is a delete+create from Salesforce's perspective — out of scope, see Open questions). |
| All field flags    | Optional. Only the ones supplied are changed; every other field keeps its current value from the found record.                                       |

At least one field flag beyond `--developer-name` must be given, or `error.noFieldsToUpdate`.

#### Resolution

1. Locate the existing record:
   - `--source-dir` given (regardless of whether `--target-org` is also given): `scanLocalDomainProcessBindings(sourceDirs)`, find by `developerName`. Not found → `error.developerNameNotFound`. The match's `filePath` is what gets rewritten.
   - `--source-dir` absent, `--target-org` given: `scanOrgDomainProcessBindings(connection)`, find by `developerName`. Not found → `error.developerNameNotFound`.
2. Merge the given field flags onto the found record (unset flags keep the found value) — including
   `sobjectField` (see `RawDomainProcessBindingRecord` change below): `--sobject-alternate` is a tri-state
   flag with no default, so "not passed" means "keep the found record's existing field," `--sobject-alternate`/`--no-sobject-alternate`
   explicitly override it. This matters specifically because the found record doesn't otherwise say which
   underlying field it came from — without it, a `set` that only touches an unrelated field (e.g. `--order`)
   on a `ServiceResource`-style binding would silently rewrite it onto `RelatedDomainBindingSObject__c`,
   which can't reference that SObject at all, breaking a binding `set` never meant to touch.
3. Validate exactly as `create` step 4, using the found record's scan set with the merged record substituted for the original.
4. Serialize with `buildDomainProcessBindingXml`.
5. Write to the found `filePath` (local mode) or a temp directory (org-only mode), then deploy if `--target-org` is given — same as `create` steps 6–7.

### `RawDomainProcessBindingRecord` addition (`simply-aep-core`)

```ts
export type DomainProcessBindingSObjectField = 'primary' | 'alternate';

export type RawDomainProcessBindingRecord = {
  // ...existing fields
  /** Which underlying field `sobject` was read from: `RelatedDomainBindingSObject__c` ('primary') or
   *  `RelatedDomainBindingSObjectAlternate__c` ('alternate'). Needed so `set` can preserve an
   *  Alternate-field binding (e.g. a Setup object like `ServiceResource`) when it only changes an
   *  unrelated field — see `set`'s Resolution. */
  sobjectField: DomainProcessBindingSObjectField;
};
```

Additive to both scanners' `toRawRecord`: local scan sets it from which of the two XML fields resolved
(primary preferred, matching the existing fallback); org scan sets it from `resolveSObject`'s existing
primary/alternate branch. Matches [0011](0011-domain-process-binding-issue-scoping.md)'s precedent of
adding fields to this type additively rather than reshaping it.

### `buildDomainProcessBindingXml` (`simply-aep-core`)

```ts
export function buildDomainProcessBindingXml(
  record: Pick<
    RawDomainProcessBindingRecord,
    | 'sobject' | 'sobjectField' | 'processContext' | 'triggerOperation' | 'domainMethodToken' | 'type'
    | 'classToInject' | 'order' | 'isActive' | 'executeAsynchronous' | 'logicalInverse' | 'preventRecursive'
    | 'description'
  >,
  meta: { label: string; developerName: string },
): string;
```

A pure function producing the full `.md-meta.xml` text — header, `<label>`, `<protected>false</protected>`,
then one `<values>` block per field, mirroring exactly the shape
`test/at4dxDomainProcessLocalScan.test.ts`'s fixtures already assert (`xsi:type="xsd:double"` for `order`,
`xsi:type="xsd:boolean"` for the four boolean fields, `xsi:nil="true"` for an absent
`triggerOperation`/`domainMethodToken`/`description`, plain string otherwise). Writes `sobject` to
`RelatedDomainBindingSObject__c` when `sobjectField` is `'primary'`, or to
`RelatedDomainBindingSObjectAlternate__c` when `'alternate'` — always exactly one of the two, emitting the
other as `xsi:nil="true"` rather than omitting it, so a re-scan of the written file never sees both fields
populated (which would itself be an `ambiguous-sobject-reference`). `protected` is always `false` —
nothing in this doc's scope needs a managed-package-protected binding.

This is the one new low-level XML helper needed; it lives in `customMetadataXml.ts` as the write-side
counterpart to `extractValues`/`fieldValue` (e.g. a shared `buildValuesXml(entries)` used by
`buildDomainProcessBindingXml`), so the header/values XML shape stays defined in one place for both
directions.

### Deploying (`simply-aep-core`)

A small `deployMetadataFile(connection, filePath, wait)` helper, structurally the same as
`packages/simply-community/src/common/deployChangedFiles.ts` (build a `ComponentSet.fromSource`, deploy,
poll, map file responses to successes/failures) but scoped to a single file and added directly to
`simply-aep-core` rather than imported cross-package — see Alternatives considered for why this isn't
hoisted into `simply-core` in this doc.

### Result shapes

```ts
export type At4dxDomainProcessBindingWriteResult = {
  developerName: string;
  sobject: string;
  filePath?: string; // absent when written only to a temp dir for a --target-org-only run
  deploy?: { id: string; status: string; success: boolean };
  issues: DomainProcessBindingIssue[]; // full validation result, even when --force was used
};
```

Shared by `create` and `set` (`At4dxDomainProcessBindingCreateResult`/`...SetResult` as named aliases, no
structural difference).

### Errors

| Condition                                                                          | Behavior                          |
| ----------------------------------------------------------------------------------- | ---------------------------------- |
| Neither `--source-dir` nor `--target-org` given                                     | `error.sourceDirOrTargetOrgRequired` |
| `--trigger-operation`/`--domain-method-token` given without/mismatched `--process-context` | `error.contextFieldMismatch`    |
| `--developer-name` fails the format check                                           | `error.invalidDeveloperName`      |
| `--label` (or the default) exceeds 40 characters                                    | `error.labelTooLong`              |
| `create`: `DeveloperName` already exists in the scanned scope                       | `error.developerNameAlreadyExists`|
| `set`: `DeveloperName` not found in the scanned scope                               | `error.developerNameNotFound`     |
| `set`: no field flags given besides `--developer-name`                              | `error.noFieldsToUpdate`          |
| Validation finds an `error`-severity issue and `--force` is not set                 | `error.validationFailed` (issues still printed/returned) |
| `DomainProcessBinding__mdt` doesn't exist (org `INVALID_TYPE`, or local scan finds nothing and `set` needed to find a record) | `error.at4dxNotDetected` |
| Local scan/write fails                                                              | `error.localScanFailed` / `error.localWriteFailed`, wrapping the message |
| Org query fails for a reason other than "type doesn't exist"                        | `error.orgQueryFailed`, wrapping the message |
| Deploy fails                                                                         | `error.deployFailed`, wrapping the failure summary (matching `simply community url set`) |

## Alternatives considered

**Keeping `--source-dir`/`--target-org` mutually exclusive, matching every existing AT4DX command.**
Rejected for writes specifically: a read has exactly one place to read from, so XOR is the only sensible
rule. A write has two independent, non-conflicting destinations — "put it in source control" and "make it
live in this org" — and forcing a choice would mean either running the command twice (once to write, once
to deploy — at which point the deploy step is just `sf project deploy start`, making this command a worse
version of that) or dropping the org-write feature the Problem section asks for. `simply community url
set` already establishes the "one write, optional `--deploy`" shape; this doc's version doesn't need a
separate `--deploy` flag because presence of `--target-org` alone already says "and put it in this org,"
with no ambiguous third state to disambiguate.

**A single `save` (upsert) command instead of separate `create`/`set`.** Considered and rejected — see the
command-shape decision made before writing this doc. A typo'd `--developer-name` on what the user believes
is an update would silently create an unrelated new binding instead of erroring, which is a worse failure
mode than requiring the user to pick the right verb.

**Never writing `RelatedDomainBindingSObjectAlternate__c`, only ever `RelatedDomainBindingSObject__c`.**
This was this doc's original position and is wrong: certain Setup objects (`ServiceResource` is the
concrete example) cannot be referenced through an `EntityDefinition`-type field at all, so the Alternate
field isn't a legacy fallback — it's the only way to author a valid binding against those objects.
Refusing to write it would make this command unable to produce a real, correct binding for a real category
of SObjects. `--sobject-alternate` makes the target field explicit instead. The one thing that stays
rejected is auto-detecting which field to use (e.g. a describe call to check whether the SObject supports
`EntityDefinition`): it would require an org connection even in `--source-dir`-only mode, where no
connection exists to ask, and 0010's `ambiguous-sobject-reference` rule already makes "guess wrong" cheap
to avoid by simply always writing exactly one field, explicitly chosen.

**Hoisting `deployChangedFiles`/`deployMetadataFile` into `simply-core` as a shared utility**, since
`simply-community` and `simply-aep-core` would then both need the same ~25-line "deploy exactly these
files" function. Deferred rather than done here: `simply-core` doesn't currently depend on
`@salesforce/source-deploy-retrieve`, and CLAUDE.md's design-doc bar for a new shared module is exactly the
kind of decision this doc shouldn't make as a side effect of an unrelated feature. Duplicating the small
function into `simply-aep-core` (which already depends on `@salesforce/source-deploy-retrieve` for
`scanLocalDomainProcessBindings`) keeps this doc's blast radius to the two packages it's actually about.
Revisit if a third consumer needs the same helper.

**Blocking the write only on issues that involve the specific record being created/changed**, rather than
any `error`-severity issue in the whole validated scope. Rejected for consistency and simplicity: `validate`
itself has no such per-record carve-out (it fails on any error, anywhere), and re-deriving "did my change
cause this" would need to diff the issue set before-and-after — real complexity for a benefit (not blocking
on a pre-existing, unrelated problem) that `--force` already covers just as well, with the added upside of
surfacing a pre-existing landmine at the exact moment someone is already touching the file.

**Supporting a `--developer-name`-rename on `set`.** Rejected: Custom Metadata `DeveloperName` is a
record's own unique/immutable-by-convention name field; "renaming" is a delete-then-create from Salesforce's
metadata perspective (a new record, since the file itself is named after `DeveloperName`), which is exactly
what `create` (for the new name) plus a follow-up manual delete already accomplish without a special mode
that has to explain what happens to references elsewhere.

## Implementation plan

1. **`customMetadataXml.ts`** (`simply-aep-core`) — add `buildValuesXml`/serialization counterpart to
   `extractValues`.
2. **`at4dxDomainProcessBindingTypes.ts`** — add `sobjectField` to `RawDomainProcessBindingRecord`.
3. **`at4dxDomainProcessLocalScan.ts`**/**`at4dxDomainProcessOrgScan.ts`** — set `sobjectField` alongside
   the existing primary/alternate resolution each already does.
4. **`at4dxDomainProcessBuildXml.ts`** (new) — `buildDomainProcessBindingXml`.
5. **`at4dxDomainProcessDeploy.ts`** (new) — `deployMetadataFile`.
6. **`at4dxDomainProcessWrite.ts`** (new) — the orchestration shared by both commands: locate-or-reject,
   merge, validate-or-reject, serialize, write (local and/or temp), deploy. Exposed as two thin named
   functions (`createDomainProcessBinding`, `setDomainProcessBinding`) so the VS Code extension can call
   either without re-implementing the sequencing.
7. **`at4dxDomainProcessBindingTypes.ts`** — add `At4dxDomainProcessBindingWriteResult` and the flag-shaped
   input types both write functions take.
8. **`packages/simply-aep/src/commands/simply/aep/at4dx/domain-process-binding/create.ts`** and
   **`.../set.ts`** — flags, calls into the `simply-aep-core` write functions, table/JSON output.
9. **`messages/simply.aep.at4dx.domain-process-binding.create.md`** and **`.../set.md`**.
10. **`src/index.ts`** barrels (both packages) — export the new functions/types/commands.
11. **Tests** — `at4dxDomainProcessBuildXml.test.ts` (byte-exact XML for every field combination, matching
    the existing local-scan fixtures byte-for-byte so a round trip through `scanLocalDomainProcessBindings`
    reproduces the input record, including a `sobjectField: 'alternate'` case), `at4dxDomainProcessWrite.test.ts`
    (create/set orchestration, validation blocking + `--force`, org-only temp-write-and-discard,
    `--sobject-alternate` field-preservation on `set`), command-level tests for both new commands
    (mirroring `validate.test.ts`'s style).
12. **Housekeeping**, per `CLAUDE.md`: `pnpm run readme` for both packages; `pnpm run build` at the root so
    `command-snapshot.json` picks up both new commands.
13. **Cross-reference** — add this doc's row to `docs/design/README.md`'s index.

## Testing

**Unit** (`simply-aep-core`):

| Case                                                                                     | What it pins down                                                                 |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `buildDomainProcessBindingXml` output parsed back through `scanLocalDomainProcessBindings` | Round-trips to the same `RawDomainProcessBindingRecord` for every field combination (present/absent optional fields, both `processContext` values, both `type` values, both `sobjectField` values). |
| `create --sobject-alternate`                                                               | Writes only `RelatedDomainBindingSObjectAlternate__c` (nil `RelatedDomainBindingSObject__c`); re-scanning reports `sobjectField: 'alternate'`, no `ambiguous-sobject-reference` issue. |
| `create`: `DeveloperName` collision in the scanned scope                                  | Rejected before any write.                                                          |
| `create`: candidate introduces an `order-collision` with an existing active record        | Rejected without `--force`; written with `--force`, issue still present in the result. |
| `set`: found record's untouched fields are preserved                                      | Only the flags given change; everything else matches the original record.          |
| `set` on a `sobjectField: 'alternate'` record, changing only `--order` (no `--sobject-alternate`)  | Rewritten file still uses `RelatedDomainBindingSObjectAlternate__c` — the regression this doc's field-preservation rule exists to prevent. |
| `set --sobject-alternate=false` on an alternate-field record                               | Explicitly moves the SObject reference to `RelatedDomainBindingSObject__c` — an intentional override, not preserved. |
| `set`: `DeveloperName` not found                                                          | Rejected before any write.                                                          |
| `set`: no field flags beyond `--developer-name`                                           | `error.noFieldsToUpdate`.                                                           |
| Org-only mode (`--target-org`, no `--source-dir`)                                         | Temp directory is created, deployed from, and removed; no file left on disk after the call. |
| Deploy failure                                                                             | Local file (when `--source-dir` was given) is still left in place — only the deploy step failed, not the source write. |

**Command** (`simply-aep`), mirroring `validate.test.ts`'s style: flag validation (context-field mismatch,
invalid developer name, neither source given), `--force` end-to-end, `--json` output shape.

**NUT** — none, matching every other AT4DX command.

## Open questions

- **Renaming/deleting a binding** — out of scope here (see Alternatives considered); a future
  `domain-process-binding delete` is a natural follow-up once real usage shows it's needed.
- **`simply-vscode/extensions/simply-at4dx` integration details** — left undecided here, matching
  [0008](0008-at4dx-domain-process-binding-list.md)/[0011](0011-domain-process-binding-issue-scoping.md)'s
  stance on their own VS Code integration; the extension-side design is expected to be its own doc in that
  repo, same as [0011](0011-domain-process-binding-issue-scoping.md)'s companion
  [0007 in `simply-vscode`](https://github.com/SimplySF/simply-vscode/blob/main/docs/design/0007-at4dx-validate-viewed-bindings.md).
- **Extending the same create/set shape to the four `ApplicationFactory_*Binding__mdt` types**
  ([0007](0007-at4dx-binding-list.md)) — not proposed here; that resolution model (keyed, priority-ordered)
  is different enough that it deserves its own sizing, same reasoning [0008](0008-at4dx-domain-process-binding-list.md)
  already applied when it got its own `list` instead of folding into `binding list`.
- **Namespaced AT4DX installs** — out of scope, same reasoning as every prior AT4DX doc in this repo.

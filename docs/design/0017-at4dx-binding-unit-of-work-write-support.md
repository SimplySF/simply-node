# 0017 — `simply aep at4dx binding validate`/`create`/`update` for UnitOfWork

**Status:** Implemented
**Package:** `packages/simply-aep-core`, `packages/simply-aep`
**Date:** 2026-08-30

## Problem

[0015](0015-at4dx-binding-validate-create-set.md) added `binding validate`/`create`/`update` for the
three Application Factory binding types that share a `To__c` field — Service, Selector, Domain —
explicitly excluding `UnitOfWork`. Its Problem section reasoned: `UnitOfWork` "has no `To__c` field at
all... so it doesn't share create/update's field shape with the other three, and — since every record
already contributes to one ordered list with no possible wiring conflict — there's nothing for a
`validate` rule to catch on it either." The first half of that holds; the second half doesn't.

Pulling `ApplicationFactory_UnitOfWorkBinding__mdt`'s actual schema and consuming Apex directly from
[apex-enterprise-patterns/at4dx](https://github.com/apex-enterprise-patterns/at4dx) (not guessed — the
same standard 0014/0015/0016 already hold themselves to):

| Field                        | Type                                  | Notes                                                                             |
| ---------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| `BindingSObject__c`          | MetadataRelationship→EntityDefinition | **`unique: true`**.                                                               |
| `BindingSObjectAlternate__c` | Text                                  | **`unique: true`** — unlike Selector, where this field is plain, non-unique text. |
| `BindingSequence__c`         | Number                                | Not unique. No default value.                                                     |

No `To__c`/`Priority__c`/`BindingInterface__c` field exists anywhere on this object — confirmed from the
directory listing of `schema/objects/ApplicationFactory_UnitOfWorkBinding__mdt/fields/` itself, which
contains only the three files above.

**Validation rules** (`validationRules/`): the identical `Minimal_BindObj_Or_BindObjAlt`/
`Not_Both_BindObj_And_BindObjAlt` pair already confirmed on Selector/Domain/FieldSetInclusion — same
formulas, same error messages, real and platform-enforced here too.

**Both** SObject-reference fields being unique puts `UnitOfWork` in the same category as `Domain` (where
[0015](0015-at4dx-binding-validate-create-set.md) added `duplicate-domain-sobject`), not `Selector`
(where only `To__c` is unique): two `UnitOfWork` records resolving to the same SObject cannot both
deploy.

**`ApplicationSObjectUnitOfWorkDIProvider.cls`** (the consuming Apex, fetched directly): queries with
`order by BindingSequence__c` and no `WHERE` clause — there's no "active" flag on this CMDT, every record
always contributes — then unconditionally adds each resolved SObjectType to the Unit of Work's type list.
Neither a shared SObject nor a shared `BindingSequence__c` throws or is otherwise rejected in this Apex;
the _only_ platform-enforced constraint is the CMDT field uniqueness above, and the only exception this
class ever throws is for an SObject reference that doesn't resolve to a real SObject at all
(`di_Injector.InjectorException`, already covered by `missing`/`unsupported-entity-definition-object`-style
handling). A shared `BindingSequence__c` is tolerated at runtime — ties just resolve in whatever order
SOQL happens to return them — unlike `DomainProcessBinding__mdt`'s `order-collision`, where a shared order
can mean one binding silently never runs at all.

So `UnitOfWork` has nearly the same wiring-problem surface Selector/Domain already have (missing/
ambiguous/ineligible SObject reference, duplicate SObject), plus one new, genuinely softer concern
(`BindingSequence__c` collisions — advisory, not a platform failure). It was excluded on a stale
assumption, not because there's truly nothing to check. `duplicate-to` remains permanently inapplicable —
there's no `To__c` field to compare, full stop, not a temporary gap.

This is a real, user-visible behavior and flag change to two already-shipped commands (`binding create`/
`update` gain a new writable type and a new flag; `binding validate` starts reporting issues for
`UnitOfWork` bindings it silently ignored before), so per `CLAUDE.md` it needs its own design doc rather
than landing as a quiet extension.

## Decision

Extend the existing `binding` command family and its `simply-aep-core` implementation in place —
`UnitOfWork` is not a new CMDT family the way [0016](0016-at4dx-selector-config-field-set-inclusion.md)'s
`SelectorConfig_FieldSetInclusion__mdt` was; it's already one of the four `BindingType` values every
scanner/resolver in `at4dxBindingTypes.ts`/`at4dxOrgScan.ts`/`at4dxLocalScan.ts`/`at4dxResolve.ts`
handles, just excluded from the _write_ and _validate_ half of that shared machinery. No new files.

`WritableBindingType` widens from `'Service' | 'Selector' | 'Domain'` to include `'UnitOfWork'`;
`ALL_WRITABLE_BINDING_TYPES`/`WritableBindingTypeFlag`/`WRITABLE_BINDING_TYPE_BY_FLAG` follow. This is a
pure value addition to already-exported constants/types — `simply-aep-core`'s `test/index.test.ts`
exported-_names_ list is unaffected, only their contents change.

`CreateBindingInput.to` widens from required (`to: string`) to optional (`to?: string`) — `UnitOfWork`
has no `To__c` to give, and there's no reasonable value to require it be set to. This is a
backward-compatible type-level widening (an existing caller passing a string keeps compiling); the "still
required for Service/Selector/Domain" rule moves from the type system into `createBinding`'s own runtime
check — the one genuine API-shape change in this doc, called out explicitly rather than left implicit.

Two new `BindingIssueRule` values are **added**, not merged into an existing one:

- `duplicate-unit-of-work-sobject` (`error`, `record` scope) — the exact same detection logic as
  `duplicate-domain-sobject`, for a different CMDT. Reusing/renaming `duplicate-domain-sobject` itself
  (the "just make it generic" option) was considered and rejected — see Alternatives.
- `sequence-collision` (`warning`, `scan` scope) — two `UnitOfWork` records sharing a defined,
  non-`undefined` `BindingSequence__c`. `scan`-scoped because a collision can span two records for
  _different_ SObjects, the same cross-key reasoning `duplicate-to` already uses (see
  [0011](0011-domain-process-binding-issue-scoping.md)) — filtering to one SObject wouldn't let you see
  the record it collides with. `warning`, not `error` like `order-collision` (its closest analog): the
  verified Apex above tolerates a shared sequence with no throw, so nothing is platform-broken — it's an
  advisory that the intended relative commit order between two specific SObjects is now ambiguous, not a
  binding that silently stops running the way `order-collision`'s namesake does for
  `DomainProcessBinding__mdt`.

`entityDefinitionIssues`, `missingSObjectReferenceIssues`, `ambiguousSObjectReferenceIssues`, and
`duplicateDeveloperNameIssues` in `at4dxValidate.ts` all currently special-case `UnitOfWork` out; that
special-casing is removed from all four — they apply to it exactly as they already do to Selector/Domain.
`duplicateToIssues`' existing `UnitOfWork` exclusion is **kept**, permanently — there is no `To__c` field
to ever compare.

`at4dxOrgScan.ts`/`at4dxLocalScan.ts` currently skip malformed/ambiguous tracking for `UnitOfWork`
entirely (each has a comment: "keeps the pre-0015 silent-drop behavior... out of scope for
`validateBindings`"). That special case is removed from both — `UnitOfWork` goes through the same
malformed/ambiguous detection Selector/Domain already get. `binding list`'s own displayed output is
unaffected (it only ever showed `records`, and well-formed data scans identically); only previously
invisible malformed/ambiguous `UnitOfWork` records newly surface, and only through `validate`.

`buildBindingXml`/`createBinding`/`updateBinding` in `at4dxBuildXml.ts`/`at4dxWrite.ts` gain a `sequence`
field threaded through exactly the way `priority` already is, and `checkTypeFieldMismatch` gains rejects
for `--to`/`--binding-interface`/`--priority` on `UnitOfWork` and for `--sequence` on every other type —
the same "usage error, not a soft validate issue" precedent that function already establishes.

## Behavior

```sh
sf simply aep at4dx binding create --source-dir sfdx-source/core \
  --type unit-of-work --developer-name Account_UOW --sobject Account --sequence 10
sf simply aep at4dx binding update --target-org myOrg \
  --type unit-of-work --developer-name Account_UOW --sequence 20
sf simply aep at4dx binding validate --target-org myOrg
# now also reports missing/ambiguous/ineligible SObject references, duplicate SObjects, and sequence
# collisions for UnitOfWork bindings — previously silently skipped
```

### New rules (`validateBindings`)

| Rule                                      | Severity  | Scope    | Applies to      | Detects                                                                                                                                          |
| ----------------------------------------- | --------- | -------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `missing-sobject-reference`               | `error`   | `scan`   | +UnitOfWork     | Now includes UnitOfWork — neither `BindingSObject__c` nor `BindingSObjectAlternate__c` set.                                                      |
| `ambiguous-sobject-reference`             | `error`   | `record` | +UnitOfWork     | Now includes UnitOfWork — both set to different values.                                                                                          |
| `unsupported-entity-definition-object`    | `error`   | `record` | +UnitOfWork     | Now includes UnitOfWork — `BindingSObject__c` set to an ineligible standard object.                                                              |
| `unnecessary-entity-definition-alternate` | `warning` | `record` | +UnitOfWork     | Now includes UnitOfWork — `BindingSObjectAlternate__c` set to an eligible object.                                                                |
| `duplicate-unit-of-work-sobject`          | `error`   | `record` | UnitOfWork only | Two UnitOfWork records resolve to the same SObject — both `BindingSObject__c` and `BindingSObjectAlternate__c` are platform-unique on this CMDT. |
| `sequence-collision`                      | `warning` | `scan`   | UnitOfWork only | Two UnitOfWork records share a `BindingSequence__c` value. Records with no `sequence` at all are never flagged.                                  |

`duplicate-to` stays exactly as-is (`Service, Selector, Domain` only) — `UnitOfWork` still has no `To__c`
field, permanently, not just for now.

### Flags (`binding create`/`update`)

| Flag         | Char | Required                                     | Applies to     | Notes                                                                                                                                                                                                                                                        |
| ------------ | ---- | -------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--type`     | `-t` | Yes                                          | all            | Gains `unit-of-work` as a fourth allowed value.                                                                                                                                                                                                              |
| `--to`       | `-c` | Yes (`create`), Service/Selector/Domain only | not UnitOfWork | **No longer required at the flag level** — `create` now enforces "required unless `--type unit-of-work`" itself, matching how `--sobject`'s requirement is already type-conditional rather than oclif-enforced. Rejected outright for `--type unit-of-work`. |
| `--sequence` |      | No                                           | UnitOfWork     | New. `BindingSequence__c`. Rejected for every other `--type`.                                                                                                                                                                                                |

Everything else (`--sobject`/`--sobject-alternate`/`--developer-name`/`--label`/`--force`/
`--source-dir`/`--target-org`/`--wait`) is unchanged — `--sobject`/`--sobject-alternate` already apply to
"every non-Service type," which now includes `UnitOfWork` with no further change needed.

### Errors

No new error codes — `type-field-mismatch` already covers "a flag was given for the wrong `--type`" and
extends to the four new rejections above without a new `BindingWriteErrorCode` value. `--sequence` gets
the same non-numeric-input guard `--priority` already has in the CLI layer (`error.invalidSequence`,
mirroring `error.invalidPriority`).

## Alternatives considered

**Renaming/generalizing `duplicate-domain-sobject` into a single rule covering both Domain and
UnitOfWork**, rather than adding `duplicate-unit-of-work-sobject`. Rejected: `duplicate-domain-sobject` is
already a shipped, public `BindingIssueRule` value (PR #148) — renaming it would break any consumer of
`simply-aep-core` (or CI script) matching on that literal string. The detection _logic_ is shared (both
call the same generalized internal helper, parameterized by binding type and rule id); only the public
rule identifier stays separate per CMDT, consistent with how `WritableBindingType` was kept narrower than
`BindingType` rather than mutating the latter.

**Making `sequence-collision` an `error`, matching `order-collision`'s severity for the textually similar
situation on `DomainProcessBinding__mdt`.** Rejected on the same evidence basis 0015 used to justify
`ambiguous-sobject-reference`'s `error` severity: severity here tracks what's actually verified to happen
at the platform/runtime level, not what looks similar on the surface. `order-collision` is `error` because
AT4DX's own dispatch can mean one of the colliding records silently never executes; the verified
`ApplicationSObjectUnitOfWorkDIProvider.cls` Apex above does no such thing for a duplicate sequence — both
SObjects are still registered into the Unit of Work, just in an indeterminate relative order between the
tied pair. That's worth flagging, not worth failing CI over.

**Keeping `--to` a hard-required oclif flag and asking for a throwaway value like `--to ""` on
`--type unit-of-work`.** Rejected as needlessly hostile to the CLI's own users for a field that
structurally doesn't exist on this CMDT — the same reasoning that already made `--sobject` conditionally
required (by `--type`) rather than unconditionally required at the flag-parser level in 0015.

## Implementation plan

1. **`at4dxBindingTypes.ts`** — widen `WritableBindingType`/`ALL_WRITABLE_BINDING_TYPES`/
   `WritableBindingTypeFlag`/`WRITABLE_BINDING_TYPE_BY_FLAG` to include `UnitOfWork`/`unit-of-work`; widen
   `CreateBindingInput.to` to optional; add `sequence?: number` to `BindingFieldsInput`; add
   `duplicate-unit-of-work-sobject`/`sequence-collision` to `BindingIssueRule` and `BINDING_RULES`.
2. **`at4dxOrgScan.ts`**/**`at4dxLocalScan.ts`** — remove the `bindingType === 'UnitOfWork'` special case
   in each so malformed/ambiguous tracking applies uniformly to Selector/Domain/UnitOfWork.
3. **`at4dxValidate.ts`** — drop the `UnitOfWork` exclusions from `entityDefinitionIssues`,
   `missingSObjectReferenceIssues`, `ambiguousSObjectReferenceIssues`, `duplicateDeveloperNameIssues`;
   generalize `duplicateDomainSObjectIssues` into a helper parameterized by binding type + rule id, called
   for both `Domain`/`duplicate-domain-sobject` and `UnitOfWork`/`duplicate-unit-of-work-sobject`; add
   `sequenceCollisionIssues`; wire both new producers into `validateBindings`'s composed array. Leave
   `duplicateToIssues` untouched.
4. **`at4dxBuildXml.ts`** — thread `sequence` through `BindingXmlFields`; gate `To__c` off for UnitOfWork,
   gate `Priority__c` off for Domain _and_ UnitOfWork, add `BindingSequence__c` for UnitOfWork only.
5. **`at4dxWrite.ts`** — extend `checkTypeFieldMismatch` per the flag table above; add the runtime
   "`to` required unless UnitOfWork" check to `createBinding`; thread `sequence` through the create
   candidate, `mergeBindingRecord`, and both `buildBindingXml` call sites.
6. **`packages/simply-aep/src/commands/simply/aep/at4dx/binding/create.ts`**/**`update.ts`** — add
   `'unit-of-work'` to `WRITABLE_TYPE_OPTIONS`; drop `required: true` from `create.ts`'s `--to` flag; add
   the `--sequence` flag (string, numeric-parsed like `--priority`) to both.
7. **`packages/simply-aep/messages/simply.aep.at4dx.binding.{create,update,validate}.md`** — update
   `flags.type.summary`, `flags.to.summary`, add `flags.sequence.summary`/`error.invalidSequence`, add a
   `--type unit-of-work` example to `create.md`/`update.md`; rewrite `validate.md`'s paragraph currently
   claiming UnitOfWork never contributes an issue.
8. **Tests** — extend `at4dxLocalScan.test.ts` (malformed/ambiguous now apply to UnitOfWork),
   `at4dxValidate.test.ts` (replace its "never validates UnitOfWork" case with the positive cases in
   Testing below), `at4dxWrite.test.ts` (UnitOfWork create/update round-trip, the four new
   `type-field-mismatch` cases), and `simply-aep/test/commands/.../binding/{create,update,validate}.test.ts`
   (replace `validate.test.ts`'s "never flag a UnitOfWork record" case; add a UnitOfWork round-trip to
   `create.test.ts`/`update.test.ts`).
9. **Housekeeping**, per `CLAUDE.md`: `pnpm run readme` for `simply-aep` and (bundled orchestrator)
   `simply` — watch for the recurring `oclif readme` duplicate-block bug; `pnpm run build` for
   `command-snapshot.json` in both; `pnpm --filter site run sync`, keeping only the touched plugin docs.

No new source files, no new commands, no new message files.

## Testing

**Unit** (`simply-aep-core`):

| Case                                                                      | What it pins down                                                                                                                             |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| UnitOfWork record with neither SObject field set                          | `missing-sobject-reference`, `error` — now fires for UnitOfWork.                                                                              |
| UnitOfWork record with both fields set, different values                  | `ambiguous-sobject-reference`, `error` — now fires.                                                                                           |
| UnitOfWork record, `BindingSObject__c` = an ineligible standard object    | `unsupported-entity-definition-object`, `error` — now fires.                                                                                  |
| UnitOfWork record, `BindingSObjectAlternate__c` = an eligible object      | `unnecessary-entity-definition-alternate`, `warning` — now fires.                                                                             |
| Two UnitOfWork records resolving to the same SObject (one via each field) | `duplicate-unit-of-work-sobject`, `error`, one issue per record.                                                                              |
| Two UnitOfWork records sharing a `BindingSequence__c`                     | `sequence-collision`, `warning`, one issue per record in the group.                                                                           |
| Two UnitOfWork records with no `sequence` set at all                      | No `sequence-collision` — confirms "unordered" isn't mistaken for a conflict.                                                                 |
| UnitOfWork records never produce `duplicate-to`                           | Confirms the permanent exclusion still holds.                                                                                                 |
| `createBinding`/`updateBinding`, `--type unit-of-work`                    | Correct XML: `BindingSObject__c`/`BindingSObjectAlternate__c` + `BindingSequence__c`; no `To__c`/`Priority__c`/`BindingInterface__c` written. |
| `createBinding`, `--type unit-of-work`, `to` given                        | `type-field-mismatch`.                                                                                                                        |
| `createBinding`, `--type service`, `sequence` given                       | `type-field-mismatch`.                                                                                                                        |
| `createBinding`, `--type selector`, no `to` given                         | `type-field-mismatch` — the new runtime check replacing the old type-level requirement.                                                       |

**Command** (`simply-aep`): `binding/create.test.ts`/`update.test.ts` gain a `--type unit-of-work`
round-trip; `binding/validate.test.ts`'s "never flag a UnitOfWork record" case is replaced with one
asserting a real UnitOfWork wiring problem is now reported.

**NUT**: none, matching every existing AT4DX command.

## Open questions

- **Whether the `duplicateDomainSObjectIssues`/new-UnitOfWork-rule generalization is worth doing as one
  parameterized helper versus two near-identical functions** — recommended above for less drift risk
  between the two, but a reasonable reviewer could prefer the duplication for clarity; not a blocking
  decision.
- **Whether a future AT4DX version could add a `To__c`-equivalent or an "active" flag to
  `ApplicationFactory_UnitOfWorkBinding__mdt`**, which would change this doc's "every record always
  contributes" assumption. Not a concern today — reflects the schema as verified; revisit if AT4DX changes
  it.

# 0016 — `simply aep at4dx field-set-inclusion list`/`validate`/`create`/`update`

**Status:** Implemented
**Package:** `packages/simply-aep-core`, `packages/simply-aep`
**Date:** 2026-08-29

## Problem

AT4DX ships a fourth kind of binding this package has never read or written:
`SelectorConfig_FieldSetInclusion__mdt` — it tells a selector to add a named field set's items to its
queried field list. It isn't part of the `ApplicationFactory_*Binding__mdt` family `binding list`
already covers, has no public documentation, and doesn't appear anywhere in this repo today. Its actual
schema, pulled directly from
[apex-enterprise-patterns/at4dx](https://github.com/apex-enterprise-patterns/at4dx/tree/master/sfdx-source/core/main/schema/objects/SelectorConfig_FieldSetInclusion__mdt)
rather than guessed:

| Field                        | Type                                  | Notes                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BindingSObject__c`          | MetadataRelationship→EntityDefinition | The selector's SObject, via `EntityDefinition` — same field type/eligibility rules as `DomainProcessBinding__mdt`'s `RelatedDomainBindingSObject__c` ([0014](0014-domain-process-binding-entity-definition-eligibility.md)) and [0015](0015-at4dx-binding-validate-create-set.md)'s `BindingSObject__c`. |
| `BindingSObjectAlternate__c` | Text                                  | Plain-text fallback, same "only one, not both" pattern.                                                                                                                                                                                                                                                  |
| `FieldsetName__c`            | Text, **required, unique**            | The field set to add. Unique **org-wide across every SObject**, not per-SObject — confirmed from the field metadata directly; an assumption of per-SObject uniqueness would be wrong.                                                                                                                    |
| `IsActive__c`                | Checkbox, default `true`              | Whether the field set is actually applied.                                                                                                                                                                                                                                                               |

Real, platform-enforced validation rules `Minimal_BindObj_Or_BindObjAlt`/`Not_Both_BindObj_And_BindObjAlt`
apply here too — same pair [0015](0015-at4dx-binding-validate-create-set.md) documents for the
Application Factory bindings.

There's no `list` to see what's configured, no `validate` to catch a wiring problem before deploy, and no
`create`/`update` to author a record without hand-writing `.md-meta.xml`.

## Decision

Add a new command family, `simply aep at4dx field-set-inclusion {list,validate,create,update}`, structured
after `domain-process-binding`'s file-for-file (the more-refined, more-recent precedent — reuse its
shape over the older `at4dxBindingTypes.ts`/`at4dxResolve.ts` shape 0007 established, since
`DomainProcessBinding__mdt`'s scanners already do the malformed/ambiguous tracking this new family needs
from day one, rather than retrofitting it the way [0015](0015-at4dx-binding-validate-create-set.md) has
to for the older family).

Not a `--type` value on `binding`/`domain-process-binding`: `SelectorConfig_FieldSetInclusion__mdt`
shares no fields with either existing family (no `To__c`/`Priority__c`/`ProcessContext__c` — instead
`FieldsetName__c`/`IsActive__c`), so cramming it into either would mean a large fraction of that
command's flags are meaningless for this type. A dedicated command family keeps every flag on
`field-set-inclusion create`/`update` actually applicable.

Uses `update` rather than `set`, matching [0015](0015-at4dx-binding-validate-create-set.md)'s verb
choice for the same reason (the more conventional SF CLI verb for "edit an existing record") — this and
0015 are both new, unreleased command families landing in the same round of work, so keeping their verbs
consistent with each other matters more here than matching `domain-process-binding`'s still-`set` verb,
which stays as-is for now and is reconciled separately.

**No priority/winner resolution**, unlike `binding list`/`resolve` and `DomainProcessBinding`'s
order-based resolution: every active `IsActive__c: true` record for a selector's SObject just adds its
field set — there's no "wins" concept, so `list` is a flat table, not a resolved one. The only two
list-level concerns are the same malformed/ambiguous SObject-reference tracking 0010/0015 already
established, plus `FieldsetName__c`'s org-wide uniqueness.

Reuses `ENTITY_DEFINITION_STANDARD_OBJECTS`/`isCustomObjectApiName` from the new
`entityDefinitionEligibility.ts` ([0015](0015-at4dx-binding-validate-create-set.md)) — this is the third
CMDT with the identical `MetadataRelationship→EntityDefinition` field, so the extraction that doc makes
pays off immediately here.

## Behavior

```sh
sf simply aep at4dx field-set-inclusion list --target-org my-org
sf simply aep at4dx field-set-inclusion validate --source-dir sfdx-source/core
sf simply aep at4dx field-set-inclusion create --source-dir sfdx-source/core \
  --developer-name Account_Contact_Fields --sobject Account --fieldset-name ContactRelatedFields
sf simply aep at4dx field-set-inclusion update --target-org my-org \
  --developer-name Account_Contact_Fields --no-active
```

`requiresProject = false` for all four, matching every other AT4DX command. `list`/`validate`: exactly
one of `--target-org`/`--source-dir`. `create`: at least one, both allowed (dual write+deploy, matching
0012). `update`: at least one (search scope), matching `domain-process-binding set`'s search-scope shape.

### Flags

| Flag                  | Char | Commands                                                                                                                                | Notes                                                                                                                                                  |
| --------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--target-org`        | `-o` | all                                                                                                                                     |                                                                                                                                                        |
| `--source-dir`        | `-d` | `list`/`validate` (repeatable), `create` (single), `update` (repeatable search scope)                                                   | Same split `domain-process-binding` already has between `list`/`validate`'s repeatable filter and `create`'s single destination.                       |
| `--developer-name`    | `-n` | `create` (required), `update` (required)                                                                                                | Same DeveloperName rules as every other write command in this package.                                                                                 |
| `--sobject`           | `-s` | `create` (required unless `--sobject-alternate` target given some other way — actually always required, see below), `update` (optional) |                                                                                                                                                        |
| `--sobject-alternate` |      | `create`, `update`                                                                                                                      | `--[no-]sobject-alternate`, tri-state, same convention as 0012/0015.                                                                                   |
| `--fieldset-name`     | `-f` | `create` (required), `update` (optional)                                                                                                | `FieldsetName__c`. Not renamed to something else on `update` — changing it changes which field set is included, which is exactly what `update` is for. |
| `--active`            |      | `create`, `update`                                                                                                                      | `--[no-]active`, defaults to `true` on `create` (matching `IsActive__c`'s CMDT default); unset means "don't change" on `update`.                       |
| `--label`             |      | `create`, `update`                                                                                                                      | Defaults to `--developer-name` on `create`.                                                                                                            |
| `--force`             |      | `create`, `update`                                                                                                                      | Bypass an error-severity issue.                                                                                                                        |
| `--wait`              |      | `create`, `update`                                                                                                                      | Deploy poll timeout, only meaningful with `--target-org`.                                                                                              |
| `--api-version`       |      | all                                                                                                                                     | Standard.                                                                                                                                              |

Unlike Selector/Domain bindings, `--sobject` has no "reject for this type" carve-out — every
FieldSetInclusion record needs a target SObject, so it's simply required on `create`.

### New rules (`validateFieldSetInclusions`)

| Rule                                      | Severity  | Scope    | Detects                                                                                                                                                              |
| ----------------------------------------- | --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `missing-sobject-reference`               | `error`   | `scan`   | Neither `BindingSObject__c` nor `BindingSObjectAlternate__c` set.                                                                                                    |
| `ambiguous-sobject-reference`             | `error`   | `record` | Both set to different values — real platform VR, same reasoning as [0015](0015-at4dx-binding-validate-create-set.md)'s identical rule.                               |
| `unsupported-entity-definition-object`    | `error`   | `record` | `BindingSObject__c` set to an ineligible standard object. Reused from `entityDefinitionEligibility.ts`.                                                              |
| `unnecessary-entity-definition-alternate` | `warning` | `record` | `BindingSObjectAlternate__c` set to an eligible object. Reused.                                                                                                      |
| `duplicate-fieldset-name`                 | `error`   | `scan`   | Two records share a `FieldsetName__c` — the field is unique **org-wide**, not per-SObject; a naive "unique per SObject" check here would miss a real deploy failure. |
| `duplicate-developer-name`                | `error`   | `scan`   | Standard.                                                                                                                                                            |

No `order-collision`/`duplicate-to` analogs: no ordering field, no `To__c` at all.

### `list` output

Table columns: `DEVELOPER NAME`, `SOBJECT`, `FIELDSET NAME`, `ACTIVE`, `SOURCE` — no `EFFECTIVE`/
`AMBIGUOUS` column the way `binding list` has, since there's no winner concept (see Decision).

### Errors

Same shape as `DomainProcessBindingWriteError`/`BindingWriteError` (0012/0015), a third
`FieldSetInclusionWriteError` with the same code set: `source-or-target-required`,
`invalid-developer-name`, `label-too-long`, `developer-name-already-exists`,
`developer-name-not-found`, `no-fields-to-update`, `at4dx-not-detected`, `validation-failed`,
`deploy-failed`. `list`/`validate` share `error.targetOrgOrSourceDirRequired`/`error.at4dxNotDetected`
with the rest of this package's AT4DX commands.

## Alternatives considered

**Folding this into `binding create`/`update` as a fifth `--type` value**, considered and rejected in
[0015](0015-at4dx-binding-validate-create-set.md)'s own review — repeated here since it's this doc's
central decision, not that one's: the field shapes don't overlap at all (see Problem), so a shared
command would mean most flags are conditionally invalid depending on `--type`, worse than one dedicated
command family with only the flags it needs.

**Naming the command family `selector-config-field-set-inclusion`**, matching the CMDT's full name
exactly. Rejected as unreasonably long for a CLI subtopic — `field-set-inclusion` is unambiguous within
`simply aep at4dx` (the only other subtopics are `binding` and `domain-process-binding`) and matches this
package's existing convention of shortening a CMDT's name to its distinguishing part
(`domain-process-binding`, not `at4dx-trigger-action-framework-domain-process-binding`).

**Giving `list` an `EFFECTIVE`-style column anyway, computed as "unique per SObject" or similar.**
Rejected: there's no real winner concept to compute — every active record for a SObject contributes its
field set simultaneously (AT4DX doesn't pick one), so a resolved/effective column would be inventing
information `list` doesn't have. `IsActive__c` in the `ACTIVE` column already tells the reader whether a
given record is currently contributing.

## Implementation plan

Mirrors [0010](0010-at4dx-domain-process-binding-validate.md)'s and
[0012](0012-at4dx-domain-process-binding-create-set.md)'s implementation plans, file-for-file, under new
`at4dxFieldSetInclusion*.ts` names:

1. **`at4dxFieldSetInclusionTypes.ts`** — `RawFieldSetInclusionRecord`, `MalformedFieldSetInclusionRecord`,
   `AmbiguousFieldSetInclusionRecord`, issue/rule types, `FIELD_SET_INCLUSION_RULES`, write input/target/
   result types, `FieldSetInclusionWriteError`. Defines its own `FieldSetInclusionSObjectField` (`'primary'
| 'alternate'`) rather than importing a shared one — no such shared type was actually extracted when
   `entityDefinitionEligibility.ts` was pulled out in [0015](0015-at4dx-binding-validate-create-set.md);
   that doc only moved `ENTITY_DEFINITION_STANDARD_OBJECTS`/`isCustomObjectApiName`, and
   `DomainProcessBindingSObjectField`/`BindingKeyField` each still live on their own family's types file.
   Corrected here rather than doing the (out-of-scope) three-way extraction this doc originally assumed
   had already happened.
2. **`at4dxFieldSetInclusionOrgScan.ts`** — SOQL including `BindingSObject__r.QualifiedApiName`;
   malformed/ambiguous tracking from the start (no retrofit needed, unlike 0015's older family).
3. **`at4dxFieldSetInclusionLocalScan.ts`** — parses `SelectorConfig_FieldSetInclusion.<name>.md-meta.xml`
   via the existing `customMetadataXml.ts` helpers.
4. **`at4dxFieldSetInclusionResolve.ts`** — `validateFieldSetInclusions` only. No `listFieldSetInclusions`
   pass-through was added: `list`'s command calls `scanOrgFieldSetInclusions`/`scanLocalFieldSetInclusions`
   directly and prints `records` as-is, since there's no resolution step for a pass-through to wrap.
5. **`at4dxFieldSetInclusionBuildXml.ts`**, **`at4dxFieldSetInclusionWrite.ts`** — `createFieldSetInclusion`/
   `updateFieldSetInclusion`, mirroring `at4dxDomainProcessWrite.ts`'s structure.
6. **`packages/simply-aep/src/commands/simply/aep/at4dx/field-set-inclusion/{list,validate,create,update}.ts`**.
7. **`packages/simply-aep/messages/simply.aep.at4dx.field-set-inclusion.{list,validate,create,update}.md`**.
8. **`src/index.ts`** barrel — export everything new; update `test/index.test.ts`.
9. **Tests**: `test/at4dxFieldSetInclusionLocalScan.test.ts`, `test/at4dxFieldSetInclusionBuildXml.test.ts`,
   `test/at4dxFieldSetInclusionResolve.test.ts` (one case per rule), `test/at4dxFieldSetInclusionWrite.test.ts`
   (mirroring `at4dxDomainProcessWrite.test.ts`, including its org-connected `create`/`update` cases — org
   scanning is exercised there via a mocked connection rather than in a separate org-scan test file,
   matching the convention `at4dxDomainProcessWrite.test.ts`/`at4dxWrite.test.ts` already established for
   the other two binding families), and the four command test files under
   `packages/simply-aep/test/commands/simply/aep/at4dx/field-set-inclusion/`.
10. **Housekeeping**, per `CLAUDE.md`: `pnpm run readme`/`pnpm run build`/`pnpm --filter site run sync`,
    same caution about the `oclif readme` duplicate-block bug noted in 0015.

## Testing

**Unit** (`simply-aep-core`):

| Case                                                           | What it pins down                                                                         |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Record with neither SObject field set                          | `missing-sobject-reference`, `error`.                                                     |
| Record with both fields set, different values                  | `ambiguous-sobject-reference`, `error`.                                                   |
| `BindingSObject__c` = an ineligible standard object            | `unsupported-entity-definition-object`, `error`.                                          |
| `BindingSObjectAlternate__c` = an eligible object              | `unnecessary-entity-definition-alternate`, `warning`.                                     |
| Two records, same `FieldsetName__c`, **different** SObjects    | `duplicate-fieldset-name`, `error` — pins down the org-wide (not per-SObject) uniqueness. |
| Two records, same `FieldsetName__c`, same SObject              | Still `duplicate-fieldset-name` — same rule, not a separate "same SObject" variant.       |
| Same `DeveloperName` across two `source` values                | `duplicate-developer-name`, `error`.                                                      |
| Well-formed input                                              | Empty `issues`.                                                                           |
| `createFieldSetInclusion`/`updateFieldSetInclusion` happy path | Correct XML fields; `IsActive__c` defaults to `true` when omitted on `create`.            |
| `updateFieldSetInclusion` changing `--fieldset-name` alone     | Only that field changes; SObject reference untouched.                                     |
| Force-bypass, org+source dual-write, developer-name collisions | Mirrors `at4dxDomainProcessWrite.test.ts`'s existing `set` cases.                         |

**Command** (`simply-aep`): mirrors `domain-process-binding/{list,validate,create,set}.test.ts` in
structure, under `field-set-inclusion/{list,validate,create,update}.test.ts` (verb renamed).

**NUT**: none, matching every existing AT4DX command.

## Open questions

- **Whether a future AT4DX version could make `FieldsetName__c` non-unique or per-SObject-unique**,
  which would change `duplicate-fieldset-name`'s scope. Not a concern for this doc — it reflects the
  schema as published today; revisit if AT4DX ever changes it.
- **Whether `list` needs a `--active-only` flag** like `domain-process-binding list` has. Not included in
  this doc's initial scope; cheap to add later since it only needs an `IsActive__c` filter, no resolution
  logic to change.

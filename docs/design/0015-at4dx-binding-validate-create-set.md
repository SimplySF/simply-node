# 0015 — `simply aep at4dx binding validate`/`create`/`update`

**Status:** Implemented
**Package:** `packages/simply-aep-core`, `packages/simply-aep`
**Date:** 2026-08-29

## Problem

`simply aep at4dx binding list` can show which `ApplicationFactory_{Service,Selector,Domain,UnitOfWork}Binding__mdt`
record wins for a given interface/SObject, but there's no way to:

1. **Check these bindings for wiring problems before they reach an org** — the same gap
   [0010](0010-at4dx-domain-process-binding-validate.md) closed for `DomainProcessBinding__mdt`. Today a
   record with neither `BindingSObject__c` nor `BindingSObjectAlternate__c` set is silently dropped by
   both scanners (`at4dxOrgScan.ts`/`at4dxLocalScan.ts`, `toRawRecord` returning `undefined` — the exact
   pre-0010 gap `DomainProcessBinding__mdt` had), and a record with both fields set to different values
   isn't detected at all.
2. **Create or edit one of these records** without hand-authoring `.md-meta.xml` or using Setup — the
   same gap [0012](0012-at4dx-domain-process-binding-create-set.md) closed for `DomainProcessBinding__mdt`.

Unlike `DomainProcessBinding__mdt`, these are shared with **AT4DX's own package** — `To__c` is a
platform-enforced-unique field on all three writable types (Service/Selector/Domain), and
`BindingSObject__c`/`BindingSObjectAlternate__c` are additionally unique on `ApplicationFactory_DomainBinding__mdt`
specifically. Pulling the actual schema from
[apex-enterprise-patterns/at4dx](https://github.com/apex-enterprise-patterns/at4dx/tree/master/sfdx-source/core/main/schema/objects)
confirms:

| CMDT                                      | Fields                                                                                                                                                         | Validation rules (real, platform-enforced)                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ApplicationFactory_ServiceBinding__mdt`  | `BindingInterface__c` (Text, required), `To__c` (Text, required, **unique**), `Priority__c` (Number)                                                           | none                                                               |
| `ApplicationFactory_SelectorBinding__mdt` | `BindingSObject__c` (MetadataRelationship→EntityDefinition), `BindingSObjectAlternate__c` (Text), `To__c` (Text, required, **unique**), `Priority__c` (Number) | `Minimal_BindObj_Or_BindObjAlt`, `Not_Both_BindObj_And_BindObjAlt` |
| `ApplicationFactory_DomainBinding__mdt`   | `BindingSObject__c` (**unique**), `BindingSObjectAlternate__c` (**unique**), `To__c` (Text, required, **unique**) — no `Priority__c`                           | same two VRs                                                       |

The `Minimal_.../Not_Both_...` pair is the same rule pair `DomainProcessBinding__mdt` also ships (checked
directly — see [0010](0010-at4dx-domain-process-binding-validate.md)'s
`missing-sobject-reference`/`ambiguous-sobject-reference`), but there it's _this CLI's own convention_;
here it's a genuine AT4DX-shipped Salesforce validation rule; a violation is a hard save/deploy failure,
not a judgment call this tool is making up. `ApplicationFactory_DomainBinding__mdt`'s field-level
uniqueness on both SObject-reference fields means two Domain bindings for the same SObject **cannot both
ever actually deploy** — `binding list`'s existing `ambiguous` flag (`at4dxResolve.ts:56-62`,
[0007](0007-at4dx-binding-list.md)) is display-only and doesn't fail anything; nothing today catches this
before a deploy attempt fails on it.

`UnitOfWork` is out of scope for `validate`/`create`/`update`: it has no `To__c` field at all (`sequence`
instead), so it doesn't share create/update's field shape with the other three, and — since every record
already contributes to one ordered list with no possible wiring conflict — there's nothing for a
`validate` rule to catch on it either. `binding list` keeps covering all four types, unchanged.

## Decision

Add `binding validate`, `binding create`, `binding update` to `packages/simply-aep`, alongside the
existing `binding list` — `update` rather than `set` (unlike `domain-process-binding create`/`set`),
since `update` is the more conventional SF CLI verb for "edit an existing record"; `domain-process-binding`
keeps `set` for now, to be reconciled in a later doc rather than as a side effect of this one. Same
package, same `--type` flag (a required, narrower `service|selector|domain` for `create`/`update`; the
existing four-value flag, unchanged, for `validate`/`list`), same `--source-dir`/`--target-org` shape
domain-process-binding already established.

Detection logic lives in `packages/simply-aep-core` as a new `validateBindings` function alongside the
existing `resolveBindings`, following the exact shape `validateDomainProcessBindings` already
established: a `BINDING_RULES` table (severity/scope/title/summary), `record`/`scan`-scoped issues (see
[0011](0011-domain-process-binding-issue-scoping.md)), and reuse of 0014's
`ENTITY_DEFINITION_STANDARD_OBJECTS`/`isCustomObjectApiName` for the identical
`MetadataRelationship→EntityDefinition` eligibility problem `BindingSObject__c` has here too. Those two
exports move out of `at4dxDomainProcessBindingTypes.ts` into a new `entityDefinitionEligibility.ts` —
they stopped being DomainProcessBinding-specific the moment a second CMDT needs them, and a third
(`SelectorConfig_FieldSetInclusion__mdt`, [0016](0016-at4dx-selector-config-field-set-inclusion.md)) needs
them too.

Getting `missing-sobject-reference`/`ambiguous-sobject-reference` requires the scanners to stop silently
dropping/ignoring what they currently do — the same shape of change 0010 made to the DomainProcessBinding
scanners, applied here to `at4dxOrgScan.ts`/`at4dxLocalScan.ts`.

`createBinding`/`updateBinding` follow `createDomainProcessBinding`/`setDomainProcessBinding`'s shape
exactly (0012): validate-before-write, `force` to bypass an error-severity issue, write to `--source-dir`
and/or deploy to `--target-org`, reusing `deployMetadataFile` and `customMetadataXml.ts` unmodified (both
already CMDT-agnostic).

## Behavior

### New rules (`validateBindings`)

| Rule                                      | Severity  | Scope    | Applies to                | Detects                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | --------- | -------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `missing-sobject-reference`               | `error`   | `scan`   | Service, Selector, Domain | Selector/Domain: neither `BindingSObject__c` nor `BindingSObjectAlternate__c` set. Service: `BindingInterface__c` not set (a blank interface reference is just as much "no key to bind against" as a blank SObject reference is — extended to Service during implementation, since the rule's underlying scanner change already tracks it uniformly across all three). |
| `ambiguous-sobject-reference`             | `error`   | `record` | Selector, Domain          | Both set to different values. `error`, not `warning` — Section "Alternatives considered" explains why this differs from `DomainProcessBinding__mdt`'s severity for the textually-identical situation.                                                                                                                                                                  |
| `unsupported-entity-definition-object`    | `error`   | `record` | Selector, Domain          | `BindingSObject__c` set to a standard object not on `ENTITY_DEFINITION_STANDARD_OBJECTS` — reused verbatim from [0014](0014-domain-process-binding-entity-definition-eligibility.md).                                                                                                                                                                                  |
| `unnecessary-entity-definition-alternate` | `warning` | `record` | Selector, Domain          | `BindingSObjectAlternate__c` set to an eligible object — same reuse.                                                                                                                                                                                                                                                                                                   |
| `duplicate-to`                            | `error`   | `scan`   | Service, Selector, Domain | Two records (of the same binding type) share a `To__c` value — the field is platform-unique on all three; both can't deploy.                                                                                                                                                                                                                                           |
| `duplicate-domain-sobject`                | `error`   | `record` | Domain only               | Two Domain records resolve to the same SObject (via either field) — platform-unique on Domain only. Promotes `list`'s existing `ambiguous: true` display flag to a real validation failure for this one type.                                                                                                                                                          |
| `duplicate-developer-name`                | `error`   | `scan`   | Service, Selector, Domain | Same `DeveloperName` defined more than once.                                                                                                                                                                                                                                                                                                                           |

No `order-collision`/`missing-context-field` analogs: `OrderOfExecution__c`/`ProcessContext__c` don't
exist on these three objects — Service/Selector resolve by `Priority__c` (a tie is AT4DX's own map's
last-write-wins, not a bug this tool can detect), Domain has no priority concept at all
(`resolveByType`, `at4dxResolve.ts:64-77`).

Every issue reuses `RawBindingRecord`'s existing `bindingType`/`developerName`/`key`/`source` fields for
its identity — `key` doubles as `sobject` for Selector/Domain and as the interface name for Service (no
`sobject` field exists on `BindingIssue` the way `DomainProcessBindingIssue` has one, since Service has no
SObject at all).

### Scanner changes (`simply-aep-core`)

Mirrors 0010's `at4dxDomainProcessOrgScan.ts`/`...LocalScan.ts` changes exactly:

```ts
export type MalformedBindingRecord = {
  bindingType: BindingType;
  developerName: string;
  source: string;
  filePath?: string; // local scans only
};

export type AmbiguousBindingRecord = {
  bindingType: BindingType;
  developerName: string;
  key: string; // BindingSObject__c's resolved value
  alternateKey: string; // BindingSObjectAlternate__c's raw value
  source: string;
  filePath?: string;
};

export type OrgScanResult = {
  records: RawBindingRecord[];
  malformed: MalformedBindingRecord[];
  ambiguous: AmbiguousBindingRecord[];
  missingTypes: BindingType[];
};
```

`scanLocalBindings` changes from returning a bare `RawBindingRecord[]` to a
`{ records, malformed, ambiguous }` envelope — a breaking change to `simply-aep-core`'s public surface,
called out via `!`/`BREAKING CHANGE:` per [0009](0009-aep-library-consumption.md)'s established
convention (the same shape of breakage 0010 already took once). `binding list`'s call site updates to
destructure `{ records }` and keeps ignoring `malformed`/`ambiguous`, unchanged behavior. Malformed/
ambiguous detection only applies to Service/Selector/Domain — Service has no SObject field so it's never
`ambiguous`; `UnitOfWork` keeps today's silent-drop behavior (out of scope, see Problem).

`RawBindingRecord` also gains `label: string` and `filePath?: string` — not shown in the snippet above
because they weren't obviously needed until implementing `updateBinding`: without a scanned `label`,
`updateBinding` would have no way to preserve an existing record's label when `--label` isn't passed
(exactly the gap `RawDomainProcessBindingRecord.label` already exists to close for
`setDomainProcessBinding`, which this doc initially missed porting over). `filePath` mirrors
`RawDomainProcessBindingRecord.filePath`, letting `updateBinding` rewrite the exact file it found instead
of re-deriving the path. `RawBindingRecord` also gains `keyField?: 'primary' | 'alternate'` (named
`BindingKeyField`, mirroring `DomainProcessBindingSObjectField`) — the doc's Problem/Decision sections
discuss the primary/alternate split conceptually but the type snippet omitted the field that actually
tracks it per record; without it, `unsupported-entity-definition-object`/`unnecessary-entity-definition-alternate`
have no way to know which field a Selector/Domain record's `key` came from.

### Command behavior

`sf simply aep at4dx binding validate` — same shape as `domain-process-binding validate`: scans
(`--target-org` xor `--source-dir`), calls `validateBindings`, prints a table or a success message,
`process.exitCode = 1` on any `error`. `--type` accepts the existing four values but only Service/
Selector/Domain contribute rules (UnitOfWork records pass through unvalidated, matching Problem).

`sf simply aep at4dx binding create`/`binding update` — same overall shape as
`domain-process-binding create`/`set` (verb renamed, see Decision): `--type` is **required** and
restricted to `service|selector|domain`. Flags:

| Flag                                       | Char        | Required                              | Applies to        | Notes                                                                                                  |
| ------------------------------------------ | ----------- | ------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| `--type`                                   | `-t`        | Yes                                   | all               | `service`\|`selector`\|`domain` only — not the four-value `list`/`validate` flag.                      |
| `--developer-name`                         | `-n`        | Yes (`create`)                        | all               | Same DeveloperName rules as `domain-process-binding create`.                                           |
| `--to`                                     | `-c`        | Yes (`create`)                        | all               | The interface/SObject's implementing Apex class (`To__c`).                                             |
| `--binding-interface`                      |             | Yes (`create`, `--type service` only) | Service           | `BindingInterface__c`. Rejected for Selector/Domain.                                                   |
| `--sobject`                                | `-s`        | Yes (`create`, Selector/Domain only)  | Selector, Domain  | Rejected for `--type service` (`context-field-mismatch`-style usage error, matching 0012's precedent). |
| `--sobject-alternate`                      |             | No                                    | Selector, Domain  | `--[no-]sobject-alternate`, tri-state like 0012's flag. Rejected for Service.                          |
| `--priority`                               |             | No                                    | Service, Selector | Rejected for `--type domain` (the field doesn't exist there).                                          |
| `--label`                                  |             | No                                    | all               | Defaults to `--developer-name` on `create`.                                                            |
| `--force`                                  |             | No                                    | all               | Bypass an error-severity issue.                                                                        |
| `--source-dir` / `--target-org` / `--wait` | `-d` / `-o` | See 0012                              | all               | Same dual-write shape as `domain-process-binding create`/`set`.                                        |

`update` additionally requires `--developer-name` (to locate the record) and rejects a call with no other
field given (`no-fields-to-update`, matching 0012).

### Errors

Same error-code shape as `DomainProcessBindingWriteError` (0012), renamed `BindingWriteError`:
`source-or-target-required`, `invalid-developer-name`, `label-too-long`,
`developer-name-already-exists`, `developer-name-not-found`, `no-fields-to-update`,
`at4dx-not-detected`, `validation-failed`, `deploy-failed`, plus a new `type-field-mismatch` for a
flag/`--type` combination that doesn't apply (e.g. `--sobject` with `--type service`).

## Alternatives considered

**Keeping `ambiguous-sobject-reference` a `warning` here, matching `DomainProcessBinding__mdt`'s existing
severity.** Rejected: that severity was chosen in 0010 partly because nothing in this codebase had
confirmed whether AT4DX enforces the "not both" rule at the platform level. Researching this doc's schema
directly confirmed it does — `Not_Both_BindObj_And_BindObjAlt` is a real, active Salesforce validation
rule on all four of these CMDTs (`DomainProcessBinding__mdt` included). A record that violates it cannot
actually be saved or deployed, which is exactly the "this binding is actually broken" bar the other
`error`-severity rules in this file already use. This doc does **not** retroactively change
`domain-process-binding validate`'s shipped severity for the identical situation — that's a separate,
explicit decision for whoever revisits 0010, flagged in Open Questions, not bundled into this feature.

**Extending `resolveBindings`'s existing `ambiguous: boolean` flag into a validate rule directly, instead
of a new `duplicate-domain-sobject` rule.** Considered, but `resolveBindings`/`At4dxBindingRow` computes
`ambiguous` for _display_ purposes independent of whether the underlying uniqueness constraint is real
(it's the same shape regardless of binding type) — `validateBindings` intentionally checks
`bindingType === 'Domain'` specifically, since that's the one type where the platform actually rejects
the duplicate. Reusing the row-level flag as-is would flag a false problem if a future AT4DX version ever
relaxed Domain's field uniqueness, or a true one only for Domain today; keeping the check inside
`validateBindings` (rather than trusting `resolveByType`'s already-computed flag) keeps the "is this a
real platform constraint" reasoning in one place.

**A single `--type all` sentinel for `validate`/`list` instead of four separate flag values or omission
meaning "all".** Out of scope for this doc — `list` already defaults to all four types when `--type` is
omitted; `validate` matches that existing default rather than introducing a new convention.

## Implementation plan

1. **`entityDefinitionEligibility.ts`** (new, `simply-aep-core`) — move `ENTITY_DEFINITION_STANDARD_OBJECTS`/
   `isCustomObjectApiName` out of `at4dxDomainProcessBindingTypes.ts`; re-export from there for
   backward compatibility within this package (internal-only, no public API change since both were
   already exported from the package root — the barrel just points at the new file).
2. **`at4dxBindingTypes.ts`** — add `MalformedBindingRecord`, `AmbiguousBindingRecord`,
   `BindingIssueSeverity`/`Rule`/`Scope`/`Issue`, `BINDING_RULES`, write input/target/result types,
   `BindingWriteError`, a narrower `WritableBindingType = 'Service' | 'Selector' | 'Domain'`.
3. **`at4dxOrgScan.ts`** — `toRawRecord` also returns malformed/ambiguous instead of only `undefined`;
   `scanOrgBindings` assembles the two new arrays.
4. **`at4dxLocalScan.ts`** — same change; return type becomes `{ records, malformed, ambiguous }`.
5. **`at4dxValidate.ts`** (new) — `validateBindings`, `filterBindingIssues` (or generalize 0011's
   `filterDomainProcessBindingIssues` if the two turn out identical enough to share).
6. **`at4dxBuildXml.ts`** (new) — `buildBindingXml`, branching per `WritableBindingType`.
7. **`at4dxWrite.ts`** (new) — `createBinding`/`updateBinding`, following `at4dxDomainProcessWrite.ts`'s
   structure (scan-context helpers, `checkValidation`, `writeAndDeploy` reused verbatim if it can be
   generalized off `DomainProcessBinding`-specific naming, else duplicated with the CMDT-specific parts
   swapped — decide while implementing, not here).
8. **`packages/simply-aep/src/commands/simply/aep/at4dx/binding/{validate,create,update}.ts`** — new
   commands alongside `list.ts`.
9. **`packages/simply-aep/messages/simply.aep.at4dx.binding.{validate,create,update}.md`**.
10. **`src/index.ts`** barrel (`simply-aep-core`) — export everything new; update
    `test/index.test.ts`'s exported-keys list.
11. **Tests** — `test/at4dxOrgScan.test.ts`/`at4dxLocalScan.test.ts` extended for malformed/ambiguous;
    new `test/at4dxValidate.test.ts` (one case per rule); new `test/at4dxWrite.test.ts` (mirroring
    `at4dxDomainProcessWrite.test.ts`'s create/set cases, verb renamed); `simply-aep/test/commands/.../binding/
{validate,create,update}.test.ts` (mirroring `domain-process-binding/validate.test.ts`).
12. **Housekeeping**, per `CLAUDE.md`: `pnpm run readme` for `simply-aep-core` and `simply-aep` (verify
    exactly one `<!-- commandsstop -->` after regenerating — PR #140 hit a duplicate-block bug in
    `oclif readme` on this exact repo); `pnpm run build` at the root; `pnpm --filter site run sync`
    touching only the affected docs.

## Testing

**Unit** (`simply-aep-core`):

| Case                                                                                  | What it pins down                                                                                              |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Selector/Domain record with neither SObject field set                                 | `missing-sobject-reference`, `error`.                                                                          |
| Selector/Domain record with both fields set, different values                         | `ambiguous-sobject-reference`, `error`.                                                                        |
| Selector/Domain record, `BindingSObject__c` = an ineligible standard object           | `unsupported-entity-definition-object`, `error`.                                                               |
| Selector/Domain record, `BindingSObjectAlternate__c` = an eligible object             | `unnecessary-entity-definition-alternate`, `warning`.                                                          |
| Two Service (or Selector, or Domain) records sharing `To__c`                          | `duplicate-to`, `error`, one issue per occurrence.                                                             |
| Two Domain records resolving to the same SObject (one via primary, one via alternate) | `duplicate-domain-sobject`, `error`.                                                                           |
| Same `DeveloperName` across two `source` values                                       | `duplicate-developer-name`, `error`.                                                                           |
| Well-formed input across all three types                                              | Empty `issues`.                                                                                                |
| `createBinding`/`updateBinding` happy path, each of Service/Selector/Domain           | Correct XML fields per type (no `BindingSObject__c` written for Service; no `Priority__c` written for Domain). |
| `createBinding` with `--sobject` and `--type service`                                 | `type-field-mismatch` error.                                                                                   |
| `updateBinding` merge-on-partial-update, force-bypass, org+source dual-write          | Mirrors `at4dxDomainProcessWrite.test.ts`'s existing `set` cases.                                              |

**Command** (`simply-aep`): mirrors `domain-process-binding/validate.test.ts` and `create.test.ts`/
`set.test.ts` (not yet read in detail for this doc — confirm their exact case list while implementing
step 11, since they're the direct template; verb renamed to `update` in the new command's own test file).

**NUT**: none, matching every existing AT4DX command.

## Open questions

- **Whether `domain-process-binding validate`'s `ambiguous-sobject-reference` severity should also become
  `error`**, now that this doc confirms AT4DX ships the identical validation rule there too. Deliberately
  not decided or changed here — a follow-up doc's call, since it changes already-shipped CI-gate behavior
  for existing `domain-process-binding validate` users.
- **Whether `binding validate`/`create`/`update` need a `--sobject`/`--key` scope filter** the way
  `domain-process-binding` does. Deferred: Service has no SObject to filter on, so the filter's meaning
  would differ per `--type` in a way `domain-process-binding`'s single-CMDT filter didn't have to handle.
  Revisit if a real project asks for it.
- **`entityDefinitionEligibility.ts`'s extraction** is a small refactor riding along with this feature
  rather than its own doc — flagged here in case review disagrees with bundling it in.
- **Renaming `domain-process-binding set` (and `field-set-inclusion set`, 0016) to `update` for
  consistency** is explicitly deferred, per direct instruction, to a later doc rather than done as a side
  effect of this one — `binding` is intentionally the first (and, until that doc lands, the only) AT4DX
  write command using `update`.

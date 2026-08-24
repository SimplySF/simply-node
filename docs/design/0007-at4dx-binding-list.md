# 0007 — `simply aep at4dx binding list`

**Status:** Implemented (PR #124)
**Package:** `packages/simply-aep` (new package)
**Date:** 2026-08-24

## Problem

AT4DX (built on force-di, on top of fflib) wires interfaces and SObjects to their implementations
through four Custom Metadata Types instead of Apex code:

| Custom Metadata Type                        | Answers                                               |
| ------------------------------------------- | ----------------------------------------------------- |
| `ApplicationFactory_ServiceBinding__mdt`    | Which class implements service interface X?           |
| `ApplicationFactory_SelectorBinding__mdt`   | Which class is the selector for SObject Y?            |
| `ApplicationFactory_DomainBinding__mdt`     | Which class is the domain for SObject Y?              |
| `ApplicationFactory_UnitOfWorkBinding__mdt` | Which SObjects does the shared Unit of Work register? |

Today, answering "what does `Application.Service.newInstance(IAccountService.class)` actually
return in this org?" means opening Setup, finding the right Custom Metadata Type, and reading raw
records one at a time — four times, once per binding type — with no visibility into whether two
records collide on the same key (in which case one of them is silently shadowed) or which one wins.
`sf project retrieve`/`sf data query` gets the raw rows but does none of the resolution.

This is exactly the kind of thing that should be `sf`-scriptable: "list the bindings" for a design
review, a CI check that flags unintended shadowing, or a VS Code panel that shows a class and asks
"who am I bound to."

## Decision

Add `sf simply aep at4dx binding list` in a new package, `packages/simply-aep`, scoped to Apex
Enterprise Patterns tooling generally (fflib, force-di, AT4DX) — not just dependency injection, since
`aep` is meant to be the umbrella for this whole framework family, not only its DI layer. fflib itself
has no binding metadata, so isn't directly represented here, but the package name leaves room for
e.g. a future `simply aep force-di ...` subtopic if a need for lower-level `di_Binding__mdt`
inspection shows up.

The command reads the four `ApplicationFactory_*Binding__mdt` types, either from a live org (SOQL,
plain REST — these are ordinary queryable records, no Tooling API needed) or from local DX source
(`ComponentSet.fromSource`, the same mechanism `simply schema visualize` uses for local scanning),
normalizes all four into one row shape, and computes which rows are **effective** for a given binding
key versus **shadowed** — reproducing the exact resolution rules AT4DX's `di_Module` subclasses apply
at runtime (see `Behavior` below; the four types don't all resolve conflicts the same way, and getting
this wrong would make the "effective" column actively misleading).

Output is a table by default, `--json` for the structured result — the standard `SfCommand`
`this.table()` convention (see `simply apex logs purge`, `simply sobject deduplicate`), not a custom
`--output-type` flag like `simply schema visualize` uses. That command's flag exists because it
writes diagram files to disk; this command just prints resolved records, so the framework default
already satisfies "table view as well as JSON."

**Library reuse for the future VS Code extension**: every other command package's `src/index.ts` is
an empty oclif-plugin stub (`export default {}`) — command logic lives under `src/commands/` and
`src/common/`, neither of which is reachable through the package's `exports` field
(`"exports": "./lib/index.js"` in every `package.json`), so nothing below the command is actually
importable today. Since this command is explicitly meant to become the data layer for a VS Code
binding explorer, `simply-aep`'s `src/index.ts` breaks from that stub convention and re-exports the
scan/resolve functions and types from `src/common/` — the same role `simply-core`'s `index.ts`
already plays for its package. This is the one deliberate deviation from the package template;
everything else (package.json shape, wireit scripts, messages/README conventions) follows
`simply-permissions` as the template.

## Behavior

```sh
sf simply aep at4dx binding list --target-org my-org
sf simply aep at4dx binding list --source-dir sfdx-source/core --source-dir sfdx-source/app
sf simply aep at4dx binding list --target-org my-org --type service,selector
sf simply aep at4dx binding list --target-org my-org --effective-only --json
```

`requiresProject = false`. Exactly one of `--target-org`/`--source-dir` is required, same rule and
error (`errors.targetOrgOrSourceDirRequired`) as `simply schema visualize`.

### Flags

| Flag               | Char | Purpose                                                                                            |
| ------------------ | ---- | -------------------------------------------------------------------------------------------------- |
| `--target-org`     | `-o` | Read bindings from this org via SOQL. Mutually exclusive with `--source-dir`.                      |
| `--api-version`    |      | Standard org API version override.                                                                 |
| `--source-dir`     | `-d` | Read bindings from local DX source (repeatable). Mutually exclusive with `--target-org`.           |
| `--type`           | `-t` | Filter to one or more of `service`, `selector`, `domain`, `unit-of-work`. Default: all four.       |
| `--effective-only` |      | Hide shadowed/non-winning rows. Default: `false` — showing every row, winner or not, is the point. |

### Row shape (shared by table and JSON)

```ts
type At4dxBindingRow = {
  bindingType: 'Service' | 'Selector' | 'Domain' | 'UnitOfWork';
  developerName: string;
  /** Interface name (Service) or SObject API name (Selector/Domain/UnitOfWork). */
  key: string;
  /** Implementing Apex class. Absent for UnitOfWork — see resolution table. */
  to?: string;
  /** Service/Selector only: `Priority__c`, as declared. */
  priority?: number;
  /** UnitOfWork only: `BindingSequence__c`, as declared. */
  sequence?: number;
  /** Whether this row is the one AT4DX actually resolves to for its key. Always `true` for UnitOfWork. */
  effective: boolean;
  /** Domain only: `true` when >1 row shares this key — see resolution table for why this can't be resolved to a single winner. */
  ambiguous?: boolean;
  /** Local package directory name, or the org username when read from `--target-org`. */
  source: string;
};
```

Table columns: `TYPE`, `KEY`, `TO`, `ORDER` (priority or sequence, whichever the type uses), `EFFECTIVE`,
`SOURCE`.

### Resolution rules, per binding type

This is the part that has to be right, ported directly from the corresponding `di_Module` subclass
in AT4DX's `framework-application-factory` classes (verified against the framework source, not
guessed):

| Type           | Key                                                            | How AT4DX picks a winner                                                                                                                                                                                                                              | `effective`/`ambiguous`                                                                                                                                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Service**    | `BindingInterface__c`                                          | Query orders `Priority__c DESC NULLS FIRST`; a map keyed by interface is populated in that order, so the **highest** priority row (nulls lowest) is written last and wins.                                                                            | Deterministic. Highest-priority row per key: `effective: true`; the rest: `false`.                                                                                                                                                                                                                                        |
| **Selector**   | `BindingSObject__c` (or `BindingSObjectAlternate__c` if blank) | Identical `Priority__c DESC NULLS FIRST` map-overwrite pattern.                                                                                                                                                                                       | Deterministic, same as Service.                                                                                                                                                                                                                                                                                           |
| **Domain**     | `BindingSObject__c` (or `BindingSObjectAlternate__c` if blank) | **No `Priority__c` field and no `ORDER BY`** — AT4DX's query returns Custom Metadata rows in an org-defined order (not something callers control), and each `bind().to()` call for a key overwrites the last.                                         | Non-deterministic when a key has >1 row. This command flags every row for a duplicated key `ambiguous: true` and does **not** claim to know which one is effective — `effective` is left `false` for all of them in that case, since asserting a winner here would be reporting something AT4DX itself doesn't guarantee. |
| **UnitOfWork** | `BindingSObject__c` (or `BindingSObjectAlternate__c` if blank) | There's no winner concept at all: `ApplicationSObjectUnitOfWorkDIProvider` builds one ordered list of SObjectTypes for the shared Unit of Work, ordered by `BindingSequence__c` ascending. Every row contributes; `To__c` doesn't exist on this type. | `effective: true` for every row (all are used); `to` is omitted.                                                                                                                                                                                                                                                          |

The Domain row is the one genuinely useful finding from reading the framework source rather than
assuming symmetry with Service/Selector: a naive implementation that treated all four types the same
way (highest priority / last one wins) would report a specific "effective" Domain binding that AT4DX
does not actually guarantee to pick.

### Local vs. org discovery

| Source         | How bindings are found                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--target-org` | One `SELECT` per binding type against `ApplicationFactory_{Service,Selector,Domain,UnitOfWork}Binding__mdt`, plain REST query (`connection.autoFetchQuery`) — these are ordinary queryable custom metadata records, no Tooling API and no chunking needed (row counts are inherently small).                                                                                                                                                                                                |
| `--source-dir` | `ComponentSet.fromSource(sourceDirs)`, filtered to `CustomMetadata` components whose fullName's object half matches one of the four type names (e.g. `ApplicationFactory_ServiceBinding.CampaignSObjectBinding`). Each record's `<values><field>/<value></values>` pairs are parsed into the same row shape used for org results — this is the same "parse the metadata XML directly" approach `simply schema visualize`'s `scanLocalSchema` already uses for `CustomField`/`CustomObject`. |

Namespace handling is deliberately out of scope for v1: AT4DX's own repository declares an empty
namespace, and it's conventionally vendored as source or an unlocked package rather than installed
namespaced. If a real namespaced-install case shows up, that's a follow-up, not a v1 requirement —
see Open Questions.

### Errors

| Condition                                                                                                                                                         | Behavior                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Neither/both of `--target-org`/`--source-dir` given                                                                                                               | `errors.targetOrgOrSourceDirRequired`                          |
| None of the four Custom Metadata Types exist in the chosen source (org query returns `INVALID_TYPE`, or local scan finds no matching `CustomMetadata` components) | `errors.at4dxNotDetected` — AT4DX doesn't appear to be present |
| Local `ComponentSet.fromSource` throws                                                                                                                            | `errors.localScanFailed`, wrapping the underlying message      |
| An org query fails for a reason other than "type doesn't exist"                                                                                                   | `errors.orgQueryFailed`, wrapping the underlying message       |

## Alternatives considered

**Naming it `simply schema visualize`'s sibling, e.g. `simply schema di-bindings`.** Rejected:
`simply-schema` is about SObject/field structure (`describeGlobal`, `FieldDefinition`), not Apex-level
DI wiring. Mixing them would make `simply-schema`'s scope harder to describe, and there's no natural
reuse between the two beyond "both can read local source or an org" — which is exactly what a shared
pattern, not a shared package, is for.

**A generic `simply metadata query` command that takes any Custom Metadata Type name.** Considered,
since "query a CMDT type from local or org" is reusable beyond AT4DX. Rejected for v1: it would ship
without the one thing that makes this command worth having over `sf data query` — the per-type
resolution logic (priority ordering, the Domain ambiguity flag, UnitOfWork's list-not-winner
semantics). A generic query command can't know those rules; encoding them requires knowing the
specific object. Nothing stops `packages/simply-aep`'s `common/` scan helpers from being written
generically enough to reuse if a second framework's bindings get added later.

**Including `DomainProcessBinding__mdt`** (AT4DX's trigger-routing metadata: criteria/action classes
bound to domain events) **in this same command.** Rejected for v1: it answers a different question
("what runs when Account fires an `onBeforeInsert`") with a structurally different row shape
(trigger operation, execution order, active/inverse flags — no interface/SObject "key" or
priority/sequence resolution at all), and folding it into one flat row type would either lose fields
or force a wide, mostly-empty table. It's a legitimate second command
(`simply aep at4dx domain-process-binding list`) once this one's row/resolution/local-vs-org
scaffolding exists to build on — tracked as an open question, not designed here.

**A custom `--output-type html,json,md` flag, matching `simply schema visualize`.** Rejected: that
command needs it because HTML/Markdown are genuinely different artifacts it writes to disk (a
diagram, an ERD). This command has one shape of output — rows — so the framework's own
table/`--json` split already covers it without inventing a flag.

**Exposing the scan/resolve functions only via relative import for tests, like `simply schema
visualize` does today (`export`ed from the command file itself, not reachable via the package's
`exports` field).** Rejected given the explicit "core library for a VS Code extension" requirement —
an external consumer can't `import` a subpath that `exports` doesn't expose. Making `simply-aep`'s
`index.ts` a real barrel is a small, contained deviation that solves this without changing how any
other package works.

## Implementation plan

1. **Scaffold `packages/simply-aep`**, using `packages/simply-permissions/package.json` as the
   template (dependencies: `@salesforce/core`, `@salesforce/sf-plugins-core`,
   `@salesforce/source-deploy-retrieve`, `@simplysf/simply-core`, `@simplysf/simply-plugin-kit`; same
   `wireit` script set; `oclif.topics` → `simply.aep` → subtopic `at4dx`, description "Commands for
   Apex Enterprise Patterns tooling (fflib, force-di, AT4DX)"). Add `tsconfig.json`,
   `.gitignore`, `CONTRIBUTING.md` stub matching a sibling package's.
2. **`src/common/at4dxBindingTypes.ts`** — the `At4dxBindingRow` type, the `BindingType` union, and a
   `const AT4DX_BINDING_OBJECTS` map from `BindingType` to its Custom Metadata Type API name and
   field list (this is the single source of truth the org query, local scan, and resolver all read
   from, so the four types can't drift out of sync with each other).
3. **`src/common/at4dxOrgScan.ts`** — `scanOrgBindings(connection, types): Promise<RawBindingRecord[]>`,
   one `connection.autoFetchQuery` per requested type, catching `INVALID_TYPE` to distinguish "AT4DX
   isn't here" from a real query failure.
4. **`src/common/at4dxLocalScan.ts`** — `scanLocalBindings(sourceDirs, types): RawBindingRecord[]`,
   `ComponentSet.fromSource` + `<values>` XML parsing, mirroring `scanLocalSchema`'s structure in
   `simply-schema/src/commands/simply/schema/visualize.ts`.
5. **`src/common/at4dxResolve.ts`** — `resolveBindings(records): At4dxBindingRow[]`, implementing the
   four resolution rules from the table above. Pure function, the main unit-test target.
6. **`src/commands/simply/aep/at4dx/binding/list.ts`** — `SfCommand<At4dxBindingListResult>`, flag
   parsing, the `--target-org`/`--source-dir` exclusivity check, calling scan → resolve → `this.table()`.
7. **`src/index.ts`** — barrel re-exporting `resolveBindings`, `scanOrgBindings`, `scanLocalBindings`,
   and every type from `at4dxBindingTypes.ts`, replacing the usual `export default {}` stub (see
   Decision).
8. **`messages/simply.aep.at4dx.binding.list.md`** — summary, description, per-flag summaries,
   examples, and the four `errors.*` keys.
9. **Add `@simplysf/simply-aep` to `packages/simply`'s `oclif.plugins`/`dependencies`**, same as any
   other bundled package, and update `CONTRIBUTING.md`'s package table.
10. **Housekeeping**, per `CLAUDE.md`: `pnpm run readme` in `packages/simply-aep`, then `pnpm run build`
    at the root so both `packages/simply-aep/command-snapshot.json` and `packages/simply`'s regenerate.

## Testing

**Unit** — `test/common/at4dxResolve.test.ts`:

| Case                                                                             | What it pins down                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Two Service rows, same interface, different `Priority__c`                        | Higher priority wins; both rows present with correct `effective`          |
| Two Service rows, one `Priority__c` null                                         | Null sorts first (lowest) — the non-null row wins                         |
| Two Selector rows keyed by `BindingSObjectAlternate__c` (no `BindingSObject__c`) | Alternate-field fallback for the key                                      |
| Two Domain rows, same SObject                                                    | Both flagged `ambiguous: true`, neither flagged `effective: true`         |
| Single Domain row per SObject (the common case)                                  | No false-positive ambiguity — `effective: true`, `ambiguous` absent/false |
| Three UnitOfWork rows, distinct sequences                                        | All `effective: true`, ordered by `sequence`, no `to`                     |
| Unknown/empty input for a requested type                                         | Returns `[]` for that type, not an error                                  |

**NUT** — `test/commands/simply/aep/at4dx/binding/list.nut.ts` against a new
`test/reference-projects/at4dx-project`: a trimmed local copy of AT4DX's four
`ApplicationFactory_*Binding__mdt` object definitions plus a handful of sample records covering (a) a
clean 1:1 binding per type, (b) a Service/Selector priority collision, and (c) a Domain key collision
— exercising both `--source-dir` against that project and `--target-org` after deploying it to a
scratch org (`TestSession`), so the same fixture proves out both discovery paths and the resolution
table above end to end.

## Open questions

- **`DomainProcessBinding__mdt` as a follow-on command** (`simply aep at4dx domain-process-binding
list`), once this command's scan/resolve scaffolding exists to extend — not blocking this design,
  but the natural next binding type to cover.
- **Namespaced AT4DX installs.** No known consumer needs this yet (see Behavior); revisit if one
  shows up rather than guessing at the shape now.
- **VS Code extension integration details** (what shape of API it actually wants beyond
  `At4dxBindingRow[]`, e.g. incremental/watch-mode scanning) are intentionally undecided here — this
  doc only commits to making the row/resolve logic importable, not to a stable extension-facing API
  yet.

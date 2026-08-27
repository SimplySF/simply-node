# 0013 — Flow and permission-set-assignment cleanup for destructive deploys

**Status:** Implemented (PR #133)
**Package:** new `packages/simply-flow`, `packages/simply-permissions`, `packages/simply-core`
**Date:** 2026-08-27

## Problem

Three bespoke Node scripts (see `flows.md`) currently live outside this monorepo, copy-pasted per customer project, doing real Salesforce operations this repo has no equivalent for:

- **`deleteFlows.mjs`** — given a `destructiveChanges.xml`, deactivates every active version of each listed `Flow` (`FlowDefinition.Metadata.activeVersionNumber = 0`) and then hard-deletes every version via the Tooling API. This is a necessary pre-step: Salesforce won't let a destructive metadata deploy remove a Flow that still has an active version.
- **`deletePermissionSetAssignments.mjs`** — given the same file, deletes every `PermissionSetAssignment` against the listed `PermissionSet`/`PermissionSetGroup` members, so the destructive deploy of the permission set/group itself doesn't fail or orphan assignments.
- **`deleteObsoleteFlowVersions.mjs`** — unrelated to destructive changes: globs local `*.flow-meta.xml` and deletes any Tooling API `Flow` version already `Status = 'Obsolete'` for those flows, to keep an org's flow-version history from accumulating indefinitely.

None of this is customer-specific — it's generic Salesforce deploy/maintenance mechanics — but today it exists as ad hoc scripts using `arg`/`ora`/`logSymbols`/`fast-xml-parser` directly, with no tests, and with a real correctness problem: every SOQL query string-interpolates member names into an `IN (...)` clause with no escaping, which is a SOQL-injection risk for any Flow/PermissionSet name containing a quote. There's also no shared place in this monorepo to read a `destructiveChanges.xml`/`package.xml`-shaped manifest — every command that has ever needed to read Custom Metadata XML got its own parser (`customMetadataXml.ts`); a `<Package><types><name/><members/></types></Package>` file has never been read generically here.

`packages/simply-cicd`'s multi-stage deploy pipeline (`deploy/{happy-soup,project}/pre-destructive`, etc.) already anticipates exactly this shape of operation — it runs a project's own `bin/preDestructive.sh` for each stage — but `simply-cicd` itself is pure pipeline orchestration (clone repos, run stage scripts, track progress); it contains no Salesforce metadata operations of its own. These three scripts are what a project's `bin/preDestructive.sh` would call, not something `simply-cicd` should absorb.

## Decision

Add a new package, **`packages/simply-flow`**, for Flow-lifecycle commands — matching this repo's existing one-package-per-domain convention (`simply-permissions`, `simply-apex`, `simply-sobject`, `simply-schema`, `simply-community`), rather than folding into `simply-cicd`, which would mix pipeline orchestration with Flow-domain operations and split Flow logic across two packages once `simply-cicd`'s existing `build generate-flow-diff` is counted.

- `sf simply flow delete` — replaces `deleteFlows.mjs`.
- `sf simply flow version prune` — replaces `deleteObsoleteFlowVersions.mjs`. Nested under a new `version` subtopic rather than a hyphenated leaf name, and not alongside `flow delete` at the top level: `delete` is about removing a flow entirely (the user's mental model is "the flow," not "its versions," even though it mechanically touches the same `Flow` sObject as this command does), while this command is specifically about trimming old versions of a flow you're keeping — the "version" framing matches what the caller is actually thinking about here in a way it doesn't for `delete`.

The permission-set-assignment cleanup goes into the existing **`packages/simply-permissions`** instead — it's squarely that package's domain (`PermissionSetAssignment`), not a Flow concern:

- `sf simply permissions assignment delete` — replaces `deletePermissionSetAssignments.mjs`.

Both `--file`-reading commands share a new `packages/simply-core` helper for the one thing they have in common: reading `<members>` out of a `<types><name>X</name>...</types>` block in a Package-shaped XML file. This is the write/read-manifest equivalent of what `customMetadataXml.ts` already does for `CustomMetadata` XML — normalize `fast-xml-parser`'s single-vs-array quirk, once, in one place, rather than three times.

Every SOQL query in all three commands uses `simply-core`'s existing `chunkedInQuery`/`escapeSoqlLiteral` instead of the originals' raw string interpolation — closing the injection gap as a byproduct of reusing shared infrastructure, not a special effort.

## Behavior

### `sf simply flow delete`

```sh
sf simply flow delete --file destructive/pre/destructiveChanges.xml --target-org my-org
sf simply flow delete --flow-name My_Flow --flow-name Another_Flow --target-org my-org
sf simply flow delete --file destructive/pre/destructiveChanges.xml --target-org my-org --json
```

`requiresProject = false`.

| Flag            | Char | Required | Purpose                                                                                                                                                                                   |
| --------------- | ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--file`        | `-f` | One of\* | Path to a `destructiveChanges.xml`/`package.xml`-shaped file; the `Flow` type's `<members>` are the flows to delete.                                                                      |
| `--flow-name`   | `-n` | One of\* | Explicit Flow `DeveloperName`(s), repeatable — an alternative to `--file` for scripted or one-off use (also the shape a future VS Code integration would use, with no XML file involved). |
| `--target-org`  | `-o` | Yes      |                                                                                                                                                                                           |
| `--api-version` |      | No       |                                                                                                                                                                                           |

\* Exactly one of `--file`/`--flow-name` — an XOR on "what to operate on," matching every AT4DX read command's `--target-org`/`--source-dir` precedent, not the additive `create`/`set` writer precedent (there's only one input here, not two destinations).

Resolution:

1. Resolve the flow developer names: `readPackageManifestMembers(fileContents, 'Flow')` for `--file`, or `--flow-name` directly.
2. Empty list → print `info.nothingToDelete`, return `{ deactivated: [], deleted: [], failures: [] }` without querying.
3. Tooling API, chunked: `SELECT Definition.Id, Definition.DeveloperName FROM Flow WHERE Definition.DeveloperName IN (...)`, distinct by `Definition.Id`.
4. For each distinct definition, update `FlowDefinition.Metadata.activeVersionNumber = 0`. A failure is recorded in `failures`, not thrown — matching the original's "keep going" behavior, now made visible as structured data instead of a bare `console.error`.
5. Tooling API, chunked: `SELECT Id, Definition.DeveloperName FROM Flow WHERE Definition.DeveloperName IN (...)` (all versions, active or not — this is a hard delete of everything, mirroring the original), delete each version, same failure-collection behavior.
6. Print a summary table; set `process.exitCode = 1` if `failures` is non-empty. Return the full structured result either way.

### `sf simply flow version prune`

```sh
sf simply flow version prune --target-org my-org --source-dir sfdx-source/core
sf simply flow version prune --target-org my-org --source-dir sfdx-source/core --dry-run
```

| Flag           | Char | Required | Purpose                                                                                                                                                                                                                              |
| -------------- | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--target-org` | `-o` | Yes      |                                                                                                                                                                                                                                      |
| `--source-dir` | `-d` | Yes      | One or more directories to glob `**/*.flow-meta.xml` under — replaces the original's implicit glob from `cwd`, matching every other command in this repo taking an explicit source scope rather than assuming the working directory. |
| `--dry-run`    |      | No       | List what would be deleted without deleting anything. Default `false`. New relative to the original, which had no preview before deleting org-wide flow-version history.                                                             |

Resolution:

1. Glob `**/*.flow-meta.xml` under each `--source-dir`; derive Flow developer names from file basenames.
2. Tooling API, chunked: `SELECT Id, Definition.DeveloperName FROM Flow WHERE Status = 'Obsolete' AND Definition.DeveloperName IN (...)`.
3. `--dry-run`: print/return the candidate list, delete nothing.
4. Otherwise: delete each version (failure-collection, not throw-on-first, same as `flow delete`), print a summary, `process.exitCode = 1` on any failure.

### `sf simply permissions assignment delete`

```sh
sf simply permissions assignment delete --file destructive/pre/destructiveChanges.xml --target-org my-org
sf simply permissions assignment delete --permission-set-name My_Permission_Set --target-org my-org
```

| Flag                          | Char | Required | Purpose                                                                                                                          |
| ----------------------------- | ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `--file`                      | `-f` | One of\* | Path to a `destructiveChanges.xml`/`package.xml`-shaped file; `PermissionSet`/`PermissionSetGroup` type members are the targets. |
| `--permission-set-name`       |      | One of\* | Explicit `PermissionSet` name(s), repeatable.                                                                                    |
| `--permission-set-group-name` |      | One of\* | Explicit `PermissionSetGroup` `DeveloperName`(s), repeatable.                                                                    |
| `--target-org`                | `-o` | Yes      |                                                                                                                                  |

\* At least one of `--file`/`--permission-set-name`/`--permission-set-group-name` — `--file` is mutually exclusive with the two explicit-name flags (which may be combined with each other), same one-input-source reasoning as `flow delete`.

Resolution:

1. Resolve names: `readPackageManifestMembers` for `PermissionSet` and `PermissionSetGroup` from `--file`, or the explicit flags.
2. Query `PermissionSetAssignment` for each set that's non-empty: `WHERE PermissionSet.Name IN (...)` and/or `WHERE PermissionSetGroup.DeveloperName IN (...)` (two queries, unioned — mirrors the original; a `PermissionSetAssignment` can be tied to either).
3. Delete the union in chunks of 200 (the standard DML collection limit — matches the original).
4. Print a summary; `process.exitCode = 1` on any chunk failure.

### `readPackageManifestMembers` (`simply-core`)

```ts
export function readPackageManifestMembers(xmlContent: string, typeName: string): string[];
```

Parses a `<Package><types><name>...</name><members>...</members></types>...</Package>` document (`fast-xml-parser`, new direct dependency of `simply-core` — matching the pattern of other `simply-core` utility modules owning their own parsing dependency, e.g. `csv-parse` for `createCsvFileWriter.ts`), normalizes the single-vs-array quirk for both `types` and `members`, and returns the `<members>` list for the given `<name>`, or `[]` if that type isn't present in the file at all — matching how the original scripts implicitly treat a missing/empty type as "nothing to do" rather than an error.

## Alternatives considered

**Folding all three commands into `simply-cicd` under a new `destructive` topic.** This was the first option considered and the one explicitly weighed against the chosen design. Rejected: `simply-cicd` has no Salesforce-metadata-operation commands today — every existing command there is about pipeline mechanics (cloning, running stage scripts, tracking JSON progress). Adding metadata operations there would be the first exception to that boundary, and would split Flow-domain logic across two packages once `build generate-flow-diff` (already in `simply-cicd`) is counted alongside a new `simply-cicd destructive delete-flows`.

**Putting permission-set-assignment deletion into `simply-flow` too, for a single "destructive cleanup" package.** Rejected: assignments are a `simply-permissions`-domain concept (that package already owns `PermissionSet`/`PermissionSetGroup` analysis), not a Flow one. A user who only cares about permission sets shouldn't need to install a Flow package to get it.

**A Flow-type-aware or PermissionSet-type-aware manifest reader** (e.g. separate `readFlowMembers`/`readPermissionSetMembers` functions). Rejected: the XML shape (`Package`/`types`/`name`/`members`) has nothing Flow- or PermissionSet-specific about it; a generic `(xmlContent, typeName)` function serves both callers today and any future destructive-changes-driven command without new code.

**Preserving the originals' "log to console and keep going" behavior with no structured result or exit code.** Rejected: every comparable command in this repo (AT4DX `validate`, for instance) returns a full structured result for `--json` and sets `process.exitCode` for CI gating, rather than relying on stderr text. Matching that consistently is strictly more useful to a CI caller than console-only output, at no extra design cost.

**Keeping the originals' unescaped string-interpolated SOQL.** Rejected outright — `chunkedInQuery`/`escapeSoqlLiteral` already exist in `simply-core` specifically for this, so fixing the injection risk costs nothing extra.

**A `--force`/confirmation prompt before deleting.** Considered for `flow delete` and `assignment delete` (irreversible operations), but not proposed here: `--dry-run` on `version prune` covers the case with no established preview (org-wide history, not scoped to a caller-provided list), while `flow delete`/`assignment delete` only ever act on a caller-supplied, explicit list (`--file` or explicit names) — the same shape as `sf project deploy start --pre-destructive-changes`, which also doesn't prompt. Revisit if real usage shows otherwise.

**Nesting `flow delete` under `version` too, for topology symmetry with `version prune`.** Considered, since both mechanically operate on the same Tooling API `Flow` (version) sObject. Rejected: command naming should match what the caller is trying to do, not which sObject the implementation happens to touch. "Delete this flow" is a request about the flow as a whole; "prune" is inherently about trimming a subset of versions while the flow itself stays alive. The one argument for nesting both — `sf simply flow version --help` would list them together — is outweighed by `delete` (the more common operation) staying reachable directly under the `flow` topic instead of a level deeper.

## Implementation plan

1. **`packages/simply-core/src/metadata/packageManifest.ts`** (new) — `readPackageManifestMembers`. Add `fast-xml-parser` to `simply-core`'s dependencies. Export from `simply-core`'s `src/index.ts`.
2. **Scaffold `packages/simply-flow`** — mirror `packages/simply-permissions`'s `package.json` (oclif plugin config, `flexibleTaxonomy: true`, `devPlugins`), `tsconfig.json`, `messages/`, `src/commands/simply/flow/`, `src/common/`, `test/` layout. Register it in `packages/simply`'s `oclif.plugins`/dependency list (root orchestrator bundling, per `CLAUDE.md`) the same way `simply-aep` was added.
3. **`packages/simply-flow/src/commands/simply/flow/delete.ts`** and **`.../version/prune.ts`**, plus their `messages/*.md`.
4. **`packages/simply-permissions/src/commands/simply/permissions/assignment/delete.ts`**, plus `messages/simply.permissions.assignment.delete.md`.
5. **Tests**: `readPackageManifestMembers.test.ts` in `simply-core` (missing type → `[]`, single vs. array `members`/`types` normalization); command tests for all three commands (mocked `Connection`, chunking behavior, failure-collection not throwing on first error, `--dry-run` deletes nothing, `--json` output shape) mirroring this repo's existing command-test conventions.
6. **Housekeeping**, per `CLAUDE.md`: `pnpm run readme` for `simply-core`, `simply-flow`, `simply-permissions`; `pnpm run build` at the root so `packages/simply`'s `command-snapshot.json` picks up the new commands.
7. **Cross-reference** — add this doc's row to `docs/design/README.md`'s index.

## Testing

**Unit** (`simply-core`):

| Case                                                            | What it pins down                                                |
| --------------------------------------------------------------- | ---------------------------------------------------------------- |
| A `destructiveChanges.xml` with one `<types>` block, one member | Both single-element normalizations (`types`, `members`) handled. |
| Multiple `<types>` blocks, multiple `<members>` each            | Array shapes handled.                                            |
| Requested `typeName` not present in the file                    | Returns `[]`, doesn't throw.                                     |
| Empty `Package` (no `<types>` at all)                           | Returns `[]`.                                                    |

**Unit/command** (`simply-flow`, `simply-permissions`), mocked `Connection`:

| Case                                                                                  | What it pins down                                                                               |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `flow delete --file` with no `Flow` members in the file                               | No-op, `info.nothingToDelete`, no queries issued.                                               |
| `flow delete`: one deactivation fails, others succeed                                 | Failure recorded in `failures`, remaining flows still processed; `process.exitCode === 1`.      |
| `flow version prune --dry-run`                                                        | Candidate list returned/printed; no delete call made.                                           |
| `assignment delete --file` with both `PermissionSet` and `PermissionSetGroup` members | Both queries run, results unioned, deleted in one chunked pass.                                 |
| `assignment delete`: more than 200 matching assignments                               | Deletes in multiple 200-record chunks.                                                          |
| `--file` and an explicit name flag both given (any of the three commands)             | Rejected — mutually exclusive input sources.                                                    |
| Every query's `IN (...)` clause                                                       | Built via `chunkedInQuery`/`escapeSoqlLiteral` — a name containing `'` doesn't break the query. |

**NUT** — none proposed initially, matching most commands in this repo; revisit if a real destructive-deploy scenario needs end-to-end coverage against a scratch org.

## Open questions

- **Should `simply-cicd`'s `pre-destructive`/`post-destructive` stages eventually call these commands automatically**, instead of requiring a project's own `bin/preDestructive.sh` to shell out to them? Left as future work — this doc only makes the commands exist and reusable; wiring them into the stage pipeline as a built-in, no-`bin/`-script-required option is a separate decision with its own tradeoffs (implicit behavior vs. explicit opt-in).
- **Whether the Tooling API supports a bulk multi-ID `destroy()`** for `Flow` (avoiding one round trip per version) is an implementation-time investigation, not a design decision — the original script loops one at a time; if a bulk form exists, use it, but the command's external behavior (failure-collection, structured result) is unaffected either way.
- **Namespaced/managed-package Flow or PermissionSet names** — out of scope, no different than any other command in this repo; revisit if a real project needs it.

## Implementation notes (post-implementation)

A few places where implementing this taught something the design above didn't anticipate:

- **A failed `SaveResult` carries `id: undefined`, not the id that failed.** jsforce-node's `SaveResult`
  type is a discriminated union — `{ success: true; id: string; errors: never[] }` or
  `{ success: false; id?: undefined; errors: SaveError[] }` — so a failure branch has no `id` to attribute
  a failure to. `assignment delete`'s chunked `PermissionSetAssignment` delete pairs each response entry
  with the request chunk's id by array index instead (`connection.sobject(...).delete(idChunk)`'s response
  array is positional against the request array), rather than reading `result.id`. This wasn't a problem
  for `flow delete`/`version prune`'s single-id `Flow`/`FlowDefinition` calls, since those never need a
  result-reported id — the developer name is already known from the calling loop's own variable.
- **Resolved the "does the Tooling API support a bulk multi-ID `destroy()`" open question, partially.**
  jsforce's `destroy()`/`delete()` doesn't special-case the Tooling API — `connection.tooling.sobject('Flow').destroy([id1, id2, ...])`
  would issue a single `DELETE .../tooling/composite/sobjects?ids=...` request the same way the standard
  API's composite delete works. What's unverified is whether Salesforce's server-side Tooling API REST
  layer actually accepts that composite-delete path for objects like `Flow` — nothing in this change
  exercises a real org, so this is a client-library capability, not a confirmed server capability. Given
  that uncertainty, `flow delete` and `version prune` both keep the original scripts' one-Flow-version-at-a-time
  loop rather than risk an unverified bulk endpoint. Worth revisiting with a NUT against a real org if
  per-version round trips become a real performance concern.
- **`targetOrgFlags`/`requireConnection` from `@simplysf/simply-plugin-kit`** (already used by
  `simply-permissions`) were used for all three commands' `--target-org`/`--api-version` instead of each
  command hand-rolling `Flags.optionalOrg({ char: 'o' })` plus its own null-connection check — not a
  divergence from the design doc's Behavior tables in practice, since `Flags.requiredOrg()` already
  defaults to the `-o` short char.

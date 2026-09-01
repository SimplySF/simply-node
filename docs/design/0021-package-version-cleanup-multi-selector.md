# 0021 — `package version cleanup`: `--selector`/`--selector-exclude`, multiple values

**Status:** Draft
**Package:** `packages/simply-package`
**Date:** 2026-09-01

## Problem

`simply package version cleanup` (0001's sibling command) takes exactly one MAJOR.MINOR.PATCH
matcher via `--matcher`/`--exclude-matcher`, each accepting a single value. Two problems:

1. **Naming.** `matcher`/`exclude-matcher` describes the mechanism (a string match), not what the
   user is doing (selecting which versions to delete). It also reads awkwardly next to sibling
   commands like `flow version prune`, whose multi-value flags (`--flow-name`, `--source-dir`) are
   named after the thing being selected, not the comparison performed on it.
2. **One value per invocation.** Cleaning up more than one MAJOR.MINOR line (e.g. `2.10.0` and
   `2.11.0`, both superseded by `2.12.0`) currently takes one invocation per line — each a separate
   `Package.listVersions` call and a separate confirmation of the results table. There's no way to
   ask for "delete everything unreleased in 2.10.0 or 2.11.0" in one run.

## Decision

Rename `--matcher` → `--selector` and `--exclude-matcher` → `--selector-exclude` (keeping their
existing `-s`/`-x` short chars), and make both `multiple: true`. `--selector` deletes every
unreleased version matching **any** of the given MAJOR.MINOR.PATCH values; `--selector-exclude`
deletes every unreleased version matching **none** of them. Still mutually exclusive as a group,
still requires at least one of the two, and each individual value still has to parse as
MAJOR.MINOR.PATCH — only the cardinality changes, not the per-value validation or the underlying
match/exclude logic (which already reduces to "does this version match a given MAJOR.MINOR.PATCH",
now applied per value and OR'd instead of applied once).

This is a straight rename, not an additive alias — no `--matcher` support kept alongside
`--selector`. `simply-package` is well past 1.0 (2.10.6), so this is a breaking change for anyone
scripting `--matcher`/`--exclude-matcher` today; per `CLAUDE.md` this repo doesn't carry
backwards-compatibility shims for something a version bump already communicates, and there's no
existing precedent in this CLI for deprecated-flag aliases (checked: no command anywhere uses
oclif's `deprecateAliases`/flag `deprecated` option). The implementing commit's conventional-commit
footer needs a `BREAKING CHANGE:` note so `lerna publish --conventional-commits` bumps
`simply-package`'s major version rather than a minor/patch.

## Behavior

| Before                                   | After                                                     |
| ---------------------------------------- | --------------------------------------------------------- |
| `--matcher 2.10.0`                       | `--selector 2.10.0`                                       |
| (not supported)                          | `--selector 2.10.0 --selector 2.11.0`                     |
| `--exclude-matcher 2.10.0`               | `--selector-exclude 2.10.0`                               |
| (not supported)                          | `--selector-exclude 2.10.0 --selector-exclude 2.11.0`     |
| `--matcher`/`--exclude-matcher` together | `--selector`/`--selector-exclude` together — still errors |
| Neither flag given                       | Neither flag given — still errors                         |

Matching rule with multiple values:

- `--selector v1 --selector v2 ...`: delete every unreleased version whose MAJOR.MINOR.PATCH equals
  `v1` **or** `v2` **or** ...
- `--selector-exclude v1 --selector-exclude v2 ...`: delete every unreleased version whose
  MAJOR.MINOR.PATCH equals **none** of `v1`, `v2`, ... (i.e. keep it only if it matches at least one
  exclusion value).

Each value is validated independently against the existing `^\d+\.\d+\.\d+$` format; the first
invalid value throws (fail fast, no partial validation pass reported). The format-mismatch error
now names the offending value (`The selector "%s" must be in the format of MAJOR.MINOR.PATCH.`)
since there can be more than one candidate per invocation.

Released versions are still never touched, regardless of how many selectors are given — unchanged
from today.

Flag/message renames, same file, same shape as [0018](0018-domain-process-binding-set-rename-to-update.md):

| Before                                 | After                                    |
| -------------------------------------- | ---------------------------------------- |
| `flags.matcher.*` (messages)           | `flags.selector.*`                       |
| `flags.exclude-matcher.*` (messages)   | `flags.selector-exclude.*`               |
| `errors.matcherRequired`               | `errors.selectorRequired`                |
| `errors.matcherFormatMismatch`         | `errors.selectorFormatMismatch`          |
| `ParsedMatcher` type, `parseMatcher()` | `ParsedSelector` type, `parseSelector()` |

## Alternatives considered

**Keep `--matcher`/`--exclude-matcher` as deprecated aliases pointing at the same flags.** Rejected
for the same reason 0018 rejected an aliased command: no precedent for it anywhere in this CLI, and
`CLAUDE.md` steers away from compatibility shims when the code can just change — a major version
bump is the existing mechanism for communicating this kind of break to consumers.

**Comma-separated single-value flag (`--selector 2.10.0,2.11.0`) instead of `multiple: true`.**
Rejected: inconsistent with every other multi-value flag in this codebase (`flow-name`,
`source-dir`, `source-objects` all use oclif's native `multiple: true`, repeated-flag style), and it
would need its own splitting/trimming logic that `multiple: true` gives for free.

**AND semantics for multiple `--selector` values (delete only versions matching every given
value)** — doesn't make sense for this data: a single package version has exactly one
MAJOR.MINOR.PATCH, so "matches v1 AND v2" for two different values is always empty unless
`v1 === v2`. OR is the only semantics that does anything useful with more than one selector.

**Leave `--exclude-matcher` singular, only pluralize `--matcher`.** Rejected for asymmetry — the
two flags share validation and are structurally mirror images (`isExclusion` flips one predicate);
giving them different cardinalities would need justifying on its own and there's no user need
driving it.

## Implementation plan

1. **`cleanup.ts`** —
   - Rename `ParsedMatcher` → `ParsedSelector`, `parseMatcher()` → `parseSelector()` (same body,
     same regex, same throw — just the message key changes).
   - Flags: `matcher` → `selector` (`Flags.string({ char: 's', multiple: true, exclusive:
['selector-exclude'] })`), `'exclude-matcher'` → `'selector-exclude'` (`char: 'x', multiple:
true, exclusive: ['selector']`).
   - Replace the single `flags.matcher ?? flags['exclude-matcher']` parse with: pick whichever
     array is present (`flags.selector ?? flags['selector-exclude']`), `.map(parseSelector)` over
     it, throwing `errors.selectorRequired` if neither array is present, and threading the
     originating raw string through `parseSelector`'s error path so
     `errors.selectorFormatMismatch` can name the bad value.
   - Filter predicate: replace the single `matchesMatcher` equality check with `parsedSelectors.some(s
=> version matches s)`, then `isExclusion ? !matchesAny : matchesAny` as today.
   - Update the `log.info` line to report all parsed selectors, not one major/minor/patch triple.
2. **`messages/simply.package.version.cleanup.md`** — rename `flags.matcher.*` →
   `flags.selector.*`, `flags.exclude-matcher.*` → `flags.selector-exclude.*`,
   `errors.matcherRequired` → `errors.selectorRequired`, `errors.matcherFormatMismatch` →
   `errors.selectorFormatMismatch` (with a `%s` placeholder for the bad value); reword summaries/
   descriptions for "one or more" cardinality and add a two-selector example.
3. **`test/commands/simply/package/version/cleanup.test.ts`** — rename flag names in every existing
   case (`--matcher` → `--selector`, `--exclude-matcher` → `--selector-exclude`); add cases for:
   multiple `--selector` values (union match), multiple `--selector-exclude` values (union
   exclusion), and one invalid value among several passed to `--selector` (error names the bad
   value, not just "format mismatch").
4. **Housekeeping**, per `CONTRIBUTING.md`: `simply-package` **is** bundled into
   `@simplysf/simply`'s orchestrator (see its `oclif.plugins` list), so `packages/simply`'s own
   `command-snapshot.json` also regenerates via its `command-snapshot` wireit task's cross-package
   dependency on `simply-package:compile` — a root `pnpm run build` (or a build from within
   `packages/simply`) picks this up automatically; no separate step, just don't build
   `simply-package` in isolation and assume that's the whole story. `packages/simply`'s README does
   **not** regenerate automatically, unlike its snapshot — run `pnpm run readme` in both
   `packages/simply-package` and `packages/simply` and commit both results (watch for the recurring
   `oclif readme` duplicate-`<!-- commandsstop -->`-block bug noted in
   [0018](0018-domain-process-binding-set-rename-to-update.md)). Run `pnpm --filter site run sync`
   and commit only the refreshed `simply-package`/`simply` doc pages — the sync script rewrites
   every plugin's page, and the rest reflect unrelated pre-existing drift, not this change. Set this
   doc's `Status` to `Implemented (PR #N)` and add its row to `docs/design/README.md`'s index.

## Testing

**Unit** (`simply-package`): existing four cases (missing `--target-dev-hub`, missing `--package`,
neither selector flag, both selector flags) move over with renamed flag strings, same assertions.
New cases: `--selector 0.1.0 --selector 0.2.0` deletes unreleased versions matching either;
`--selector-exclude 0.1.0 --selector-exclude 0.2.0` deletes every unreleased version matching
neither; `--selector 0.1.0 --selector bad-format` throws `errors.selectorFormatMismatch` naming
`bad-format` specifically (proves per-value validation, not just first-value validation).

**NUT**: none — matches the existing `it.todo(...)` placeholder for this command; not extending
scope here.

## Open questions

None — flag names, cardinality, and match semantics (OR across values) are fully specified above
and follow existing conventions (`multiple: true`, per-package message keys) already used
elsewhere in this repo.

# 0038 — Additional file-write strategies for `simply-project-setup-core`

**Status:** Draft (implementation complete in working tree; flip to `Implemented (PR #N)` once merged)
**Package:** `packages/simply-project-setup-core`
**Date:** 2026-09-03

## Problem

`standardizeFiles` today has exactly two ways to reconcile a template file with a target that
already exists in the project:

1. **Comment-delimited customization blocks** (`# -- START CUSTOMIZATION` / `# -- END CUSTOMIZATION`):
   re-copy everything outside the block from the template, keep whatever's inside it from the
   existing file. Detected automatically from the template's own content.
2. **`protectedFiles`**: skip entirely once the target exists — the file is only ever created.

That covers "text file with a clearly delimited free-form region" and "file the project owns
outright after first run." It doesn't cover three cases a consumer plugin now needs:

- **A JSON file that's initialized from a template and then hand-edited**, where re-running setup
  should still be able to land new/changed keys the template adds later, without clobbering
  whatever the project already changed. JSON has no comment syntax, so the block-marker convention
  (option 1) can't apply, and `protectedFiles` (option 2) means the project never sees template
  updates again.
- **A single inline token or line inside an otherwise-static file** — e.g. a version pin, a URL, a
  generated ID — that a project customizes in place, where wrapping it in a comment block is either
  impossible (the surrounding format has no comment syntax at that point) or overkill for a
  one-line value.
- **`protectedFiles` itself doesn't do what its own doc comment says.** It's documented as
  "relative destination paths," but `processSingleFile` matches on `basename(destinationPath)` —
  so `protectedFiles: ['.myrc.json']` protects a file with that name in _any_ directory a template
  pack happens to write it to, not just the one path the consumer meant. No known consumer depends
  on the basename behavior yet (see Alternatives), so this is a correctness fix riding along with
  the related work below rather than a separate change.

## Decision

Add two new opt-in file-write strategies to `standardizeFiles`, alongside the existing two, and fix
`protectedFiles` to match on relative path (with glob support) instead of basename:

- **`jsonMergeFiles`**: glob patterns (matched against the resolved relative destination path).
  A matching file is deep-merged — existing target values win on conflict, the template only fills
  in keys the target doesn't already have — instead of being overwritten or block-merged.
- **`regexCustomizations`**: a list of `{ path, pattern }` rules, `path` a glob matched the same
  way. Where a rule's `pattern` (a `RegExp` with one capturing group) matches both the existing
  target and the freshly generated template content, the target's matched text is spliced into the
  template output at the template's match location — a regex-scoped customization region, for
  formats or single-token values that can't hold a comment-delimited block.

Both are additive to `StandardizeFilesOptions`; nothing about the existing customization-block or
`protectedFiles` behavior changes for a consumer that doesn't opt in. Precedence across all four
strategies, checked in this order for a given file:

| Order | Strategy              | Trigger                                                  | Once target exists                                                |
| ----- | --------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| 1     | `protectedFiles`      | relative destination path matches a configured glob      | skip entirely — never rewritten                                   |
| 2     | `regexCustomizations` | relative destination path matches a rule's `path` glob   | splice target's matched region(s) into the template output        |
| 3     | `jsonMergeFiles`      | relative destination path matches a configured glob      | deep-merge target JSON under template JSON, target wins conflicts |
| 4     | customization block   | template content contains `# -- START/END CUSTOMIZATION` | splice target's block content into the template output (existing) |
| 5     | _(none of the above)_ | —                                                        | overwrite if content differs (existing)                           |

A file should match at most one of 1–4; the engine doesn't attempt to combine strategies on the
same file. `dependencies.json` and `.gitignore` are unaffected — they're handled by
`writeDependencies` and `standardizeGitignore` respectively, before/outside this per-file dispatch.

## Behavior

### `jsonMergeFiles`

```ts
const actions = standardizeFiles({
  config,
  templatesPath,
  jsonMergeFiles: ['.vscode/settings.json', '.myapprc.json'],
});
```

- Target doesn't exist → `CREATE`, template content written as-is (nothing to merge yet).
- Target exists → both files are `JSON.parse`d and deep-merged:
  - Two plain objects: merge key-by-key, recursing when a key is a plain object in **both**;
    otherwise the target's value wins outright (including when the target's value is an array —
    arrays are never merged element-wise, only replaced-or-kept, since element identity/ordering
    is too format-specific for this package to guess at).
  - A key present only in the template is added to the result (this is how a project picks up a
    newly-added template default it hasn't touched).
  - A key present only in the target is left alone.
  - Result differs from target → `MERGE`. Identical → no action (matches the no-op-on-unchanged
    convention every other write path already follows).
- Either file fails to parse as JSON → `ERROR`, same as an unbalanced customization marker today —
  reported in the returned `FileAction[]`, not thrown, consistent with every other per-file failure
  mode in this function.

This is deliberately the opposite precedence from `standardizePackageJson` (template always wins
there): `jsonMergeFiles` is for a file the project is expected to hand-edit after initialization;
`standardizePackageJson` is for the one file this package treats as tool-managed. Don't point
`jsonMergeFiles` at `package.json` — nothing stops it technically, but it isn't part of a
`templatesPath` pack today, and `writeDependencies`/`standardizePackageJson` already own it.

### `regexCustomizations`

```ts
const actions = standardizeFiles({
  config,
  templatesPath,
  regexCustomizations: [
    { path: '.myapprc.json', pattern: /"apiVersion":\s*"([^"]+)"/ },
    { path: 'bin/deploy.sh', pattern: [/^TARGET_ORG=(.*)$/m, /^TIMEOUT=(\d+)$/m] },
  ],
});
```

- For each rule whose `path` glob matches the file's relative destination, and for each pattern in
  that rule (a single `RegExp` or an array, applied in order):
  - Pattern matches in **both** the existing target and the freshly generated template content →
    the template's match is replaced with the target's matched text (the whole match, not just the
    capture group — the capture group's only job is to prove the pattern identifies a customizable
    value, the same role it plays in a URL-router param). First match only per pattern, not
    global — a `g` flag on the pattern is ignored; a file needing more than one independently
    customizable spot lists more than one pattern, not one pattern matched repeatedly, so each
    rule's target/template correspondence stays unambiguous even if the file has other
    incidentally-matching text elsewhere.
  - Pattern matches the template but **not** the target (first run after the rule was added, or a
    hand-edit removed the matched text) → leave the template's own text for that pattern; nothing
    to preserve yet.
  - Pattern does **not** match the template → `ERROR`. This means the rule doesn't correspond to
    anything in the current template — a consumer-side authoring mistake (typo'd pattern, template
    changed shape, stale rule), the same class of problem the existing "unbalanced customization
    markers" check catches for the block mechanism.
- Target doesn't exist → `CREATE`, template content written as-is.
- Result differs from target → `MERGE`. Unchanged → no action.

### `protectedFiles` (fixed)

```ts
protectedFiles: ['.sfdevrc.json', 'config/*.local.json'];
```

Now matches the full relative destination path (glob-capable via the same matcher as the two
options above), not `basename`. `protectedFiles: ['.myrc.json']` now protects only a template pack
that writes `.myrc.json` at the project root — a pack that writes `nested/.myrc.json` needs its own
entry (or a glob) if it should also be protected. No `simply-plugins` consumer exists yet (see
Alternatives), so there's no coordinated migration needed.

### Matching

All three options match against the file's **resolved relative destination path** — after
`renameFile`, same string `standardizeFiles` already uses for `FileAction.file` — using glob syntax
(`minimatch`, `{ dot: true }` so dotfile patterns like `.myrc.json` match without an explicit
leading-dot escape). This is deliberately not `banned`'s filesystem glob (`globSync` against disk);
these three options are consulted per generated file as `standardizeFiles` walks its own
`filesToProcess` map, before anything is written.

## Alternatives considered

**Unify all four strategies into one `fileStrategies: Record<string, Strategy>` option instead of
three flat lists/arrays plus the existing content-sniffed block detection.** Cleaner surface in
isolation, but it's a breaking rename of `protectedFiles` (already public at `0.2.0`) for a benefit
that doesn't materialize until a consumer actually wants to mix strategies in one config in a way
the precedence table doesn't already handle. Deferred — nothing here forecloses it later if the
flat-option approach gets unwieldy.

**Extend `transformFile`'s context with the existing target's content, and let the consumer write
their own preserve-a-token logic instead of a declarative `regexCustomizations` option.** Considered,
since it's a smaller API surface. Rejected because `transformFile` runs per-source-file with no
knowledge of merge bookkeeping (it can't report `MERGE` vs `CREATE` vs `ERROR` the way this engine's
other strategies do, and every consumer wanting this would reimplement the same
match-in-both/replace/report-ERROR-on-mismatch logic `mergeCustomization` already centralizes for
the block case). Keeping it declarative also keeps this feature testable the same way the block
mechanism is tested, without a consumer-supplied callback in the loop.

**Let a JSON template opt into merge behavior by convention (e.g. a `*.merge.json` filename suffix)
instead of an explicit `jsonMergeFiles` option.** Rejected: this package's existing conventions
(`dependencies.json`, `gitignore/`) are structural — they describe the templates-directory _shape_,
not a per-file write policy — and a filename suffix would leak into the actual written filename
unless yet another rename hook papered over it. An explicit option list matches how `protectedFiles`
and `banned` already work.

**Merge arrays element-wise (e.g. union by value, or index-wise merge) in `jsonMergeFiles` instead
of target-replaces-template.** Rejected as a default: array semantics are genuinely
format-specific (a `plugins` array might want de-duped union; a `scripts` array might care about
order; a fixed-arity tuple shouldn't be merged at all), and guessing wrong silently corrupts a
project's JSON in a way that's hard to notice. Target-wins-outright for arrays is at least
predictable and matches "the project's existing value always wins on conflict." Revisit if a real
case needs finer array control — a per-rule array-merge-mode is the natural extension, not a
reason to block this doc.

**Coordinate a `simply-plugins` consumer PR alongside this change**, per the root `CONTRIBUTING.md`
checklist. Checked: per 0035, no plugin in `simply-plugins` depends on this package yet, so there's
nothing to coordinate for this change either. Still worth re-checking at implementation time in case
that's changed since 0035 landed.

## Implementation plan

1. **`src/matchesPath.ts`** (new) — `matchesAny(relativePath: string, patterns: string[]): boolean`,
   a thin wrapper over `minimatch(relativePath, pattern, { dot: true })` across the pattern list.
   Add `minimatch` as a runtime dependency (already a transitive dependency of `glob`, so no new
   dependency actually enters a consumer's tree).
2. **`src/mergeJson.ts`** (new) — `mergeJsonPreservingTarget(template: unknown, target: unknown): unknown`,
   the recursive deep-merge described in Behavior. Pure function, no I/O, directly unit-testable.
3. **`src/standardizeFiles.ts`**:
   - Fix `processSingleFile`'s `protectedFiles` check to match `destRelativePath` via `matchesAny`
     instead of `basename`.
   - Add a `mergeRegexCustomization(templateContent, targetContent, patterns): string | undefined`
     function next to the existing `mergeCustomization`, implementing the per-pattern logic in
     Behavior (`undefined` return → caller reports `'ERROR'`, same contract as
     `mergeCustomization`).
   - Extend `processSingleFile` (or the dispatch just above it, since it now needs
     `destRelativePath` and the new options, not just `destinationPath`) to check, in order:
     `protectedFiles` → `regexCustomizations` → `jsonMergeFiles` → `hasCustomization` → overwrite.
   - Thread `jsonMergeFiles` and `regexCustomizations` through from `StandardizeFilesOptions`.
4. **`src/types.ts`**:
   - `RegexCustomization` interface (`path: string`, `pattern: RegExp | RegExp[]`).
   - `StandardizeFilesOptions` gains `jsonMergeFiles?: string[]` and
     `regexCustomizations?: RegexCustomization[]`.
5. **`src/index.ts`** — export `RegexCustomization` (the two new options are fields on an existing
   exported interface, not new top-level exports, but the type they reference needs to be public).
6. **`package.json`** — add `minimatch` to `dependencies`.
7. **Tests** — see Testing.
8. **README.md** — new "Templates-directory contract" subsection or extension covering all three
   strategies with the precedence table; update the end-to-end example if it gains a natural spot
   for one of these (e.g. `jsonMergeFiles: ['.vscode/settings.json']`); add `RegexCustomization` to
   the API table.
9. **`docs/design/README.md`** — add this doc's row.
10. Re-check the `simply-plugins` consumer question from Alternatives at implementation time; call
    out in the PR description either way.

## Testing

**Unit**, extending `test/standardizeFiles.test.ts` plus one new file:

- `matchesPath.test.ts`: literal path match, glob match, dotfile match with `dot: true`, no match.
- `mergeJson.test.ts`: target scalar wins over template scalar; template-only key added; nested
  object recursion; target array replaces template array outright even when both are arrays;
  mismatched types (template object vs. target scalar, or vice versa) — target wins outright, no
  recursion attempted.
- `standardizeFiles.test.ts` additions:
  - `jsonMergeFiles`: target doesn't exist → `CREATE` with template content; target exists →
    `MERGE` with target values preserved and new template keys added; unchanged merge result →
    no action; invalid JSON on either side → `ERROR`.
  - `regexCustomizations`: target doesn't exist → `CREATE`; matching pattern in both → target's
    value spliced into template output, `MERGE`; pattern matches template but not target → template
    text kept, no `ERROR`; pattern doesn't match template → `ERROR` regardless of the target;
    multiple patterns on one rule, only one needing preservation.
  - `protectedFiles`: existing two tests still pass; add a case proving a same-named file in a
    _different_ directory is **not** protected unless its own path (or a glob) is listed —
    pins the basename-to-relative-path fix.
  - Precedence: a file matching both `regexCustomizations` and containing a customization block
    uses the regex strategy, not the block (and vice versa isn't reachable given the precedence
    order, but assert it once for documentation value).
- `index.test.ts`: add `RegexCustomization` to the pinned export list.

**Manual verification**: not applicable, same as 0035 — no CLI surface in this package.

## Open questions

- Should `jsonMergeFiles`/`regexCustomizations` support a function form (like `renameFile`/
  `transformFile`) instead of only glob strings, for a consumer whose matching logic isn't
  glob-expressible? No concrete need yet — deferred until one shows up, same call 0035 made for
  keeping the customization-block markers fixed constants.
- Should array-merge behavior in `jsonMergeFiles` become configurable per rule (e.g.
  `{ path, arrayMerge: 'replace' | 'concat' | 'union' }`) instead of a single hardcoded default? Left
  for a follow-up if `'replace'` proves wrong for a real template — see Alternatives.

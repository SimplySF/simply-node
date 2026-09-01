# 0024 — `simply apex test-suite generate`

**Status:** Implemented (PR #162)
**Package:** `packages/simply-apex-core`, `packages/simply-apex`
**Date:** 2026-09-01

## Problem

Salesforce's `ApexTestSuite` metadata type (`testSuites/<Name>.testSuite-meta.xml`) lets a project
group Apex test classes into a named suite that `sf apex run test --test-suite-name` (or the Setup
UI) can run as a unit. Today there's no way to build one of these files in this CLI — a developer
either hand-writes the XML (tedious and easy to let drift as test classes are added/renamed) or
maintains it through Setup. There's no command anywhere in this repo that scans a project for
`@IsTest` classes and compiles them into a suite.

## Decision

Add `sf simply apex test-suite generate`: scans one or more given source directories for Apex
classes, keeps only the ones whose first meaningful line is an `@IsTest` annotation, and writes a
fresh `<name>.testSuite-meta.xml` to a given output directory — every run regenerates the file from
scratch (no merge with what's already there; see Alternatives considered for why).

The scan/build logic lives in `packages/simply-apex-core` from the start — not inlined into the
command and split out later — since [0023](0023-simply-apex-core.md) just finished exactly that
two-phase move for this package's other three commands, and this repo's own conventions
(`CLAUDE.md`) favor not repeating unnecessary work. `simply-apex`'s command layer stays a thin
flags/spinner/table wrapper, matching `execute`/`logs purge`/`trace setup`/`trace silence`.

Detection scope is deliberately narrow, matching what was asked: check the first **meaningful**
line of each `.cls` file (skipping leading blank lines and `//`/`/* */` comments — a plain first-line
check would exclude any class with a license header, which is extremely common) for a line starting
with `@IsTest` (case-insensitive). This is not a full Apex parser — a class where `@IsTest` isn't
the first annotation (e.g. `@SuppressWarnings(...)` then `@IsTest` on separate lines) is not
detected. See Open questions.

## Behavior

```
sf simply apex test-suite generate --source-dir force-app/main/default/classes --name My_Suite --output-dir force-app/main/default/testSuites
```

| Flag           | Char | Required      | Description                                                                                                                                                                                                                                                                                                                  |
| -------------- | ---- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--source-dir` | `-d` | Yes, multiple | One or more directories to scan for Apex classes, recursively (via `ComponentSet.fromSource`, the same scan primitive `at4dxLocalScan.ts`/`permissions build` already use — it walks subdirectories on its own, no manual glob needed).                                                                                      |
| `--name`       | `-n` | Yes           | The test suite's name — becomes the file name, `<name>.testSuite-meta.xml`. `ApexTestSuite`'s XML body has no internal name/label field; identity is filename-only, same as a `CustomMetadata` record's `DeveloperName`.                                                                                                     |
| `--output-dir` | —    | Yes           | The exact directory to write `<name>.testSuite-meta.xml` into. Not auto-suffixed with `testSuites/` — the caller passes that directory explicitly, matching `simply permissions build`'s `--output` convention (its example: `--output force-app/main/default/permissionsets`), not AT4DX's auto-appended `customMetadata/`. |

**Scan.** `ComponentSet.fromSource(sourceDirs)`, filtered to `component.type.id === 'apexclass'`
(same filter shape as `at4dxLocalScan.ts`'s `custommetadata` filter and `permissions build`'s
`CustomObject`/`CustomField`/`CustomTab` filters). For each match, `component.content` is the `.cls`
file's path (confirmed: a direct string property on `SourceComponent`, populated at construction for
single-content-file types like `ApexClass` — no `walkContent()` needed, that's for multi-file bundle
types) and `component.fullName` is the class name with no suffix.

**`@IsTest` check.** Read the `.cls` file's text. Skip leading whitespace/blank lines, skip `//`
line comments (to end of line) and `/* ... */` block comments (including multi-line ones,
non-nested — Apex doesn't nest block comments), repeating until the first real (non-comment,
non-blank) content is reached. Take that line up to its trailing newline, trim it, and test it
against `/^@istest\b/i`. This matches `@IsTest`, `@isTest(SeeAllData=true)`, and `@IsTest` on its
own line immediately followed by `public class Foo {` on the next — the regex only needs the
_first_ meaningful line to start with the annotation, arguments and all.

**Output.** Every matched, `@IsTest`-annotated class's `fullName`, deduplicated and sorted
alphabetically (matching `permissions build`'s explicit sorts, for deterministic clean-diff output
on repeat runs), goes into:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ApexTestSuite xmlns="http://soap.sforce.com/2006/04/metadata">
    <testClassName>ClassOne</testClassName>
    <testClassName>ClassTwo</testClassName>
</ApexTestSuite>
```

(Confirmed against `@salesforce/source-deploy-retrieve`'s metadata registry:
`"apextestsuite": { "directoryName": "testSuites", "suffix": "testSuite", ... }` — no `<label>` or
other metadata fields for this type, unlike `CustomMetadata` or `PermissionSet`.)

Written to `<output-dir>/<name>.testSuite-meta.xml`, **always overwriting** whatever was there —
no `--force` flag, no merge with an existing file's contents. Every run is a full regeneration from
the current state of `--source-dir`, matching "compile a TestSuite of all relevant classes" as a
repeatable action rather than a one-time scaffold. `output-dir` is created if it doesn't exist
(`fs.mkdir(..., { recursive: true })`, matching `permissions build`).

**No org interaction.** Local file generation only — no `--target-org`, no deploy step. Deploying
the generated file is a normal `sf project deploy start` the caller runs separately. (AT4DX's
write commands support an optional deploy because they're also managing org state directly; this
command's job ends at producing a correct local file.)

**Errors.**

| Condition                                                           | Error                                                                                                                                                                                                      |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zero `@IsTest` classes found across all `--source-dir` values       | `error.noTestClassesFound` — "No @IsTest-annotated classes were found in the given source director(y/ies)." Fails rather than writing a useless empty `<ApexTestSuite>` with no `<testClassName>` entries. |
| `ComponentSet.fromSource` throws (malformed source, bad path shape) | `error.scanFailed`, wrapping the underlying message — same pattern `permissions build` uses for the same failure mode.                                                                                     |

**Result** (`ApexTestSuiteGenerateResult`): `{ filePath: string; testClassNames: string[] }`. The
command displays a table of included class names (one column, `CLASS`) and an info line naming the
output path, mirroring `permissions build`'s `info.fileGenerated`.

## Alternatives considered

**Merge with an existing test suite file instead of always overwriting.** Rejected per explicit
confirmation: every run should be a fresh, repeatable regeneration reflecting the current source
tree, not an accumulating union that could keep a renamed/deleted test class around indefinitely. A
user who manually added a class to the suite outside this tool would have that addition silently
dropped on the next run — accepted, since "generate from a directory scan" is the entire point of
the command; a hand-curated suite is a different, unsupported workflow.

**Strict first-line-only check (no comment/blank-line skipping).** Rejected per explicit
confirmation: real Apex classes routinely carry a license header before `@IsTest`, and excluding
every one of them would make the command useless on any codebase with a header convention — this
repo's own `.cls`-adjacent files, if this monorepo had Apex, would fail a literal check.

**Support `--target-org` to deploy the generated suite.** Deferred, not rejected outright — v1 is
local-file-generation only, on the reasoning that this command's job (compile a suite from source)
is fully served by a correct local file, and `sf project deploy start` already does deployment well;
adding a redundant deploy path multiplies the surface (wait/poll flags, deploy-failure error
handling) for a marginal convenience. Revisit if real usage shows the extra `sf project deploy
start` step is a recurring friction point.

**Use `ComponentSet`'s built-in type detection instead of a raw-text first-line check** (i.e. trust
that any `apexclass` component found by the scan is a test, or query some SDR-provided "is this a
test class" signal). Rejected: `source-deploy-retrieve`'s registry has no such signal for
`ApexClass` — every `.cls` file, test or not, is the same `apexclass` type. The raw-text check is
the only way to distinguish them locally (an org query against `ApexClass.status`/symbol table
metadata could, in principle, but that would require `--target-org` and contradicts the
local-file-only decision above).

## Implementation plan

1. **`packages/simply-apex-core/src/apexTestSuite.ts`** — new file:
   - `isTestClassSource(source: string): boolean` — the comment/blank-line-skipping first-meaningful-line check described in Behavior. Pure function, directly unit-testable with hand-written `.cls`-shaped strings (no file I/O).
   - `scanTestClasses(sourceDirs: string[]): string[]` — `ComponentSet.fromSource(sourceDirs)`, filter `apexclass`, read `component.content` via `fs.readFileSync` (synchronous — matches `at4dxLocalScan.ts`'s existing sync-scan convention, since `ComponentSet.fromSource` itself is sync), apply `isTestClassSource`, collect `fullName`s, dedupe + sort.
   - `buildApexTestSuiteXml(testClassNames: string[]): string` — the template from Behavior, following `customMetadataXml.ts`'s plain-string-template style (no `xmlbuilder2` dependency needed — this document has no attributes/nesting complexity to justify one).
   - `ApexTestSuiteError` (code: `no-test-classes-found` | `scan-failed`) + `generateApexTestSuite(sourceDirs: string[], outputDir: string, name: string): Promise<ApexTestSuiteGenerateResult>` orchestrating the above, writing the file (`fs.mkdir` + `fs.writeFile`).
2. **`packages/simply-apex-core/src/index.ts`** — export `generateApexTestSuite`, `isTestClassSource`, `scanTestClasses`, `buildApexTestSuiteXml`, `ApexTestSuiteError`, `type ApexTestSuiteErrorCode`, `type ApexTestSuiteGenerateResult`. Update `test/index.test.ts`'s exported-key list.
3. **`packages/simply-apex/src/commands/simply/apex/test-suite/generate.ts`** — new command: flags per Behavior, calls `generateApexTestSuite`, maps `ApexTestSuiteError` codes to this package's `Messages` catalog (same `toCliError`-style switch as `trace/setup.ts`), renders the result table.
4. **`packages/simply-apex/messages/simply.apex.test-suite.generate.md`** — summary/description/flag copy/examples/error keys/info keys per Behavior.
5. **`packages/simply-apex/package.json`**'s `oclif.topics.simply.subtopics.apex.subtopics` — add a `test-suite` entry (`"description": "Commands for working with Apex test suites"`), alongside the existing `logs`/`trace` subtopics.
6. **Tests**:
   - `packages/simply-apex-core/test/apexTestSuite.test.ts` — `isTestClassSource` against representative `.cls`-shaped strings (bare `@IsTest`, `@isTest(SeeAllData=true)`, license header before `@IsTest`, blank lines before `@IsTest`, a non-test class, an empty file, `@IsTest` not on the first meaningful line); `buildApexTestSuiteXml` output shape; `scanTestClasses`/`generateApexTestSuite` against a temp directory with a mix of real `.cls`/`.cls-meta.xml` file pairs (mirroring `at4dxWrite.test.ts`'s temp-dir-based local-scan test style), including the zero-matches error case.
   - `packages/simply-apex/test/commands/simply/apex/test-suite/generate.test.ts` — CLI-level: flag validation, happy path against a temp source dir, the `noTestClassesFound` error path.
7. **Housekeeping** per `CONTRIBUTING.md`: `pnpm run readme` in `simply-apex` (new command needs to appear) and, since `simply-apex` is bundled into `@simplysf/simply`, `pnpm run readme` there too (watch for the recurring `oclif readme` duplicate-`<!-- commandsstop -->`-block bug, see [0018](0018-domain-process-binding-set-rename-to-update.md)/[0023](0023-simply-apex-core.md)'s implementation notes). `pnpm run build` regenerates `command-snapshot.json` for both packages. `pnpm --filter site run sync`, keeping only the `simply-apex`/`simply` doc pages this touches.

## Testing

**Unit** (`simply-apex-core`): see step 6 above — `isTestClassSource` is the highest-value target
(it's the one piece of genuinely fiddly logic; a small mistake there either silently drops real test
classes or includes non-test ones), followed by the temp-directory scan/generate integration cases.

**Command** (`simply-apex`): flag validation (missing required flags), one happy-path run producing
the expected table/result, and the `noTestClassesFound` error surfaced correctly through this
package's `Messages` catalog.

**NUT**: none — matches every other `simply-apex` command; no NUT coverage exists for this package
today.

## Open questions

- **`@IsTest` not-first-among-annotations.** A class like:
  ```
  @SuppressWarnings('PMD.ApexUnitTestClassShouldHaveAsserts')
  @IsTest
  private class Foo { ... }
  ```
  is not detected, since its first meaningful line is `@SuppressWarnings(...)`, not `@IsTest`. This
  is a direct consequence of the explicitly-requested "check the first line" heuristic (relaxed only
  to skip comments/blanks, not to look past other annotations). Left as a known, accepted gap rather
  than guessed at — revisit if real usage shows classes commonly stack annotations before
  `@IsTest`, at which point the fix (scan every leading `@Annotation` line, not just the first) is
  small.

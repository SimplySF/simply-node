# 0034 — Content Note bulk upload

**Status:** Draft
**Package:** `packages/simply-core`, `packages/simply-data-core`
**Date:** 2026-09-03

## Problem

`UploadContentNotes.md` (repo root) is a scraped, one-off Node script that was used to bulk-create
`ContentNote` records in an org from a CSV and link each one to a parent record via
`ContentDocumentLink`, resolving each parent by an external ID instead of a Salesforce record ID. It
duplicates logic this repo already has in library form (bulk/REST querying, streaming CSV I/O) and
has no home in `simply-node` — it's CLI-shaped (arg parsing, a spinner, `Org.create()`), but nothing
here is a CLI. There's also no `simply-data`-family CLI plugin command for this today; the script was
run by hand.

The script also has real bugs, found while reading it for this conversion:

- `CreatedDate: Date.parse(record.DATE_TIME)` passes a numeric epoch millisecond value where the
  Salesforce REST API requires an ISO-8601 string. This create call either fails or silently drops
  the field, depending on API version — either way `CreatedDate` isn't actually being set.
- `errorWriteStreamWriterStream.write(...)` (the `ContentDocumentLink` failure branch) references an
  undefined variable — a `ReferenceError` the first time a link create fails, which crashes the whole
  run partway through instead of recording the row and continuing.
- That same branch's error row uses `contentNoteResult.errors` instead of
  `contentDocumentLinkResult.errors`, and never records `CONTENTNOTE_ID`. A `ContentNote` that was
  created but failed to link becomes untracked — it exists in the org, orphaned, with no record of
  its ID anywhere.
- `uniqueRecordMap.get(record.EXTERNAL_ID)` reads a column literally named `EXTERNAL_ID` from the
  notes CSV, which is never declared anywhere (the `headers` const at the top of the file that looks
  like the notes-CSV schema is dead code — it's never passed to the parser, which infers columns from
  the file itself). What the input CSV's linking column is actually called is undocumented.
- `console.log(Buffer.from(record.CONTENT).toString('base64'))` dumps every note's full base64 body
  to stdout — leftover debug output.

## Decision

Split the script into a thin library layer here plus a CLI command that stays out of scope for this
doc (there's no open request for a `simply-data note upload` command yet; see
[Open questions](#open-questions)). This doc only covers the library layer:

- `packages/simply-data-core` gets the `ContentNote`-specific pieces: types, a single-record
  `createContentNote`, and a bulk `uploadContentNotes` orchestrator. This is the natural home — it
  already owns `ContentVersion` upload/download, the sibling half of the "Content" object family.
- `packages/simply-core` gets one new, genuinely generic primitive: a concurrency-bounded async
  mapper over a _stream_ of input (`mapConcurrent`), because `mapChunked` (the existing concurrency
  helper) requires the whole input materialized into an array first and processes it in
  wait-for-the-whole-chunk barriers, and this workload specifically wants to keep memory flat over a
  large input CSV while keeping the pipe full task-by-task (what `PQueue` was doing in the original
  script). Everything else the script needs — the lookup-reference query, CSV I/O — already exists in
  `simply-core` unchanged; see the mapping table below.
- CLI-only concerns (`arg` parsing, the `ora` spinner, `Org.create()`, `--output-dir`/`--use-cached`
  file management) are dropped entirely. Per every other `-core` package here, the library takes an
  already-resolved `Connection` and returns/streams data; a caller (a future CLI command, a script,
  CI) owns argv, progress UI, and where files land.

## Behavior

### What already covers part of this script

| Script did this by hand                                                                               | Use instead                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `bulk2.query(...)` for the lookup-reference query, always via Bulk API v2                             | `queryRecords()` from `simply-core` — same call shape, but auto-picks REST vs. Bulk based on row count, so a small lookup object doesn't pay Bulk job creation/poll latency                                        |
| Reading the notes CSV via `fs.createReadStream().pipe(parse(...)))`                                   | Unchanged — callers still do this themselves and pass the resulting `AsyncIterable` in; `simply-data-core` shouldn't own file-path handling for the input any more than `queryRecords` owns it for query results   |
| `createObjectCsvStringifier` + manual header/write-stream wiring for the success/error/reference CSVs | `createCsvFileWriter()` / `writeRecordsToCsvFile()` from `simply-core`                                                                                                                                             |
| `fs.mkdirSync(outputDir, { recursive: true })`, `` `${outputDir}/error-${Date.now()}.csv` ``          | `ensureDirectory()` / `timestampForFileName()` from `simply-core`                                                                                                                                                  |
| `--use-cached` re-parsing a previously written reference CSV                                          | Not a library concern — the library takes a `Map<string, string>` lookup already built (by `queryRecords` freshly, or by a caller re-parsing a cached file with `parse()` directly); it doesn't know or care which |
| `PQueue({ concurrency })` + manual `count`/`size`/`pending` bookkeeping for the spinner               | `mapConcurrent()` (new, below) drives the concurrency; a caller wanting progress text derives it from the results it's receiving                                                                                   |

### New in `simply-core`

```ts
function mapConcurrent<T, R>(
  source: AsyncIterable<T>,
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): AsyncGenerator<R>;
```

A fixed-size worker pool over an `AsyncIterable` source: at most `concurrency` calls to `mapper` are
in flight at once, and as soon as one finishes, the next input item (if any remain) starts
immediately — no waiting for sibling tasks in the same "batch" the way `mapChunked` does. Results are
yielded in **completion order, not input order** (documented explicitly; this matches what the
script already did — its success/error CSV rows were written in completion order, not file order). A
rejected `mapper` call does not stop the pool; the rejection is yielded in place of a result — see
[Alternatives considered](#alternatives-considered) for why `mapper` itself must catch and shouldn't
just `throw`, so this is really "yields whatever `mapper` returns," not built-in error swallowing.

### New in `simply-data-core`

```ts
type ContentNoteInput = {
  content: string; // plain body text; base64-encoded internally before the create call
  title: string;
  createdDate?: string; // ISO-8601; omitted entirely if not provided, instead of a broken numeric CreatedDate
  createdByFederationId?: string;
  linkedRecordExternalId: string; // looked up against the caller-supplied lookup map
};

type ContentNoteResult =
  | { status: 'success'; input: ContentNoteInput; contentNoteId: string; contentDocumentLinkId: string }
  | {
      status: 'error';
      input: ContentNoteInput;
      stage: 'note' | 'link' | 'lookup';
      contentNoteId?: string;
      message: string;
    };

function createContentNote(
  connection: Connection,
  input: ContentNoteInput,
  linkedEntityId: string,
): Promise<ContentNoteResult>;

function uploadContentNotes(
  connection: Connection,
  inputs: AsyncIterable<ContentNoteInput>,
  linkedEntityIdsByExternalId: Map<string, string>,
  options?: { concurrency?: number },
): AsyncGenerator<ContentNoteResult>;
```

`createContentNote` is the fixed single-record version of the script's per-row work: base64-encode
`content`, create the `ContentNote` (with `CreatedDate` sent as ISO-8601, only when provided, and
`CreatedBy.FederationIdentifier` only when `createdByFederationId` is provided), then create the
`ContentDocumentLink` (`ShareType: 'I'`, `Visibility: 'InternalUsers'`, matching the script). On a
link failure the result carries `stage: 'link'` **and** the already-created `contentNoteId`, so a
caller's error report can find and clean up (or manually re-link) an orphaned note — the original
script's data-loss bug. `linkedRecordExternalId` values with no entry in
`linkedEntityIdsByExternalId` produce a `stage: 'lookup'` error instead of calling
`ContentDocumentLink.create()` with an `undefined` `LinkedEntityId` (what the script did — that
create call would fail org-side anyway, but with a much less useful error).

`uploadContentNotes` is `mapConcurrent` over `createContentNote`, resolving each input's lookup key
first (a `stage: 'lookup'` error short-circuits before any DML). A caller writing the success/error
CSVs the script wrote will look like:

```ts
const lookup = new Map<string, string>();
for await (const record of queryRecords(conn, `SELECT Id, ${externalIdField} FROM ${sobject}`)) {
  lookup.set(record[externalIdField], record.Id);
}

for await (const result of uploadContentNotes(conn, notesFromCsv, lookup, { concurrency: 10 })) {
  await (result.status === 'success' ? successWriter : errorWriter).write(result);
}
```

## Alternatives considered

- **Extend `mapChunked` to accept an `AsyncIterable` instead of adding `mapConcurrent`.** Rejected:
  `mapChunked`'s contract (whole chunk finishes before the next starts, full input in memory) is used
  correctly by its existing callers for bounded describe()-style calls over an already-in-memory ID
  list, and changing its semantics to a sliding worker pool would be a behavior change for them, not
  an addition. A second function with a different, documented contract is clearer than one function
  with two modes.
- **Have `mapper`/`createContentNote` throw on failure and let `mapConcurrent` catch it.** Rejected:
  that forces one error shape (`{ status: 'error', message: string }` from a caught exception) onto
  every use of `mapConcurrent`, when `simply-plugins` commands elsewhere in this repo generally want
  typed, per-stage error information (here, `'note' | 'link' | 'lookup'`) that only the mapper itself
  knows how to produce. `mapConcurrent` stays a plain pool; error modeling is `createContentNote`'s
  job.
- **Keep the lookup-map construction inside `simply-data-core`** (e.g. a
  `buildExternalIdLookup(connection, sobject, field)` helper). Rejected: it would be three lines
  wrapping `queryRecords` with no behavior of its own, and it would force a fresh-query-only shape on
  something the script explicitly needed to make optional (`--use-cached`). Leaving the loop inline
  in caller code costs nothing and keeps the caching decision where it belongs — with whoever owns
  the filesystem.
- **Put the new types/functions in `simply-core` instead of `simply-data-core`**, since `ContentNote`
  is "just another sobject create." Rejected: `simply-core` has no sobject-specific code anywhere
  today (it's REST/Bulk/CSV/config plumbing); `ContentNote`'s base64 encoding and its
  `ContentDocumentLink` pairing are domain logic that belongs next to `ContentVersion`'s equally
  domain-specific multipart upload in `simply-data-core`.
- **A new `simply-content-note-core` package.** Rejected per `docs/design/README.md`'s bar for a new
  package — that's reserved for splitting a library out of an existing CLI plugin (the `002x`
  `-core`-extraction docs). There's no `simply-data note upload` plugin command this is being split
  out of.

## Implementation plan

1. `packages/simply-core/src/async/mapConcurrent.ts` — the worker-pool primitive, plus its export in
   `packages/simply-core/src/index.ts`.
2. `packages/simply-data-core/src/contentNoteTypes.ts` — `ContentNoteInput`, `ContentNoteResult`
   (mirroring how `contentVersionTypes.ts` sits next to `contentVersionUtils.ts`).
3. `packages/simply-data-core/src/contentNoteUtils.ts` — `createContentNote`, `uploadContentNotes`.
4. Export both from `packages/simply-data-core/src/index.ts`; add `@simplysf/simply-core` as a
   dependency of `simply-data-core`'s `package.json` (for `mapConcurrent`) if it isn't already there
   — check first, since other packages may already pull it in transitively.
5. Update both packages' `test/index.test.ts` export-pinning lists.
6. Update both packages' `README.md` with the new exports and a short usage example.
7. Update `site/src/content/docs/guides/simply-core.md` and `.../simply-data-core.md` with the same.
8. Delete `UploadContentNotes.md` from the repo root once the conversion lands — it was scratch input
   for this doc, not a file meant to stay.

## Testing

- `mapConcurrent`: all items processed exactly once regardless of source length vs. concurrency;
  never more than `concurrency` mapper calls in flight at once (assert via a counter inside a
  deliberately-delayed mapper); one rejected/errored mapper result doesn't stop the pool from
  draining the rest; an empty source yields nothing.
- `createContentNote`: success path asserts the exact `ContentNote.create()` payload (base64 content,
  ISO `CreatedDate`, `FederationIdentifier` only when given); `ContentNote` create failure short
  circuits before any `ContentDocumentLink` call; `ContentDocumentLink` create failure returns
  `stage: 'link'` with `contentNoteId` populated (the orphan-tracking fix); a
  `linkedRecordExternalId` absent from the lookup map returns `stage: 'lookup'` without calling
  `connection.sobject(...).create()` at all.
- `uploadContentNotes`: drives multiple `createContentNote` calls concurrently against a mocked
  `Connection` and confirms every input produces exactly one result.
- Both packages' `index.test.ts` updated for the new exported keys.

## Open questions

- Should a `simply data note upload` CLI command (in `simply-plugins`) be built on top of this in the
  same effort, or is the library layer the whole deliverable for now? This doc only designs the
  library layer either way; a CLI command would need its own design doc over there per that repo's
  process, covering flag names, `--use-cached`, and progress/spinner behavior.
- The original script's `--max-parallel-jobs` default was 10; carried into the usage example above as
  `uploadContentNotes`'s default `concurrency`, but not pinned as a hard default here — whoever writes
  the CLI wrapper should confirm 10 is still the right number rather than inheriting it silently.

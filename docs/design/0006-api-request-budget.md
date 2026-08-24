# 0006 — API request budget check

**Status:** Implemented
**Package:** `packages/simply-core` (shared helper) + `packages/simply-data` (first consumers)
**Date:** 2026-08-23

## Problem

`simply data files upload` and `simply data files download` issue one or more REST calls per file,
with no idea how much of the org's daily API allocation they are about to spend. A 5,000-file
upload against an org that has 8,000 calls left will consume the org's remaining allocation and take
every other integration down with it — and the operator finds out afterwards.

The ask: before starting, refuse to run if the work would consume more than a configurable share
(default 20%) of the API requests the org has left.

### What the commands actually cost

This is the part worth getting right, because the obvious count is wrong.

| Command                      | Requests                                                                       | Known before starting?       |
| ---------------------------- | ------------------------------------------------------------------------------ | ---------------------------- |
| `simply data file upload`    | **2** — the multipart POST, then a `singleRecordQuery` for `ContentDocumentId` | Yes, trivially               |
| `simply data files upload`   | **2 × rows**                                                                   | **No** — the CSV is streamed |
| `simply data files download` | `ceil(N / 2000)` query batches + **N** downloads                               | Yes, once the query returns  |

`uploadContentVersion` costs **two** calls per file, not one: Salesforce's create response returns
only the `ContentVersion` id, so the code re-queries for `ContentDocumentId`. Any budget check that
assumes one call per file will under-count by half.

`files upload` streams its CSV — `for await (const record of parser)` — so the row count is never
known up front. That is the one genuine obstacle to a pre-flight check, addressed below.

## How to read the org's remaining allocation

Two mechanisms exist, and the cheaper one is much better.

### `Sforce-Limit-Info` response header — free, fresh, no permission

Salesforce returns `Sforce-Limit-Info: api-usage=45/5000` on **every** REST response except the
Versions URI (`/`). jsforce already parses it, and `@salesforce/core`'s `Connection` inherits the
field:

```ts
connection.limitInfo; // { apiUsage?: { used: number; limit: number } }
```

Costs nothing, needs no extra permission, and is exact as of the last request rather than
approximate.

Two caveats, both load-bearing:

1. **It is empty until a request has been made.** jsforce initialises `limitInfo` to `{}` and only
   fills it from a response it handled.
2. **Our own file calls no longer feed it.** Since [0004](0004-undici-multipart-upload.md),
   `uploadContentVersion` and `downloadContentVersion` use raw `fetch` and bypass jsforce entirely,
   so their `Sforce-Limit-Info` headers are currently parsed by nobody. We hold the `Response`
   object, so capturing the header ourselves is a few lines — and it is what makes a running check
   (below) possible.

### `/limits` — costs a call, needs a permission, five minutes stale

`connection.limits()` returns `DailyApiRequests: { Max, Remaining }`. It requires **View Setup and
Configuration**, and Salesforce documents the values as "accurate within five minutes of resource
consumption". It also spends one of the calls being counted.

### Decision on sourcing

Prefer the header; fall back to `/limits`; degrade to a warning if neither is available.

| Situation                                          | Source                                                  |
| -------------------------------------------------- | ------------------------------------------------------- |
| A jsforce request has already happened this run    | `connection.limitInfo` — free and current.              |
| Nothing has happened yet (e.g. `files upload`)     | `connection.limits()`, accepting the one-call cost.     |
| `/limits` denied (no View Setup and Configuration) | Warn that the budget could not be checked, and proceed. |

That last row follows the same reasoning as the domain preflight in
[0003](0003-community-custom-url.md): an advisory check must not become a new permission requirement.
`files download` gets the free path for nothing, because its record query runs through jsforce
before any download starts.

**Every call counts, including the check's own.** There is no exempt category — the multipart POST,
the per-file `singleRecordQuery`, the record query, and `/limits` itself all decrement
`DailyApiRequests`. Two consequences:

- When the `/limits` fallback is used, its own call must be added to `plannedRequests`, because it is
  spent from the same allocation being measured. The header path costs nothing and needs no such
  adjustment.
- The `Remaining` that `/limits` reports already excludes that call, so it must not be subtracted
  twice.

This is also why the header path is the default rather than a nicety: the fallback perturbs the
quantity it is measuring, and the header does not.

## Decision

Add `checkApiBudget()` to `simply-core`, and call it from the three `simply-data` commands
through a thin `assertApiBudget()` wrapper that owns the throw-or-warn decision.

```ts
export type ApiBudgetResult = {
  status: 'ok' | 'exceeded' | 'unavailable';
  plannedRequests: number;
  remaining?: number;
  limit?: number;
  budget?: number; // maxUsagePercent% of remaining
  source?: 'header' | 'limits-api';
};

export async function checkApiBudget(
  connection: Connection,
  plannedRequests: number,
  options: { maxUsagePercent: number },
): Promise<ApiBudgetResult>;
```

The budget is a percentage of **remaining**, not of the daily maximum — an org that has already
burned 90% of its allocation should get a proportionally smaller budget, which is the whole point.

It lives in `simply-core` because nothing about it is file-specific; any command that can count its
requests in advance can use it. It goes next to `retryWithBackoff` and `queryRecords`, which are the
same kind of shared primitive.

### Solving the unknown row count in `files upload`

Count the CSV rows in a first pass, then stream it a second time for the actual work.

The count must come from `csv-parse`, not from counting `\n`, because a quoted field can contain
newlines. The cost is one extra local read of a local file — no API calls, no network — and it buys
an exact `plannedRequests` before anything is sent. For a CSV large enough for this to matter, the
upload it describes will dwarf it.

Rejected alternative: buffering the parsed rows in memory to avoid the second read. It trades a
cheap sequential read for unbounded memory on exactly the large inputs where the check matters most.

## Behavior

### Flag

| Flag              | Char | Default | Purpose                                                                          |
| ----------------- | ---- | ------- | -------------------------------------------------------------------------------- |
| `--max-api-usage` | —    | `20`    | Maximum percentage of the org's **remaining** API requests this run may consume. |

Integer, 1–100. To run anyway, raise it — `--max-api-usage 100` still refuses to start work that
cannot finish, which is correct, so no separate bypass flag is needed. (See open questions: a hard
`--skip-api-check` may still be wanted for orgs where limits are unreadable _and_ noisy.)

### The check

Runs **before any file request is made**, and after the record query in `files download` (so it can
use the free header path and the exact record count).

| Outcome              | Behavior                                                                                |
| -------------------- | --------------------------------------------------------------------------------------- |
| Planned ≤ budget     | Proceed silently.                                                                       |
| Planned > budget     | Error before any request, naming planned, remaining, the budget, and `--max-api-usage`. |
| Remaining unreadable | Warn that the budget could not be checked; proceed.                                     |
| Planned > remaining  | Error regardless of `--max-api-usage`, because the run demonstrably cannot finish.      |

Error message shape:

```text
This run needs 4,120 API requests but only 824 of the org's 8,240 remaining requests are budgeted
(--max-api-usage 20). Raise --max-api-usage, split the input, or wait for the daily limit to reset.
```

Concrete numbers matter more than prose here: the operator's next decision depends on how far over
they are.

### Result shape

`ApiBudgetResult` is included in each command's JSON output under `apiBudget`, so a pipeline can log
what was planned and what was left without re-deriving it.

## Alternatives considered

**Check the budget as a running total instead of up front.** Rejected as the primary mechanism, but
worth adding later — see Future work. A pre-flight check is what the operator actually wants: it
fails before any partial work exists. A running check that aborts at file 3,000 of 5,000 leaves the
job half-done, which is worse than not starting.

**Use `/limits` as the only source.** Rejected. It costs a call, is five minutes stale, and requires
View Setup and Configuration — which would make a permission the commands do not otherwise need into
a hard requirement.

**Budget as a percentage of the daily maximum rather than of remaining.** Rejected: 20% of `Max` is
meaningless in an org that already has 3% left. Remaining is the quantity the operator is protecting.

**Count one request per file.** Rejected because it is simply wrong for upload — see the cost table.
Recording this explicitly because it is the mistake this design is most likely to regress into.

**Put the helper in `simply-data`.** Rejected: nothing about it is file-specific, and `simply-cicd`
in particular has commands that could use the same guard.

**Make the check mandatory with no flag.** Rejected. Twenty percent is a reasonable default and a
terrible law; a deliberate bulk migration during a maintenance window is exactly when someone needs
to spend 80%.

## Implementation plan

1. **`packages/simply-core/src/org/apiBudget.ts`** — `checkApiBudget()` plus the
   remaining-allocation resolution (header → `/limits` → unavailable). Pure apart from the optional
   `/limits` call, so it is testable with a stub connection.
2. **Export it** from `simply-core`'s `index.ts`.
3. **`packages/simply-data/src/common/contentVersionUtils.ts`** — parse `Sforce-Limit-Info` from the
   `fetch` responses and expose the latest reading, restoring the tracking that 0004's move off
   jsforce silently dropped. Needed for step 6, useful immediately for reporting.
4. **`packages/simply-data/src/common/apiBudgetFlag.ts`** (new) — the shared `--max-api-usage`
   flag definition plus `assertApiBudget()`, so all three commands declare and enforce it
   identically. Named for what it holds rather than the generic `flags.ts` the draft proposed.
5. **`packages/simply-data/src/common/apiCost.ts`** (new) — `REQUESTS_PER_UPLOAD = 2`,
   `REQUESTS_PER_DOWNLOAD = 1`, and `requestsForQuery()`. Not in the draft; pulled out so the
   two-requests-per-upload fact lives in one named constant with the reasoning attached, rather
   than as a bare `* 2` at three call sites.
6. **`packages/simply-data/src/common/countCsvRows.ts`** (new) — the counting pass.
7. **Wire up the three commands** — `file upload` (planned = 2), `files download` (planned =
   `ceil(N/2000) + N`, checked after the query), `files upload` (planned = `2 × counted rows`, after
   the counting pass).
8. **`messages/apiBudget.md`** — one shared message file rather than the same flag text copied into
   three command message files, matching how the flag itself is declared once. The draft said
   "`messages/*.md` for all three commands", which would have put three copies of the description in
   the repo to drift apart.
9. **`pnpm run readme`** is not needed for `simply-data` (it regenerates on version bump), but **is**
   needed for any other package that later adopts the flag.
10. **`pnpm run build`** — `command-snapshot.json` **will** change this time, since a new flag is
    added to three commands. Confirmed: all three gained `max-api-usage`, and the orchestrator's
    snapshot regenerated too because `simply-data` is bundled into it. Both are committed.

## Testing

| Case                                                 | What it pins down                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Planned just under, exactly at, and just over budget | The boundary. Off-by-one here silently changes who gets blocked.                                       |
| `limitInfo` populated                                | Header path is used and no `/limits` call is made.                                                     |
| `limitInfo` empty                                    | Falls back to `/limits`.                                                                               |
| `/limits` throws (permission denied)                 | Warns, returns `unavailable`, and the command still runs.                                              |
| Planned > remaining, with `--max-api-usage 100`      | Still errors — the run cannot finish.                                                                  |
| `--max-api-usage` outside 1–100                      | Rejected at parse time.                                                                                |
| Upload planning                                      | Counts **2** per file, not 1.                                                                          |
| `/limits` fallback used                              | Its own call is added to `plannedRequests`, and `Remaining` is not decremented twice.                  |
| CSV with a quoted field containing a newline         | Row count matches what the streaming pass actually uploads — the count and the work must not disagree. |
| CSV counted twice                                    | Both passes see the same number of rows.                                                               |
| Budget exceeded                                      | **No API request is made** — assert the fetch stub was never called.                                   |

The last row is the one that matters most: the value of a pre-flight check is entirely in nothing
having happened when it fails.

NUTs: **not added, and this is the outstanding gap.** The plan called for extending
`files/upload.nut.ts` with a run at `--max-api-usage 1` to prove the guard trips against a real org.
Every test above stubs the connection, so nothing here has confirmed that a real org's
`Sforce-Limit-Info` header parses as expected or that `connection.limits()` returns
`DailyApiRequests` under the shape assumed. Both are the kind of thing only a live org settles, and
both are load-bearing. Worth adding before this is relied on in anger.

## Future work

**Halve `files upload`'s API cost.** The per-file `singleRecordQuery` for `ContentDocumentId` is
what makes uploads cost two calls. Replacing it with a single `WHERE Id IN (...)` query after all
uploads complete would cut consumption to `N + ceil(N/batch)` — close to half. That is a bigger win
than any budget check, and it should probably be done first if API pressure is the real concern.
It is out of scope here because it changes the shape of `uploadContentVersion`'s return value.

**Running check.** Once step 3 captures `Sforce-Limit-Info` per response, the queue can watch actual
consumption and abort mid-run if the org's remaining allocation drops faster than planned — which it
will if something else is hitting the org concurrently. Complements the pre-flight check rather than
replacing it.

## Open questions

- **Does `--max-api-usage 100` read as "no check"?** It does not — it still blocks work that cannot
  finish. That is the correct behavior but arguably a surprising reading of "100". A separate
  `--skip-api-check` would be unambiguous at the cost of a fourth flag. Undecided; leaning toward
  keeping one flag and being explicit in the help text.
- **How much does concurrency overshoot?** With `--max-parallel-jobs > 1`, a running check can
  overshoot by up to that many requests. Irrelevant for the pre-flight check, needs a decision if
  the running check is built.
- **Should the query batches really be counted?** `ceil(N/2000)` for `files download` assumes jsforce's
  default batch size and that `maxFetch` is not hit. Worth confirming against a real org with more
  than 2,000 records before relying on the number, rather than assuming the arithmetic.
- ~~**Do the raw `fetch` file calls even count toward `DailyApiRequests`?**~~ **Resolved:** they do.
  Every call counts, including the multipart POST, the per-file `singleRecordQuery`, the record
  query, and `/limits` itself. The cost table above is therefore the real cost, and the
  `2 × rows` figure for `files upload` is not an over-estimate.

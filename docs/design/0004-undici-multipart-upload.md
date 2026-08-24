# 0004 — Multipart file upload without `form-data`

**Status:** Draft
**Package:** `packages/simply-data`
**Date:** 2026-08-23

## Problem

`packages/simply-data/src/common/contentVersionUtils.ts` is the only file in the monorepo that uses
either `form-data` or `got`. It builds the `multipart/form-data` body for
`POST /sobjects/ContentVersion` with the legacy `form-data` package and sends it with `got`:

```ts
const form = new FormData();
form.append('entity_content', JSON.stringify(contentVersionCreateRequest), { contentType: 'application/json' });
form.append('VersionData', fs.createReadStream(pathOnClient), { filename: path.basename(pathOnClient) });

const data = await got.post(`${targetOrgConnection.baseUrl()}/sobjects/ContentVersion`, {
  body: form,
  headers: { 'Content-Type': `multipart/form-data; boundary="${form.getBoundary()}"` },
  ...
});
```

Moving to `undici` — or to Node's built-in `fetch`, which _is_ undici — breaks this. The failure is
worse than an exception.

## What actually happens: measured, not assumed

I ran every candidate against a local HTTP server that captures the raw request bytes, on Node
v24.15.0 with the bundled undici 7.24.4. The results below are copied from that capture, not from
documentation.

### The current code silently sends 17 bytes of garbage

Passing the legacy `form-data` object straight to `fetch` produces:

```
request content-type: multipart/form-data; boundary="--------------------------9050e201eece5461b5951c86"
body:                 [object FormData]
```

`form-data`'s object is a `CombinedStream`, not a web `ReadableStream`, not a `WHATWG FormData`, and
not a `BufferSource`. It matches none of undici's `BodyInit` branches, so it falls through to string
coercion. **No error is thrown.** The request goes out with a valid-looking multipart `Content-Type`
and the literal body `[object FormData]`, and the failure surfaces only as a confusing error from
Salesforce. Adding `duplex: 'half'` changes nothing, because the value was never treated as a stream
in the first place.

### WHATWG `FormData` structurally cannot produce what Salesforce wants

Salesforce's documented request format for a ContentVersion blob insert is:

```
--boundary_string
Content-Disposition: form-data; name="entity_content";
Content-Type: application/json

{ "Title": "...", "PathOnClient": "..." }

--boundary_string
Content-Type: application/octet-stream
Content-Disposition: form-data; name="VersionData"; filename="Q1 Sales Brochure.pdf"

Binary data goes here.
--boundary_string--
```

The JSON part needs **`Content-Type: application/json` and no `filename`**. WHATWG `FormData` gives
you one or the other, never both:

| `append()` value         | Emitted `Content-Disposition`                               | Emitted `Content-Type` |
| ------------------------ | ----------------------------------------------------------- | ---------------------- |
| plain string             | `form-data; name="entity_content"`                          | _(none)_               |
| `Blob`, no filename arg  | `form-data; name="entity_content"; filename="blob"`         | `application/json`     |
| `Blob` with filename arg | `form-data; name="entity_content"; filename="content.json"` | `application/json`     |

Per spec, a `Blob` part always gets a filename — defaulting to the literal string `blob` — and a
string part never gets a `Content-Type`. There is no third option. This is the core finding: the
incompatibility is in the standard, not in a library, so no amount of switching FormData
implementations fixes it.

Salesforce's own error for a malformed non-binary part is
`INVALID_MULTIPART_REQUEST: Multipart message must include a non-binary part`, which is consistent
with a filename causing the part to be classified as binary — though I have not confirmed that
against a live org, and it is the one thing worth checking before ruling option B out entirely.

### Manually setting `Content-Type` alongside WHATWG `FormData` corrupts the request

```
request content-type: multipart/form-data; boundary=my-own-boundary
body:                 ------formdata-undici-082545958631 ...
```

undici honours the caller's header but serializes the body with its own boundary. The two never
match and the server cannot parse the body at all. Worth stating explicitly because the current code
_does_ set `Content-Type` by hand, so this is the obvious thing to carry over — and it is exactly
wrong.

### Hand-building the body works and is byte-exact

Writing the multipart envelope directly and streaming it through
`Readable.toWeb(...)` with `duplex: 'half'` reproduces Salesforce's documented format exactly,
trailing semicolon and all:

```
--simplyboundary00000000
Content-Disposition: form-data; name="entity_content";
Content-Type: application/json

{"Title":"Q1 Brochure","PathOnClient":"Q1 Brochure.pdf"}
--simplyboundary00000000
Content-Type: application/octet-stream
Content-Disposition: form-data; name="VersionData"; filename="Q1 Brochure.pdf"

%PDF-1.4 fake binary payload
--simplyboundary00000000--
```

### Memory: 256 MB file, receiving server discarding the body

| Approach                              | Peak RSS delta |
| ------------------------------------- | -------------- |
| Hand-built stream                     | **11 MB**      |
| WHATWG `FormData` + `fs.openAsBlob()` | 52 MB          |

`fs.openAsBlob()` is genuinely lazy — it does not read the file into memory — but it still costs
roughly 5× the hand-built stream. Both are viable; only one is free.

### Full option matrix

| #   | Approach                                           | Reaches the wire?            | Matches SF format              | Streams | Change size        |
| --- | -------------------------------------------------- | ---------------------------- | ------------------------------ | ------- | ------------------ |
| A   | legacy `form-data` → `fetch` (today's code)        | **no — `[object FormData]`** | —                              | —       | status quo         |
| B   | WHATWG `FormData`, JSON part as `Blob`             | yes                          | no — adds `filename="blob"`    | yes     | medium             |
| C   | WHATWG `FormData`, JSON part as string             | yes                          | no — no `Content-Type`         | yes     | medium             |
| D   | WHATWG `FormData` + manual `Content-Type`          | yes                          | **broken — boundary mismatch** | —       | never              |
| E   | `Readable.toWeb(form)` on the `form-data` object   | **throws**                   | —                              | —       | —                  |
| I   | `form.pipe(new PassThrough())` → `toWeb` → `fetch` | yes                          | **yes — identical to today**   | yes     | ~3 lines           |
| H   | hand-built multipart stream                        | yes                          | **yes — matches the docs**     | yes     | ~60 lines, −2 deps |

E throws `TypeError: The "streamReadable" argument must be an stream.Readable. Received an instance
of FormData` — `CombinedStream` is not a `Readable` subclass, so the obvious one-line bridge doesn't
compile away the problem. Piping it into a real `PassThrough` first (option I) does work, and
produces byte-identical output to what ships today.

## Decision

**Adopt option H: hand-build the multipart body and send it with Node's built-in `fetch`.** Drop both
`form-data` and `got` from `simply-data`. Add nothing.

The repo's `engines` is `^22.13.0 || ^24.0.0 || ^26.0.0`, and every one of those has global `fetch`
backed by undici, plus `Blob`, `File`, and `fs.openAsBlob`. So this is a **net removal of two
dependencies with no new dependency**, not a swap of `got` for `undici`.

Option I is the stepping stone if the change needs to be small and reversible: it is three lines,
and it keeps the exact bytes that work in production today. Its problem is that it keeps a
dependency whose entire purpose — being a stream — now has to be worked around with a `PassThrough`
shim. If the team wants to land the undici migration in one PR and defer the rewrite, take I; if the
goal is to stop maintaining this seam, take H. This doc plans H.

### Why not option B

B is the "modern" answer and I wanted it to win. It loses on the `filename="blob"` problem above:
there is no way to suppress a `Blob` part's filename, and Salesforce's documented format has none.
If a live-org test shows Salesforce tolerates a filename on `entity_content`, B becomes viable and
is arguably tidier than H — so that test is listed as the first implementation step, not as an
afterthought.

## Behavior

No user-visible change. Same three commands, same flags, same output, same JSON result shapes:

- `simply data file upload`
- `simply data files upload`
- `simply data files download`

This is a pure internal refactor of `contentVersionUtils.ts`. If a message file or a README needs to
change, something has gone wrong.

### Upload

```ts
async function* multipartBody(entityJson: string, filePath: string, filename: string, boundary: string) {
  yield Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="entity_content";\r\n` +
      `Content-Type: application/json\r\n\r\n${entityJson}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/octet-stream\r\n` +
      `Content-Disposition: form-data; name="VersionData"; filename="${filename}"\r\n\r\n`,
    'utf8',
  );
  yield* fs.createReadStream(filePath);
  yield Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
}
```

Sent as `body: Readable.toWeb(Readable.from(multipartBody(...)))` with `duplex: 'half'` and
`Content-Type: multipart/form-data; boundary=${boundary}` — unquoted, matching what
`form-data.getHeaders()` produces and what jsforce sends.

Three details that are easy to get wrong and are the reason this is worth writing down:

| Detail              | Rule                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Boundary generation | `crypto.randomBytes(16).toString('hex')` with a fixed prefix. Must be ≤ 70 chars and must not occur in the body — random hex is how everyone satisfies this, and the odds are negligible, but say so rather than leaving it implied. |
| Filename escaping   | Percent-encode `"` → `%22`, `\r` → `%0D`, `\n` → `%0A`, the same normalization WHATWG `FormData` applies. `form-data` does _not_ do this today, so a file named `my"file.pdf` is a latent bug being fixed in passing.                |
| Boundary quoting    | Emit `boundary=abc`, not `boundary="abc"`. Both are legal per RFC 2046, but unquoted is what `form-data` and jsforce emit, so it is the form known to work against Salesforce.                                                       |

### Download

`got.stream(...)` becomes `fetch()` plus `Readable.fromWeb(response.body)` into the same
`stream.promises.pipeline`.

**`fetch` does not throw on non-2xx.** `got` does. This is the single most likely regression in the
whole change: a 401 or 404 currently throws, and after the migration it would happily pipe an error
page into a file with a `.pdf` extension. Every call site must check `response.ok` explicitly and
throw with the status and body.

### What `got` was providing, and what replaces it

| `got` feature          | Replacement                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Throw on non-2xx       | Explicit `if (!response.ok) throw ...` — see above.                                            |
| Retries                | `retryWithBackoff` from `@simplysf/simply-core`, already used by `simply-community`'s publish. |
| Timeouts               | `AbortSignal.timeout(ms)` passed as `signal`.                                                  |
| `responseType: 'json'` | `await response.json()` with an explicit result type.                                          |
| `resolveBodyOnly`      | Not needed.                                                                                    |

Retries are the one place to be careful: a retried upload must rebuild the body stream, because a
consumed stream cannot be replayed. The generator above is cheap to re-create; the helper should take
a factory, not a stream.

## Alternatives considered

**Keep `form-data`, bridge it with `PassThrough` (option I).** Not rejected so much as deferred — see
the Decision. It is the right call if this needs to be a minimal, obviously-safe diff. It is the
wrong call as an end state, because it retains a dependency purely to then work around it.

**Switch to a maintained third-party form-data encoder** (`formdata-node`, `form-data-encoder`).
Rejected: it trades one dependency for another to solve a problem that is ~60 lines of string
concatenation, and it does not fix the `filename` constraint, which comes from the WHATWG spec that
those libraries implement faithfully.

**Use `undici` as an explicit dependency rather than global `fetch`.** Rejected: every supported Node
version already ships undici as `fetch`. Adding the package would pin a second copy against the one
in the runtime for no benefit. If a future need appears for `Agent`/`Dispatcher` configuration —
proxies, connection pooling, mTLS — that is the point to add it, and it does not change this design.

**Skip multipart entirely and send `VersionData` as base64 in a plain JSON body.** Genuinely
attractive: it deletes the entire problem, and `@salesforce/core`'s connection can post JSON without
any of this. Rejected on limits. Salesforce caps non-multipart blob uploads at **37.5 MB of
base64-encoded data**, versus **2 GB for ContentVersion via multipart** on the sObject rows resource.
Base64 also inflates the payload by a third and forces the whole file into memory. Reasonable for a
narrow "small files only" path, not as the general implementation. (Related: the 50 MB
maximum-request-size error people hit on this endpoint is the non-multipart path running into that
cap.)

**Use jsforce's `multipartFileFields` option on `connection.create()`.** `@jsforce/jsforce-node`
3.10.22 is already in the tree and does support this. Rejected for two reasons, both from reading its
`_createSingle`: it builds the body with the same legacy `form-data` package, so it inherits this
exact bug the moment jsforce moves to fetch; and it does `Buffer.from(rec[fieldName], 'base64')`,
requiring the caller to hand it a fully base64-encoded file in memory. That is strictly worse than
the current streaming implementation. Worth revisiting only if jsforce rewrites it.

## Implementation plan

1. **Confirm the `filename` constraint against a live org.** Send a ContentVersion insert with
   `Content-Disposition: form-data; name="entity_content"; filename="content.json"` and see whether
   Salesforce accepts it. If it does, option B becomes viable and steps 2–3 get simpler; if it
   returns `INVALID_MULTIPART_REQUEST`, this doc's reasoning is confirmed. Either way this is 20
   minutes and it de-risks everything after it.
2. **`src/common/multipart.ts`** — boundary generation, filename escaping, and the body generator.
   Pure and synchronous apart from the file read, so it can be tested by consuming the generator and
   asserting on bytes, with no server involved.
3. **Rewrite `uploadContentVersion`** in `contentVersionUtils.ts` to use it plus global `fetch`,
   including the explicit `response.ok` check.
4. **Rewrite `downloadContentVersion`** to use `fetch` + `Readable.fromWeb`, with its own
   `response.ok` check.
5. **Drop `form-data` and `got`** from `packages/simply-data/package.json`.
6. **Tests** — `test/common/multipart.test.ts` (new), plus the existing unit tests for the three
   commands.
7. **Run the three existing NUTs.** They already cover upload and download end to end against a real
   org, which is what actually validates this change.
8. **`pnpm run build`** in the package. No README or `messages/` change, since nothing user-facing
   moves; `simply-data` regenerates its README automatically via its `version` lifecycle script
   anyway.

## Testing

The valuable tests here assert on **bytes**, not on behavior, because the entire bug class is
"the wire format looks right and isn't".

| Case                                        | What it pins down                                                                                                                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Golden-bytes test of the assembled envelope | Byte-for-byte comparison against Salesforce's documented example, including CRLFs and the trailing `;` after `name="entity_content"`. This is the regression test the current code never had. |
| Filename containing `"`, `\r`, `\n`         | Percent-encoded, and the resulting header cannot be broken out of.                                                                                                                            |
| Filename containing non-ASCII               | Round-trips as UTF-8 without mangling.                                                                                                                                                        |
| Boundary appears nowhere in the payload     | Guard on the random-boundary assumption.                                                                                                                                                      |
| Body generator consumed twice               | Produces identical bytes both times — the precondition for retries.                                                                                                                           |
| Empty (0-byte) file                         | Still produces a well-formed envelope with both parts.                                                                                                                                        |
| Non-2xx from upload and from download       | Throws, with status and response body in the message. The `got` → `fetch` regression, tested directly.                                                                                        |
| Download of a non-2xx response              | **Does not create a partial file on disk.** The nastiest form of the regression.                                                                                                              |
| Large-file memory ceiling                   | Streaming a file much larger than the heap does not blow up — asserts the property the design is chosen for.                                                                                  |

The three existing NUTs (`file/upload.nut.ts`, `files/upload.nut.ts`, `files/download.nut.ts`) are
the acceptance gate and should need no changes. If they need changes, the refactor changed behavior
and that is a bug.

## Open questions

- **Does Salesforce accept a `filename` on the `entity_content` part?** Step 1 answers it. It is the
  hinge for option B, and my evidence that it matters is indirect — the shape of the
  `INVALID_MULTIPART_REQUEST` error, plus the absence of a filename in every official example.
- **Does the `VersionData` part's `Content-Type` matter?** `form-data` sniffs it from the file
  extension today (`application/pdf` for a `.pdf`), while Salesforce's example uses
  `application/octet-stream` and Salesforce derives the real type from `PathOnClient`. The plan
  assumes `application/octet-stream` is always fine, which matches the docs but is a behavior change
  from what ships today. Worth confirming in step 1 alongside the filename question.
- **Should the 2 GB path be tested at all?** Almost certainly not in CI. But nothing currently
  documents the largest file these commands have actually moved, and the streaming claim deserves at
  least one manual check at a realistic size.
- **Does anything else in the monorepo want a shared HTTP helper?** `simply-data` is the only package
  using `got` today, so this stays local. If a second package needs `fetch` with retries and status
  checking, that helper belongs in `simply-core` next to `retryWithBackoff`, not copied.

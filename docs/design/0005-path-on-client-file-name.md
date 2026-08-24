# 0005 — Send only the file name as `PathOnClient`

**Status:** Implemented
**Package:** `packages/simply-data`
**Date:** 2026-08-23

## Problem

`uploadContentVersion` took a single `pathOnClient` parameter and used it for two different jobs:
the local path to open, and the value sent to the org as `ContentVersion.PathOnClient`.

```ts
await fs.promises.access(pathOnClient, fs.constants.F_OK);

const contentVersionCreateRequest: ContentVersionCreateRequest = {
  PathOnClient: pathOnClient, // <-- whatever the caller passed, verbatim
  Title: title ?? path.basename(pathOnClient),
};
```

So the uploader's local path was published into the org, where anyone who can query
`ContentVersion` can read it. Captured from the real code path before this change:

```json
{ "PathOnClient": "C:\\Users\\compu\\AppData\\Local\\Temp\\e2e-g2v24W\\Q1 Brochure.pdf", "Title": "Q1 Brochure" }
```

That is a username, a directory layout, and an OS — none of which the org needs. It was noticed
while verifying [0004](0004-undici-multipart-upload.md), because that change made the assembled
request body visible for the first time.

For `simply data files upload` the effect is worse: the CSV's `PathOnClient` column is read as the
local path, so whatever a user put in the CSV was forwarded verbatim to every record.

## Decision

Send `path.basename(filePath)` as `PathOnClient`. Rename the parameter to `filePath` so the two
jobs are no longer one variable.

```ts
const fileName = path.basename(filePath);

const contentVersionCreateRequest: ContentVersionCreateRequest = {
  PathOnClient: fileName,
  Title: title ?? fileName,
};
```

Salesforce derives `FileExtension` and `FileType` from `PathOnClient`, and the extension survives a
basename, so nothing functional is lost. The existing NUT already proves the derivation:
`--file-path test-files/watchDoge.jpg` asserts `FileExtension === 'jpg'`, and that assertion holds
unchanged when only `watchDoge.jpg` is sent.

Salesforce documents `PathOnClient` as the file's path on the user's machine, so sending the full
path is arguably the literal reading. It is the wrong trade anyway: the org gets no benefit from the
directories, and the uploader takes on a disclosure they almost certainly did not intend.

## Behavior

| Uploaded from                 | `PathOnClient` before         | `PathOnClient` after |
| ----------------------------- | ----------------------------- | -------------------- |
| `C:\Users\me\invoices\Q1.pdf` | `C:\Users\me\invoices\Q1.pdf` | `Q1.pdf`             |
| `test-files/watchDoge.jpg`    | `test-files/watchDoge.jpg`    | `watchDoge.jpg`      |
| `watchDoge.jpg`               | `watchDoge.jpg`               | `watchDoge.jpg`      |

Unchanged: `Title` still defaults to the file name and an explicit `--title` still wins;
`FileExtension` and `FileType` still resolve the same way; the CSV column stays named `PathOnClient`
and still means "the local path to read this file from"; no flags, no output shape, and no
`command-snapshot.json` change.

Both commands' `messages/*.md` now say plainly that only the file's name reaches the org.

## Alternatives considered

**Leave it, since Salesforce's field description says "path on the user's machine".** Rejected. The
documented intent does not make it a good default for a CLI that runs in CI, where the path is
typically a build-agent working directory that means nothing to anyone reading the record later.

**Add a flag to control it.** Rejected as a solution in search of a problem. No one has asked to set
`PathOnClient` independently of the file, and the field's only functional role is supplying the
extension. If a real need appears, an explicit `--path-on-client` can be added later without
disturbing this default.

**Strip only the directory when the path is absolute.** Rejected: it makes the value depend on how
the caller happened to invoke the command, so the same file uploaded two ways would produce two
different records. Always sending the name is the predictable rule.

**Rename the CSV's `PathOnClient` column** to something like `FilePath`, which is what it actually
means. Rejected for now — it is a documented, user-facing contract and renaming it breaks every
existing CSV. The message file now explains the distinction instead. Worth revisiting only alongside
a deliberate breaking change.

## Implementation plan

1. `src/common/contentVersionUtils.ts` — rename `pathOnClient` to `filePath`, derive `fileName`
   once, and use it for `PathOnClient`, the default `Title`, and the multipart part filename.
2. `messages/simply.data.file.upload.md` and `messages/simply.data.files.upload.md` — document that
   only the file name is sent.
3. `test/common/contentVersionUtils.test.ts` — new.
4. `pnpm run build`; `simply-data` regenerates its README on version bump, so no manual README step.

## Testing

New `test/common/contentVersionUtils.test.ts` asserts on the **serialized request body** rather than
on the object passed to the helper, because `PathOnClient` is only wrong once it has been sent.

| Case                                | What it pins down                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| File in a nested absolute directory | `PathOnClient` is the bare name, and neither the temp root nor the intermediate directory appears anywhere in the body. |
| File with an extension              | The extension survives — the property `FileExtension` derivation depends on.                                            |
| No `--title`                        | `Title` still defaults to the file name.                                                                                |
| Explicit title                      | Title wins, `PathOnClient` is still the bare name.                                                                      |
| Relative path from a different cwd  | Directory segments are still stripped.                                                                                  |

The three NUTs are unchanged. `file/upload.nut.ts` is the meaningful one: it asserts
`FileExtension === 'jpg'` against a real org, which is exactly the property this change could have
broken. It has not been run here — it needs a live org — so it remains the outstanding verification.

## Open questions

- **Is anyone relying on the full path being stored?** A consumer querying `ContentVersion` and
  parsing directories out of `PathOnClient` would break. It seems very unlikely to be deliberate,
  and the value was accidental, but it is the one way this lands as a regression rather than a fix.
- **Should `Title` and `PathOnClient` be allowed to diverge further?** They now share a default. That
  is fine today, but if a `--path-on-client` flag is ever added, the interaction between the two
  defaults wants thinking through rather than bolting on.

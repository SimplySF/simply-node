# 0003 — `simply community url set`

**Status:** Draft
**Package:** `packages/simply-community`
**Date:** 2026-08-23

## Problem

Pointing an Experience Cloud site at a custom URL is environment-specific: the same branch deploys
to a sandbox as `uat-partners.acme.com` and to production as `partners.acme.com`. The domain lives in
committed metadata, so every pipeline that deploys a site ends up hand-scripting an edit to that
metadata just before the deploy — `sed` against `.site-meta.xml`, or a bespoke Node script per repo.

Those scripts are brittle for a specific reason: the value isn't in one place, and it isn't where
people expect. "Modify the network metadata" is the common shorthand, but the domain is not on
`Network` at all.

| What                       | File                                  | Element                             |
| -------------------------- | ------------------------------------- | ----------------------------------- |
| Custom domain              | `sites/<Site>.site-meta.xml`          | `customWebAddresses` → `domainName` |
| Primary-URL flag           | `sites/<Site>.site-meta.xml`          | `customWebAddresses` → `primary`    |
| URL path prefix            | `sites/<Site>.site-meta.xml`          | `urlPathPrefix`                     |
| URL path prefix (again)    | `networks/<Network>.network-meta.xml` | `urlPathPrefix`                     |
| Link between the two files | `networks/<Network>.network-meta.xml` | `site` → the CustomSite API name    |

A real `CustomSite` (`siteType` `ChatterNetwork`, i.e. an Experience Cloud site) carries:

```xml
<customWebAddresses>
    <domainName>helpdesk.example.com</domainName>
    <primary>false</primary>
</customWebAddresses>
<subdomain>examplepets</subdomain>
<urlPathPrefix>help</urlPathPrefix>
```

So a correct change touches two files that have to stay in agreement, and a script that only knows
about one of them silently half-works.

## Decision

Add `sf simply community url set` to `packages/simply-community`, under a new `url` subtopic beside
the existing `simply community publish`.

The command **patches the working tree in place** and stops. It does not deploy, and it does not
restore. It's a pre-deploy step that composes with whatever deploy command the pipeline already
runs:

```sh
sf simply community url set --site Partner_Portal --domain partners.acme.com --path-prefix partners
sf project deploy start --source-dir force-app --target-org prod
```

`simply-community` is the right home: it already owns the `simply community` topic vocabulary and
the Experience Cloud domain, and it's bundled into the `@simplysf/simply` orchestrator, so the
command ships to everyone rather than only to direct installs.

### Two constraints that shape the design

**Writing `customWebAddresses` is replace-all, not additive.** Per the CustomSite metadata reference:
"Saving or deploying a CustomSite replaces all root custom URLs in the site with the root custom
URLs in this list." The command therefore replaces the whole list with a single entry rather than
appending — appending would imply a merge that the deploy is going to discard anyway. Non-root path
custom URLs are unaffected.

**The domain must already exist in the target org.** `Domain` and `DomainSite` are not in the
`@salesforce/source-deploy-retrieve` metadata registry (verified against the copy in this repo's
`node_modules`), so the CLI cannot source-deploy them. Registering the domain is a one-time Setup
step (Setup → Custom URLs) plus a CNAME at the DNS provider. This command sets which domain the site
claims; it cannot create the domain.

## Behavior

```sh
sf simply community url set --site Partner_Portal --domain partners.acme.com
sf simply community url set --site Partner_Portal --domain partners.acme.com --path-prefix partners
```

### Flags

| Flag            | Char | Required | Purpose                                                                      |
| --------------- | ---- | -------- | ---------------------------------------------------------------------------- |
| `--site`        | `-s` | yes      | CustomSite API name — the basename of `sites/<name>.site-meta.xml`.          |
| `--domain`      | `-d` | yes      | Fully qualified custom domain, e.g. `partners.acme.com`.                     |
| `--path-prefix` | `-p` | no       | URL path prefix. When given, written to **both** the site and network files. |
| `--primary`     | —    | no       | Whether the entry is the site's primary URL. Defaults to `true`.             |
| `--directory`   | —    | no       | Root to search. Defaults to the package directories in `sfdx-project.json`.  |

**On `-d`:** the `sf` CLI convention is `-d` = `--source-dir`, and `simply project update api-version`
follows it with `--directory -d`. This command deliberately diverges: `--domain` is typed on every
invocation and `--directory` is almost always defaulted, so the short char goes to the flag that
earns it. `--directory` keeps its long form only.

### Resolution rules

| Step              | Rule                                                                                                                 | On failure                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Find site file    | Glob `<directory>/**/sites/<--site>.site-meta.xml`. Exactly one match required.                                      | Error naming the glob, or listing the ambiguous matches. |
| Find network file | Only when `--path-prefix` is given. Any `<directory>/**/networks/*.network-meta.xml` whose `<site>` equals `--site`. | Error if zero or more than one match.                    |

The network file is looked up **only** when `--path-prefix` is supplied. Setting a domain alone
doesn't touch `Network`, so a missing or ambiguous network file isn't an error in that case — which
also means the command works for Salesforce Sites that have no `Network` at all.

### What it writes

To `sites/<Site>.site-meta.xml`:

- Replaces every existing `customWebAddresses` element with exactly one, containing `domainName`
  (from `--domain`) and `primary` (from `--primary`, default `true`).
- Sets `urlPathPrefix` when `--path-prefix` is given.

To `networks/<Network>.network-meta.xml`, only when `--path-prefix` is given:

- Sets `urlPathPrefix` to the same value.

### Output

A table of files changed, and this JSON result:

```ts
export type CommunityUrlSetResult = {
  site: string;
  domain: string;
  primary: boolean;
  pathPrefix?: string;
  siteFile: string;
  networkFile?: string;
  previousDomains: string[];
};
```

`previousDomains` records what the replace-all discarded, so a pipeline log shows what was dropped
rather than silently losing it.

### Errors

| Condition                                         | Behavior                                                    |
| ------------------------------------------------- | ----------------------------------------------------------- |
| No site file matches `--site`                     | Error, naming the glob that was tried.                      |
| More than one site file matches                   | Error, listing the matched paths.                           |
| `--path-prefix` given, no network references site | Error naming the CustomSite API name that was searched for. |
| `--path-prefix` given, multiple networks match    | Error, listing the matched paths.                           |
| Site file isn't parseable XML                     | Error, naming the file.                                     |

## Alternatives considered

**Connect REST API instead of metadata.** Salesforce exposes Custom Domain resources in the Connect
REST API. Rejected for v1 on two grounds. First, I could not confirm write support — both reference
pages (`connect_resources_custom_domain_custom_urls_site` and the Custom Domain Resources section of
the Connect REST API core reference) returned 404, so the capability is unverified. Second, and more
decisively, it solves a different problem: it mutates org state, but the committed metadata still
carries the old domain, so the next deploy overwrites whatever the API set. The value has to be
right in the source for the deploy to be correct. Worth revisiting as a verification aid, not as the
mechanism.

**Deploy `Domain` / `DomainSite` metadata so the command can create the domain too.** Not possible.
Neither type is in the SDR metadata registry, so `sf project deploy start` can't handle them. The
domain stays a Setup prerequisite.

**Patch, deploy, then restore in one command.** Rejected. It would have to re-expose
`sf project deploy start`'s flag surface and reproduce its error handling, and it introduces a
failure mode in-place patching doesn't have: if the restore doesn't run, the tree is left dirty in a
way nobody expected. In-place patching has one obvious state — the files are patched — and CI
checkouts are disposable.

**Patch into a temp copy and deploy from there.** Rejected for the same composition reason: the temp
directory only holds the two changed files, so the caller would need to assemble a package pairing
it with the rest of the source. That's more pipeline plumbing than the `sed` it replaces.

**Patch plus a separate restore command.** Rejected: the pipeline then has to guarantee the restore
runs even when the deploy fails, which is exactly the kind of scripting this command exists to
delete.

**Targeted regex surgery, as `simply project update api-version` does.** Genuinely attractive — it
keeps diffs minimal, which matters if someone runs this locally. Rejected because that command swaps
a scalar (`<apiVersion>`) whereas this one inserts and removes a repeated structured element.
Regexes over repeated blocks are where this class of tool breaks. Using `xmlbuilder2` (already a
dependency of `simply-permissions`) costs a possible one-time reformat of unrelated whitespace on
first run; acceptable given the in-place, CI-oriented use, but it is a real cost and is the thing to
revisit if local use turns out to be common.

**Home it in `simply-cicd`.** Rejected: `simply-cicd` is published standalone and deliberately not
bundled into the orchestrator, so the command would only reach people who install it directly.

## Implementation plan

Files added or changed, in the order they'd be written:

1. **`packages/simply-community/package.json`** — add the `url` subtopic under
   `oclif.topics.simply.subtopics.community.subtopics`, matching how `simply-package` nests
   `version`; add the `xmlbuilder2` dependency.
2. **`src/common/siteMetadataXml.ts`** — parse, mutate, and serialize `CustomSite` and `Network`
   documents. Owns the replace-all semantics for `customWebAddresses` and the `urlPathPrefix` write.
3. **`src/common/resolveSiteFiles.ts`** — the glob and one-match rules above, including finding the
   `Network` whose `<site>` element matches. Uses `readSfdxProject` from `@simplysf/simply-core` to
   default `--directory` to the project's package directories.
4. **`src/commands/simply/community/url/set.ts`** — the command.
5. **`messages/simply.community.url.set.md`** — summary, description, flag summaries, examples.
6. **Tests** — `test/common/siteMetadataXml.test.ts`, `test/common/resolveSiteFiles.test.ts`,
   `test/commands/simply/community/url/set.test.ts`.
7. **`pnpm run readme`** in `packages/simply-community` — this package does not regenerate its README
   automatically, and there's no CI check for a stale one.
8. **`pnpm run build`** in the package to regenerate `command-snapshot.json`. Because
   `simply-community` is bundled into `@simplysf/simply`, a root build also regenerates the
   orchestrator's snapshot — commit both.

## Testing

Unit tests, against fixture XML written to a temp directory. No org interaction, so no NUTs.

| Case                                                     | What it pins down                                                                                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Site file with 0, 1, and 3 existing `customWebAddresses` | Always exactly one entry afterwards; `previousDomains` reports what was dropped.                                                                |
| `--path-prefix` omitted                                  | Network file is not opened, let alone written.                                                                                                  |
| `--path-prefix` given                                    | Both files end up with the same prefix.                                                                                                         |
| 0, 1, and 2 networks whose `<site>` matches              | Error / success / error, with the paths named.                                                                                                  |
| Run the command twice                                    | Second run is a byte-identical no-op — the guard against reformat churn on every pipeline run.                                                  |
| Domain containing XML-significant characters             | Escaped via `xmlbuilder2`'s text handling, not hand-rolled escaping (matching the note in `simply-permissions`' `permissionSetXmlTemplate.ts`). |
| Site not found, ambiguous site match                     | Error messages name the glob and the matches.                                                                                                   |
| Site file that isn't valid XML                           | Error names the file rather than surfacing a parser stack trace.                                                                                |

## Open questions

- **Should `--primary false` be rejected when the result is a single entry?** A site whose only root
  custom URL is non-primary is probably invalid. Options: force `true` when there's one entry, warn,
  or pass it through and let the deploy fail. Undecided; leaning toward warn.
- **Multiple domains per site.** The replace-all semantics make a repeatable `--domain` flag the
  natural shape for v2 (e.g. `www.acme.com` primary plus an alias). Out of scope for v1, but the
  result type and the internal API should not assume exactly one.
- **Optional `--target-org` preflight** that verifies the domain is registered before patching would
  catch the most common failure — deploying a domain the org doesn't know about. Deferred because I
  have not verified that the `Domain` object is SOQL-queryable with the fields needed; confirm
  against an org before committing to the flag.
- **`<certificate>`** on `SiteWebAddress`, for orgs terminating HTTPS with a named cert, is
  deliberately out of scope per the agreed decision. Revisit if anyone needs it.

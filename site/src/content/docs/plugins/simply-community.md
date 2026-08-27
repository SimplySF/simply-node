---
title: '@simplysf/simply-community'
description: 'Utilities for working with Salesforce Communities (Experience Cloud sites)'
---

Utilities for working with Salesforce Communities (Experience Cloud sites)

```sh
sf plugins install @simplysf/simply-community
```

## Commands

## `sf simply community publish`

Publish a Salesforce Community (Experience Cloud site), waiting until the publish completes.

```
USAGE
  $ sf simply community publish -o <value> --name <value> [--json] [--flags-dir <value>] [--api-version <value>] [--wait
    <value>] [--retry-attempts <value>] [--retry-backoff <value>] [--ignore-errors]

FLAGS
  -o, --target-org=<value>      (required) Username or alias of the target org. Not required if the `target-org`
                                configuration variable is already set.
      --api-version=<value>     Override the api version used for api requests made by this command
      --ignore-errors           Log a warning and exit successfully if the publish fails, instead of throwing an error.
      --name=<value>            (required) Name of the community (Experience Cloud site) to publish.
      --retry-attempts=<value>  Number of additional attempts to make if the initial publish request fails, before
                                giving up. Defaults to 0 (no retries). Does not apply to polling for the publish job's
                                completion, which already retries until --wait elapses.
      --retry-backoff=<value>   [default: 2] Factor the delay between publish request retries grows by after each failed
                                attempt (e.g. 2 doubles the delay each time). Only relevant when --retry-attempts is
                                greater than 0.
      --wait=<value>            [default: 15] Minutes to wait for the publish to complete before giving up. Salesforce's
                                own publish jobs time out after 15 minutes server-side, so waiting longer than that has
                                no effect.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Publish a Salesforce Community (Experience Cloud site), waiting until the publish completes.

  Looks up the community by `--name`, triggers a publish via the Connect REST API, then polls until the publish job
  reaches a terminal state — throwing an error if it fails, rather than returning as soon as the publish request is
  accepted. The Salesforce CLI's own `sf community publish` command does not wait for completion; this command exists to
  fill that gap for pipelines that need to know publishing actually succeeded before continuing.

EXAMPLES
  $ sf simply community publish --target-org my-org --name "My Community"

  $ sf simply community publish --target-org my-org --name "My Community" --wait 20

  $ sf simply community publish --target-org my-org --name "My Community" --retry-attempts 3 --retry-backoff 2

  $ sf simply community publish --target-org my-org --name "My Community" --ignore-errors
```

_See code: [lib/commands/simply/community/publish.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-community@0.4.1/packages/simply-community/lib/commands/simply/community/publish.js)_

## `sf simply community url set`

Set an Experience Cloud site's custom domain (and optionally its URL path prefix) by patching the site's metadata in place.

```
USAGE
  $ sf simply community url set -s <value> -d <value> [--json] [--flags-dir <value>] [-p <value>] [--primary] [--directory
    <value>] [--deploy] [--publish] [-o <value>] [--api-version <value>] [-w <value>] [--ignore-missing-domain]

FLAGS
  -d, --domain=<value>         (required) Fully qualified custom domain to set, e.g. `partners.acme.com`. Must already
                               be registered in the target org (Setup → Custom URLs); this command cannot register one.
  -o, --target-org=<value>     Username or alias of the target org.
  -p, --path-prefix=<value>    URL path prefix. When given, written to both the site file and the `Network` metadata
                               file that references the site.
  -s, --site=<value>           (required) CustomSite API name — the basename of `sites/<name>.site-meta.xml`.
  -w, --wait=<value>           [default: 33] Minutes to wait for the deploy to complete before giving up. Matches `sf
                               project deploy start`'s default of 33. Only relevant with --deploy.
      --api-version=<value>    Override the api version used for api requests made by this command
      --deploy                 Deploy the files this command changed, then restore their original contents so the
                               working tree ends up unmodified. Requires --target-org.
      --directory=<value>      Root directory to search for the site (and, if needed, network) metadata files. Defaults
                               to searching every package directory listed in sfdx-project.json. Also used as the
                               destination if the site file needs to be retrieved from --target-org, defaulting in that
                               case to the project's default package directory.
      --ignore-missing-domain  Downgrade "domain is not registered in this org" from an error to a warning, and proceed
                               anyway. Has no effect without --target-org, since there's no check to ignore.
      --[no-]primary           Whether the custom domain entry is the site's primary URL. Pass --no-primary to set it
                               false. Defaults to true.
      --publish                After a successful deploy, publish the site and wait for the publish to complete.
                               Requires --deploy.

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Set an Experience Cloud site's custom domain (and optionally its URL path prefix) by patching the site's metadata in
  place.

  Patches `sites/<Site>.site-meta.xml` — replacing its `customWebAddresses` with a single entry for `--domain` — and,
  when `--path-prefix` is given, also patches `urlPathPrefix` on both that file and the `Network` metadata file that
  references the site. It does not touch anything else, and by default it does not deploy: this is a pre-deploy step
  meant to run right before whatever deploy command the pipeline already runs.

  Pass `--deploy` to also deploy just the files this command changed and restore their original contents afterwards, so
  the working tree is left exactly as it found it — the only lasting change is in the org. Add `--publish` to publish
  the site after a successful deploy.

  A domain must already be registered in the target org (Setup → Custom URLs) before a site can be pointed at it; this
  command cannot register one. When `--target-org` is given, it checks the domain is registered before writing anything,
  so a typo surfaces immediately instead of as an opaque deploy failure.

  If the site file isn't found locally and `--target-org` is given, it's retrieved from the org instead of erroring — a
  warning says so, since a `--site` typo now triggers a retrieve rather than a fast local error. This only applies to
  the site file; a missing `Network` metadata file (needed for `--path-prefix` or `--publish`) still errors even with
  `--target-org`.

EXAMPLES
  $ sf simply community url set --site Partner_Portal --domain partners.acme.com

  $ sf simply community url set --site Partner_Portal --domain partners.acme.com --path-prefix partners

  $ sf simply community url set --site Partner_Portal --domain partners.acme.com --target-org my-org --ignore-missing-domain

  $ sf simply community url set --site Partner_Portal --domain partners.acme.com --deploy --target-org my-org

  $ sf simply community url set --site Partner_Portal --domain partners.acme.com --path-prefix partners --deploy --publish --target-org my-org

  $ sf simply community url set --site Partner_Portal --domain partners.acme.com --deploy --target-org my-org # retrieves the site file first if it isn't found locally
```

_See code: [lib/commands/simply/community/url/set.js](https://github.com/SimplySF/simply-node/blob/@simplysf/simply-community@0.4.1/packages/simply-community/lib/commands/simply/community/url/set.js)_

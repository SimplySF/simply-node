# summary

Set an Experience Cloud site's custom domain (and optionally its URL path prefix) by patching the site's metadata in place.

# description

Patches `sites/<Site>.site-meta.xml` — replacing its `customWebAddresses` with a single entry for `--domain` — and, when `--path-prefix` is given, also patches `urlPathPrefix` on both that file and the `Network` metadata file that references the site. It does not touch anything else, and by default it does not deploy: this is a pre-deploy step meant to run right before whatever deploy command the pipeline already runs.

Pass `--deploy` to also deploy just the files this command changed and restore their original contents afterwards, so the working tree is left exactly as it found it — the only lasting change is in the org. Add `--publish` to publish the site after a successful deploy.

A domain must already be registered in the target org (Setup → Custom URLs) before a site can be pointed at it; this command cannot register one. When `--target-org` is given, it checks the domain is registered before writing anything, so a typo surfaces immediately instead of as an opaque deploy failure.

# flags.site.summary

CustomSite API name — the basename of `sites/<name>.site-meta.xml`.

# flags.domain.summary

Fully qualified custom domain to set, e.g. `partners.acme.com`. Must already be registered in the target org (Setup → Custom URLs); this command cannot register one.

# flags.path-prefix.summary

URL path prefix. When given, written to both the site file and the `Network` metadata file that references the site.

# flags.primary.summary

Whether the custom domain entry is the site's primary URL. Pass --no-primary to set it false. Defaults to true.

# flags.directory.summary

Root directory to search for the site (and, if needed, network) metadata files. Defaults to searching every package directory listed in sfdx-project.json.

# flags.deploy.summary

Deploy the files this command changed, then restore their original contents so the working tree ends up unmodified. Requires --target-org.

# flags.publish.summary

After a successful deploy, publish the site and wait for the publish to complete. Requires --deploy.

# flags.wait.summary

Minutes to wait for the deploy to complete before giving up. Matches `sf project deploy start`'s default of 33. Only relevant with --deploy.

# flags.ignore-missing-domain.summary

Downgrade "domain is not registered in this org" from an error to a warning, and proceed anyway. Has no effect without --target-org, since there's no check to ignore.

# info.patched

Patched %s.

# info.deploying

Deploying changed files...

# info.deployAlsoFailed

The deploy also failed: %s

# info.deploySucceeded

The deploy (id %s) succeeded.

# info.publishing

Publishing site "%s"...

# warning.ignoreMissingDomainNoOrg

--ignore-missing-domain has no effect without --target-org: there was no domain check to ignore.

# warning.domainCheckUnavailable

Could not check whether domain "%s" is registered in the target org (the query itself failed) — proceeding without that check.

# warning.domainMissingIgnored

Domain "%s" is not registered in the target org. Proceeding because --ignore-missing-domain was passed; the deploy will fail unless the domain is registered before it runs.

# warning.domainBoundElsewhere

Site "%s"'s domain is already bound to a different site (id: %s). This is legal — e.g. intentionally repointing a domain — but verify it's expected.

# error.invalidSiteXml

%s is not valid XML: %s

# error.invalidNetworkXml

%s is not valid XML: %s

# error.deployFailed

Deploy failed: %s. Original files have been restored; re-running without --deploy reproduces the same patch on disk for inspection.

# error.restoreFailed

Failed to restore original file contents after --deploy: %s (%s). %s The working tree is left modified — restore these files manually.

# error.deployRequiresTargetOrg

--deploy requires --target-org: it's the org the changed files get deployed to.

# error.publishRequiresDeploy

--publish requires --deploy: publishing without deploying would publish whatever is already in the org, not the change this command just made.

# error.domainNotRegistered

Domain "%s" is not registered in org %s (Setup → Custom URLs). Pass --ignore-missing-domain to proceed anyway.

# error.publishFailed

Deploy succeeded, but publishing site "%s" failed: %s. Re-running this command with --publish alone is not a supported retry; publish the site directly instead.

# examples

- <%= config.bin %> <%= command.id %> --site Partner_Portal --domain partners.acme.com

- <%= config.bin %> <%= command.id %> --site Partner_Portal --domain partners.acme.com --path-prefix partners

- <%= config.bin %> <%= command.id %> --site Partner_Portal --domain partners.acme.com --target-org my-org --ignore-missing-domain

- <%= config.bin %> <%= command.id %> --site Partner_Portal --domain partners.acme.com --deploy --target-org my-org

- <%= config.bin %> <%= command.id %> --site Partner_Portal --domain partners.acme.com --path-prefix partners --deploy --publish --target-org my-org

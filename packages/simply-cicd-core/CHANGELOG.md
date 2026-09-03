# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 0.2.0 (2026-09-03)

### Features

- add simply-cicd-core ([#186](https://github.com/SimplySF/simply-node/issues/186)) ([0471fd5](https://github.com/SimplySF/simply-node/commit/0471fd5bfc9868e0ad810d0f0e4ed6d933325d88)), closes [#123](https://github.com/SimplySF/simply-node/issues/123) [#111](https://github.com/SimplySF/simply-node/issues/111) [pre-#109](https://github.com/pre-/issues/109)

### BREAKING CHANGES

- --auth-url, --client-id, --instance-url, --jwt-key-file,
  and --username are removed from every deploy/notify command that targets
  the deployment org, and --packaging-devhub-username/-client-id/-instance-url
  are collapsed into a single --packaging-devhub <alias> flag. --alias and
  --packaging-devhub now expect an already-authenticated org alias instead
  of driving in-process authentication.
- --dev-hub-name/--dev-hub-username/--dev-hub-client-id/
  --dev-hub-instance-url are removed from build create-scratch,
  delete-scratch, and cleanup-scratch-orgs in favor of a single --dev-hub
  <alias> flag (repeatable on create-scratch/cleanup-scratch-orgs, single
  on delete-scratch); each alias must already be authenticated by the
  calling pipeline. --jwt-key-file is no longer required on
  create-scratch, delete-scratch, cleanup-scratch-orgs, push-scratch,
  test-scratch, and install-dependencies.
- notify project's --jira-base-url and --jira-project-key
  flags are renamed to --alm-base-url and --alm-project-key, along with
  their SIMPLY_CICD_* environment variables. No aliases are kept.
  The .sfdevrc.json jiraProjectKey/jiraProjectKeys fields are NOT breaking
  — they still work, with a deprecation warning.
- sfdx-dependabot's --gitlab-api-url, --gitlab-token, and
  --mr-labels flags are renamed to --vcs-api-url, --vcs-token, and
  --change-request-labels, along with their SIMPLY_CICD_* and
  SFDX_DEPENDABOT_* environment variables. No aliases are kept; pipelines
  invoking this command must be updated.

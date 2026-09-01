# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.8.9](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.8.8...%40simplysf%2Fsimply-cicd%400.8.9) (2026-09-01)

**Note:** Version bump only for package @simplysf/simply-cicd

## [0.8.8](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.8.7...%40simplysf%2Fsimply-cicd%400.8.8) (2026-08-31)

**Note:** Version bump only for package @simplysf/simply-cicd

## [0.8.7](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.8.6...%40simplysf%2Fsimply-cicd%400.8.7) (2026-08-31)

### Bug Fixes

- **security:** address CodeQL findings in test workflow and simply-cicd ([ac2a333](https://github.com/SimplySF/simply-node/commit/ac2a3337f12845785e83b23b4a2dd5b929b2054a))

## [0.8.6](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.8.5...%40simplysf%2Fsimply-cicd%400.8.6) (2026-08-30)

**Note:** Version bump only for package @simplysf/simply-cicd

## [0.8.5](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.8.4...%40simplysf%2Fsimply-cicd%400.8.5) (2026-08-27)

**Note:** Version bump only for package @simplysf/simply-cicd

## [0.8.4](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.8.3...%40simplysf%2Fsimply-cicd%400.8.4) (2026-08-24)

**Note:** Version bump only for package @simplysf/simply-cicd

## [0.8.3](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.8.2...%40simplysf%2Fsimply-cicd%400.8.3) (2026-08-21)

**Note:** Version bump only for package @simplysf/simply-cicd

## [0.8.2](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.8.1...%40simplysf%2Fsimply-cicd%400.8.2) (2026-08-21)

**Note:** Version bump only for package @simplysf/simply-cicd

## [0.8.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.8.0...%40simplysf%2Fsimply-cicd%400.8.1) (2026-08-20)

**Note:** Version bump only for package @simplysf/simply-cicd

# [0.8.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.7.0...%40simplysf%2Fsimply-cicd%400.8.0) (2026-08-20)

- fix(cicd)!: delegate Salesforce org authentication to the caller ([e31ab58](https://github.com/SimplySF/simply-node/commit/e31ab5883ab70aced45ac774d1026c5ccabfe7c8))

### BREAKING CHANGES

- --auth-url, --client-id, --instance-url, --jwt-key-file,
  and --username are removed from every deploy/notify command that targets
  the deployment org, and --packaging-devhub-username/-client-id/-instance-url
  are collapsed into a single --packaging-devhub <alias> flag. --alias and
  --packaging-devhub now expect an already-authenticated org alias instead
  of driving in-process authentication.

# [0.7.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.6.1...%40simplysf%2Fsimply-cicd%400.7.0) (2026-08-20)

- fix(cicd)!: generalize scratch-org Dev Hub auth beyond JWT ([8b6c737](https://github.com/SimplySF/simply-node/commit/8b6c737c029404e83b79fd5d43d41c72e0ae3953))

### BREAKING CHANGES

- --dev-hub-name/--dev-hub-username/--dev-hub-client-id/
  --dev-hub-instance-url are removed from build create-scratch,
  delete-scratch, and cleanup-scratch-orgs in favor of a single --dev-hub
  <alias> flag (repeatable on create-scratch/cleanup-scratch-orgs, single
  on delete-scratch); each alias must already be authenticated by the
  calling pipeline. --jwt-key-file is no longer required on
  create-scratch, delete-scratch, cleanup-scratch-orgs, push-scratch,
  test-scratch, and install-dependencies.

## [0.6.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.6.0...%40simplysf%2Fsimply-cicd%400.6.1) (2026-08-20)

**Note:** Version bump only for package @simplysf/simply-cicd

# [0.6.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.5.4...%40simplysf%2Fsimply-cicd%400.6.0) (2026-08-20)

### Bug Fixes

- **cicd:** rename devhub-tooling-* flags to packaging-devhub-* ([de2d055](https://github.com/SimplySF/simply-node/commit/de2d055a661354ee49b6100289619acd16ed908f))

### Features

- **cicd:** track upgraded-package stories for happy-soup deployments ([c931249](https://github.com/SimplySF/simply-node/commit/c931249b69cbc6008ed71fc96d9425a6e6ce1e6d))

## [0.5.4](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.5.3...%40simplysf%2Fsimply-cicd%400.5.4) (2026-08-18)

**Note:** Version bump only for package @simplysf/simply-cicd

## [0.5.3](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.5.2...%40simplysf%2Fsimply-cicd%400.5.3) (2026-08-18)

**Note:** Version bump only for package @simplysf/simply-cicd

## [0.5.2](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.5.1...%40simplysf%2Fsimply-cicd%400.5.2) (2026-08-18)

**Note:** Version bump only for package @simplysf/simply-cicd

## [0.5.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.5.0...%40simplysf%2Fsimply-cicd%400.5.1) (2026-08-18)

**Note:** Version bump only for package @simplysf/simply-cicd

# [0.5.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.4.2...%40simplysf%2Fsimply-cicd%400.5.0) (2026-08-18)

- refactor(cicd)!: abstract the issue tracker behind an AlmProvider ([06423e2](https://github.com/SimplySF/simply-node/commit/06423e2d17ba945818c57a5547a4f467180dabba)), closes [#123](https://github.com/SimplySF/simply-node/issues/123)
- refactor(cicd)!: make sfdx-dependabot provider-neutral ([6cb7742](https://github.com/SimplySF/simply-node/commit/6cb77429d9beee15d918c036bd520df875e6fccd))

### Features

- **cicd:** add a GitHub VCS provider ([d1e7e34](https://github.com/SimplySF/simply-node/commit/d1e7e34cdbd7c02ae66e38fc08620415b877e13a))

### BREAKING CHANGES

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

## [0.4.2](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.4.1...%40simplysf%2Fsimply-cicd%400.4.2) (2026-08-18)

**Note:** Version bump only for package @simplysf/simply-cicd

## [0.4.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.4.0...%40simplysf%2Fsimply-cicd%400.4.1) (2026-08-18)

**Note:** Version bump only for package @simplysf/simply-cicd

# [0.4.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.3.0...%40simplysf%2Fsimply-cicd%400.4.0) (2026-08-18)

### Features

- publish cicd ([87057f1](https://github.com/SimplySF/simply-node/commit/87057f14d9d7721058c732265969c1025c1726fd))

# 0.3.0 (2026-08-17)

### Bug Fixes

- **cicd:** remove SIMPLY_CICD_* env support from multi-value flags ([9c399c7](https://github.com/SimplySF/simply-node/commit/9c399c719ea7ee05aa31165bbbc96fadbc2229ca))
- **cicd:** satisfy camelcase lint rule for flow/flexipage-delta env var test keys ([d192e1b](https://github.com/SimplySF/simply-node/commit/d192e1bd0473cdd5f7cd136c52bb9fa09750668f))
- **cicd:** satisfy EnvLogger's call signature in appendToEnvFile test mocks ([922700b](https://github.com/SimplySF/simply-node/commit/922700b3816a6cb80df66d599916359c35b46c5f))
- **ci:** guard the manual "publish missing from npm" path too ([2cbb8a6](https://github.com/SimplySF/simply-node/commit/2cbb8a6b8e8c0b8658c40f8ccdfa2b2b9ff04593))
- documentation fixes ([558f0a0](https://github.com/SimplySF/simply-node/commit/558f0a0e3c0bfce2c43bbf38719c31c314b615d6))
- incorrect plugins directory ([201c46e](https://github.com/SimplySF/simply-node/commit/201c46e1d15626eebdb8413a9e01cda7a0e9b1eb))

### Features

- **cicd:** add build diff and lwc-jest tooling commands ([ba32587](https://github.com/SimplySF/simply-node/commit/ba3258791991fd9f5a3e3be77147a77691947d99))
- **cicd:** add build package-version and tag lifecycle commands ([908829c](https://github.com/SimplySF/simply-node/commit/908829c3337392108d5f7f625076023439235235))
- **cicd:** add build scratch-org lifecycle commands ([1b95d10](https://github.com/SimplySF/simply-node/commit/1b95d107e9ac11b886315dbdaedc3546cc017a86))
- **cicd:** add deploy happy-soup command group ([63c0430](https://github.com/SimplySF/simply-node/commit/63c0430a68ac8e190a04d4aeb9e5c995d28df913))
- **cicd:** add deploy orchestration core and generic validate command ([3ade31e](https://github.com/SimplySF/simply-node/commit/3ade31e96bc044077276d8ea29e0885d9d6e0cfe))
- **cicd:** add deploy project command group ([d0f2fa3](https://github.com/SimplySF/simply-node/commit/d0f2fa36f317470676d0f7684d0628a7925d430c))
- **cicd:** add notify command group ([c496e5b](https://github.com/SimplySF/simply-node/commit/c496e5b3b62888ac1f943510c0a6477ecc39a89b))
- **cicd:** add sfdx-dependabot command ([8b1c566](https://github.com/SimplySF/simply-node/commit/8b1c5667bccf20833e15d5a823f5a105887c271b))
- **cicd:** add simply-cicd shared infrastructure ([acc9522](https://github.com/SimplySF/simply-node/commit/acc952213cda287f9cc729844758f83e296868fc))
- **cicd:** support SIMPLY_CICD_* environment variables for common flags ([8a8be9e](https://github.com/SimplySF/simply-node/commit/8a8be9ebd4fc604f4eb9ed266f482e6e4ad73676))

## [0.2.3](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.2.2...%40simplysf%2Fsimply-cicd%400.2.3) (2026-08-17)

**Note:** Version bump only for package @simplysf/simply-cicd

## [0.2.2](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.2.1...%40simplysf%2Fsimply-cicd%400.2.2) (2026-08-16)

### Bug Fixes

- documentation fixes ([7855aac](https://github.com/SimplySF/simply-node/commit/7855aac511916147d3ab542e5c4d660b2a348386))

## [0.2.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-cicd%400.2.0...%40simplysf%2Fsimply-cicd%400.2.1) (2026-08-16)

### Bug Fixes

- incorrect plugins directory ([1b8ee04](https://github.com/SimplySF/simply-node/commit/1b8ee0494fe191a5cdfca011722efeb739442061))

# 0.2.0 (2026-08-16)

### Bug Fixes

- **cicd:** satisfy camelcase lint rule for flow/flexipage-delta env var test keys ([0d9616f](https://github.com/SimplySF/simply-node/commit/0d9616f38c211f380495af60203f14d3a3676056))
- **cicd:** satisfy EnvLogger's call signature in appendToEnvFile test mocks ([563a556](https://github.com/SimplySF/simply-node/commit/563a556ba6a96d44c4be6495220c350206a356ee))

### Features

- **cicd:** add build diff and lwc-jest tooling commands ([01fe2b7](https://github.com/SimplySF/simply-node/commit/01fe2b7db568d39b70ad6ab200ef97a80181dad3))
- **cicd:** add build package-version and tag lifecycle commands ([2f01d3e](https://github.com/SimplySF/simply-node/commit/2f01d3eca4ef606b280fcae97d8bce8ce0528c8b))
- **cicd:** add build scratch-org lifecycle commands ([e0d3f92](https://github.com/SimplySF/simply-node/commit/e0d3f92459720069966840339b16d305fc59a65b))
- **cicd:** add deploy happy-soup command group ([b076785](https://github.com/SimplySF/simply-node/commit/b076785dae0deeabe423cfd8d2d075d613134086))
- **cicd:** add deploy orchestration core and generic validate command ([8c71c2d](https://github.com/SimplySF/simply-node/commit/8c71c2d4f729069848b0ba0633c642ebf4be5e44))
- **cicd:** add deploy project command group ([5b33674](https://github.com/SimplySF/simply-node/commit/5b33674bfa611fef867d7be65b5653ba1ca78cf3))
- **cicd:** add notify command group ([fba37fb](https://github.com/SimplySF/simply-node/commit/fba37fb85c64b634960a4e505623495046c90319))
- **cicd:** add sfdx-dependabot command ([116d88d](https://github.com/SimplySF/simply-node/commit/116d88deec84f21eab6379d5b4477dc70ae6aee4))
- **cicd:** add simply-cicd shared infrastructure ([fe0e4bc](https://github.com/SimplySF/simply-node/commit/fe0e4bc7c7c85ca4cbe3dec9ae9d4b7076739267))

# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.4.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-project-setup-core%400.3.0...%40simplysf%2Fsimply-project-setup-core%400.4.0) (2026-09-04)

- feat(simply-project-setup-core)!: remove the .sfdevrc.json config-file opinion (#188) ([6456dcb](https://github.com/SimplySF/simply-node/commit/6456dcb3fe31a8bb92e68275345ed2262aacf50e)), closes [#188](https://github.com/SimplySF/simply-node/issues/188)

### BREAKING CHANGES

- sfdevrcSchema, Sfdevrc, loadSfdevrc, findSfdevrcPath, and
  buildBranchRegex are no longer exported. resolveSetupConfig's `sfdevrc` option
  is renamed to `localOverrides` and no longer wraps include/exclude in a
  `setup` key. No simply-plugins consumer exists yet for this unreleased
  package, so there's nothing to coordinate.

  See docs/design/0035-simply-project-setup-core.md.

# [0.3.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply-project-setup-core%400.2.0...%40simplysf%2Fsimply-project-setup-core%400.3.0) (2026-09-03)

### Features

- **simply-project-setup-core:** add jsonMergeFiles and regexCustomizations file strategies ([#187](https://github.com/SimplySF/simply-node/issues/187)) ([7cabf04](https://github.com/SimplySF/simply-node/commit/7cabf0419a65ceaab56950f840ca6596490f0130))

# 0.2.0 (2026-09-03)

### Features

- add simply-project-setup-core ([#182](https://github.com/SimplySF/simply-node/issues/182)) ([27bfd22](https://github.com/SimplySF/simply-node/commit/27bfd221533fc52534e65506f0354d57ace25be5))

# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [3.4.2](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%403.4.1...%40simplysf%2Fsimply%403.4.2) (2026-08-28)

**Note:** Version bump only for package @simplysf/simply

## [3.4.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%403.4.0...%40simplysf%2Fsimply%403.4.1) (2026-08-28)

**Note:** Version bump only for package @simplysf/simply

# [3.4.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%403.3.0...%40simplysf%2Fsimply%403.4.0) (2026-08-28)

### Features

- **simply-flow:** allow pruning by explicit flow name ([54ab2bd](https://github.com/SimplySF/simply-node/commit/54ab2bd1a201f4e04522fe6e0d9a5174e894cd20))

# [3.3.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%403.2.1...%40simplysf%2Fsimply%403.3.0) (2026-08-28)

### Features

- **simply-flow:** rename flow delete's --file flag to --manifest ([b967311](https://github.com/SimplySF/simply-node/commit/b9673110a504c95d822b65503aab1b0cbecfa180))

## [3.2.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%403.2.0...%40simplysf%2Fsimply%403.2.1) (2026-08-27)

**Note:** Version bump only for package @simplysf/simply

# [3.2.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%403.1.0...%40simplysf%2Fsimply%403.2.0) (2026-08-27)

### Features

- **simply-flow:** add flow delete and version prune commands ([997ed35](https://github.com/SimplySF/simply-node/commit/997ed3503a37251e74e68ae63c25108c22cd0887))
- **simply-permissions:** add assignment delete command ([3dfdc95](https://github.com/SimplySF/simply-node/commit/3dfdc9559f02662cfa2f173b83d875dcb3409d6c))

# [3.1.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%403.0.1...%40simplysf%2Fsimply%403.1.0) (2026-08-27)

### Features

- **simply-aep:** add domain-process-binding create/set commands ([b3ea68d](https://github.com/SimplySF/simply-node/commit/b3ea68d06bae9f4c6e2a687704aefa34818d2abd))

## [3.0.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%403.0.0...%40simplysf%2Fsimply%403.0.1) (2026-08-26)

**Note:** Version bump only for package @simplysf/simply

# [3.0.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.22.3...%40simplysf%2Fsimply%403.0.0) (2026-08-26)

- feat(simply-aep)!: add domain-process-binding validate command ([a50e066](https://github.com/SimplySF/simply-node/commit/a50e066b1ff3c564e9afb8ba9a355addc7d1758b)), closes [#127](https://github.com/SimplySF/simply-node/issues/127)

### BREAKING CHANGES

- `scanLocalDomainProcessBindings` (@simplysf/simply-aep-core)
  now returns `{ records, malformed, ambiguous }` instead of
  `RawDomainProcessBindingRecord[]`. Update any direct consumer to destructure
  `{ records }` from the result.

## [2.22.3](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.22.2...%40simplysf%2Fsimply%402.22.3) (2026-08-26)

**Note:** Version bump only for package @simplysf/simply

## [2.22.2](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.22.1...%40simplysf%2Fsimply%402.22.2) (2026-08-25)

**Note:** Version bump only for package @simplysf/simply

## [2.22.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.22.0...%40simplysf%2Fsimply%402.22.1) (2026-08-24)

**Note:** Version bump only for package @simplysf/simply

# [2.22.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.21.0...%40simplysf%2Fsimply%402.22.0) (2026-08-24)

### Features

- **simply-aep:** add simply aep at4dx domain-process-binding list ([aff62cb](https://github.com/SimplySF/simply-node/commit/aff62cb7b0384e9f781f3166a8c9110b76257e7b))

# [2.21.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.20.1...%40simplysf%2Fsimply%402.21.0) (2026-08-24)

### Features

- **simply-aep:** add simply aep at4dx binding list ([a41e65f](https://github.com/SimplySF/simply-node/commit/a41e65f6b2e98a6edcd325eed658ef95c29f9a30))

## [2.20.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.20.0...%40simplysf%2Fsimply%402.20.1) (2026-08-24)

**Note:** Version bump only for package @simplysf/simply

# [2.20.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.19.0...%40simplysf%2Fsimply%402.20.0) (2026-08-24)

### Features

- **simply-community:** add simply community url set ([8daa898](https://github.com/SimplySF/simply-node/commit/8daa898b10389270714a8bdf3758e0a6063c639c))

# [2.19.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.18.2...%40simplysf%2Fsimply%402.19.0) (2026-08-24)

### Features

- **simply-data:** add --max-api-usage budget check to file commands ([a9e6126](https://github.com/SimplySF/simply-node/commit/a9e612655c5de02d6b9ad489895629fb88864bf4))

## [2.18.2](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.18.1...%40simplysf%2Fsimply%402.18.2) (2026-08-24)

**Note:** Version bump only for package @simplysf/simply

## [2.18.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.18.0...%40simplysf%2Fsimply%402.18.1) (2026-08-24)

**Note:** Version bump only for package @simplysf/simply

# [2.18.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.17.0...%40simplysf%2Fsimply%402.18.0) (2026-08-22)

### Features

- **simply-package:** add simply package version get ([1cc5629](https://github.com/SimplySF/simply-node/commit/1cc562954b7bb9b753c9847e46834b0d5027ae78))

# [2.17.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.16.1...%40simplysf%2Fsimply%402.17.0) (2026-08-21)

### Features

- **simply-package:** add retry support to package dependencies install ([cef03f5](https://github.com/SimplySF/simply-node/commit/cef03f59caf26a89e0c2262bf1d5084f643a0cab))

## [2.16.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.16.0...%40simplysf%2Fsimply%402.16.1) (2026-08-21)

### Bug Fixes

- improve sibling build resolution ([1a0d185](https://github.com/SimplySF/simply-node/commit/1a0d185e619a9523876a928dd527edadcbe09b65))

# [2.16.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.15.0...%40simplysf%2Fsimply%402.16.0) (2026-08-21)

### Features

- force release ([a013ea7](https://github.com/SimplySF/simply-node/commit/a013ea76cd52c71f8a959c12d517834f8cf3a048))

# [2.15.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.14.2...%40simplysf%2Fsimply%402.15.0) (2026-08-21)

### Bug Fixes

- out of date snapshot ([95f4fd8](https://github.com/SimplySF/simply-node/commit/95f4fd8693f5263021b29e1c49990b6753065510))

### Features

- **community:** add retry/backoff and ignore-errors flags to publish ([aa70cc2](https://github.com/SimplySF/simply-node/commit/aa70cc25dd4cf6392b6da4d05850961da6475928))
- **community:** add simply community publish command ([56a0a14](https://github.com/SimplySF/simply-node/commit/56a0a14c45d37247d74bc2e409ec7248fc528b34))

## [2.14.2](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.14.1...%40simplysf%2Fsimply%402.14.2) (2026-08-20)

**Note:** Version bump only for package @simplysf/simply

## [2.14.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.14.0...%40simplysf%2Fsimply%402.14.1) (2026-08-20)

**Note:** Version bump only for package @simplysf/simply

# [2.14.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.13.1...%40simplysf%2Fsimply%402.14.0) (2026-08-19)

### Features

- **apex:** add preset flags to silence common base classes ([bcb0acb](https://github.com/SimplySF/simply-node/commit/bcb0acbc1cff712f11660a67571ed759ca0e21b7))

## [2.13.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.13.0...%40simplysf%2Fsimply%402.13.1) (2026-08-19)

**Note:** Version bump only for package @simplysf/simply

# [2.13.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.12.7...%40simplysf%2Fsimply%402.13.0) (2026-08-19)

### Bug Fixes

- **simply:** sync command-snapshot with apex trace setup flag order ([14eb58a](https://github.com/SimplySF/simply-node/commit/14eb58a47aea18b983ec2a3127434416b66a3212))
- **simply:** sync command-snapshot with sobject backup additional-fields flag ([a2f4de4](https://github.com/SimplySF/simply-node/commit/a2f4de4df8032f5338b014abd3077256240bacfd))

### Features

- add start end date and log level to trace setup ([bdacb57](https://github.com/SimplySF/simply-node/commit/bdacb5759f803f3bd96114a98d2f1d86db0e747b))

## [2.12.7](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.12.6...%40simplysf%2Fsimply%402.12.7) (2026-08-19)

**Note:** Version bump only for package @simplysf/simply

## [2.12.6](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.12.5...%40simplysf%2Fsimply%402.12.6) (2026-08-18)

**Note:** Version bump only for package @simplysf/simply

## [2.12.5](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.12.4...%40simplysf%2Fsimply%402.12.5) (2026-08-18)

**Note:** Version bump only for package @simplysf/simply

## [2.12.4](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.12.3...%40simplysf%2Fsimply%402.12.4) (2026-08-18)

**Note:** Version bump only for package @simplysf/simply

## [2.12.3](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.12.2...%40simplysf%2Fsimply%402.12.3) (2026-08-18)

### Bug Fixes

- **apex:** update simply command-snapshot for --on-behalf-of flag ([96c5976](https://github.com/SimplySF/simply-node/commit/96c5976399c3fd7441af654e69f1c3c24ab31b23))

## [2.12.2](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.12.1...%40simplysf%2Fsimply%402.12.2) (2026-08-18)

### Bug Fixes

- **apex:** commit the orchestrator command snapshot for the new purge flags ([7c4c614](https://github.com/SimplySF/simply-node/commit/7c4c614599d39bb5dc219ace94e6e1b461a1e4f5))

## [2.12.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.12.0...%40simplysf%2Fsimply%402.12.1) (2026-08-18)

**Note:** Version bump only for package @simplysf/simply

# [2.12.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.11.5...%40simplysf%2Fsimply%402.12.0) (2026-08-18)

### Features

- publish cicd ([87057f1](https://github.com/SimplySF/simply-node/commit/87057f14d9d7721058c732265969c1025c1726fd))

## [2.11.5](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.11.4...%40simplysf%2Fsimply%402.11.5) (2026-08-18)

**Note:** Version bump only for package @simplysf/simply

## [2.11.4](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.11.3...%40simplysf%2Fsimply%402.11.4) (2026-08-17)

**Note:** Version bump only for package @simplysf/simply

## [2.11.3](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.11.2...%40simplysf%2Fsimply%402.11.3) (2026-08-17)

**Note:** Version bump only for package @simplysf/simply

## [2.11.2](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.11.1...%40simplysf%2Fsimply%402.11.2) (2026-08-17)

**Note:** Version bump only for package @simplysf/simply

## [2.11.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.11.0...%40simplysf%2Fsimply%402.11.1) (2026-08-17)

**Note:** Version bump only for package @simplysf/simply

# [2.11.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.9.4...%40simplysf%2Fsimply%402.11.0) (2026-08-17)

### Bug Fixes

- documentation fixes ([558f0a0](https://github.com/SimplySF/simply-node/commit/558f0a0e3c0bfce2c43bbf38719c31c314b615d6))

### Features

- **cicd:** wire simply-cicd into the orchestrator plugin ([b3daf2f](https://github.com/SimplySF/simply-node/commit/b3daf2f197fb9522e1eabee830d0507448ef7c30))

## [2.10.3](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.10.2...%40simplysf%2Fsimply%402.10.3) (2026-08-17)

**Note:** Version bump only for package @simplysf/simply

## [2.10.2](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.10.1...%40simplysf%2Fsimply%402.10.2) (2026-08-16)

### Bug Fixes

- documentation fixes ([7855aac](https://github.com/SimplySF/simply-node/commit/7855aac511916147d3ab542e5c4d660b2a348386))

## [2.10.1](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.10.0...%40simplysf%2Fsimply%402.10.1) (2026-08-16)

### Bug Fixes

- incorrect plugins directory ([1b8ee04](https://github.com/SimplySF/simply-node/commit/1b8ee0494fe191a5cdfca011722efeb739442061))

# [2.10.0](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.9.4...%40simplysf%2Fsimply%402.10.0) (2026-08-16)

### Features

- **cicd:** wire simply-cicd into the orchestrator plugin ([3f2719b](https://github.com/SimplySF/simply-node/commit/3f2719bd09c5648589fb72596292203954a0b593))

## [2.9.4](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.9.3...%40simplysf%2Fsimply%402.9.4) (2026-08-16)

**Note:** Version bump only for package @simplysf/simply

## [2.9.3](https://github.com/SimplySF/simply-node/compare/%40simplysf%2Fsimply%402.9.2...%40simplysf%2Fsimply%402.9.3) (2026-08-16)

### Bug Fixes

- update repository urls ([bfae56d](https://github.com/SimplySF/simply-node/commit/bfae56d1f6526c5627746b56cd69120cf75b3c1c))

## [2.9.2](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.9.1...%40simplysf%2Fsimply%402.9.2) (2026-08-16)

### Bug Fixes

- failing build ([71b151b](https://github.com/SimplySF/simply/commit/71b151bf6b9b5e271dc838f101037d92962e348c))

## [2.9.1](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.9.0...%40simplysf%2Fsimply%402.9.1) (2026-08-14)

**Note:** Version bump only for package @simplysf/simply

# [2.9.0](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.8.0...%40simplysf%2Fsimply%402.9.0) (2026-08-14)

### Features

- add future support for other format types ([be74f41](https://github.com/SimplySF/simply/commit/be74f41c415b05903993cbf83d9de5822bdd9dce))

# [2.8.0](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.7.2...%40simplysf%2Fsimply%402.8.0) (2026-08-14)

### Features

- add document tool ([2c739ca](https://github.com/SimplySF/simply/commit/2c739cafe8280e1ac5f1a4374766897a3e0a2e22))
- add schema command ([6356c79](https://github.com/SimplySF/simply/commit/6356c794c03cb31bea29e5a477026cdf57b6aabb))

## [2.7.2](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.7.1...%40simplysf%2Fsimply%402.7.2) (2026-08-14)

**Note:** Version bump only for package @simplysf/simply

## [2.7.1](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.7.0...%40simplysf%2Fsimply%402.7.1) (2026-08-14)

### Bug Fixes

- update command snapshot ([24c36b0](https://github.com/SimplySF/simply/commit/24c36b00b535ff3cafa3787f6b59b14dc4aa727a))

# [2.7.0](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.6.8...%40simplysf%2Fsimply%402.7.0) (2026-08-14)

### Bug Fixes

- update command snapshot ([6ab965f](https://github.com/SimplySF/simply/commit/6ab965f5f53d832c8349f1a716ef5e8df82e6681))

### Features

- support install report file ([9efe964](https://github.com/SimplySF/simply/commit/9efe964d129ebc2edd9a0640fed912e7cbbd5439))

## [2.6.8](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.6.7...%40simplysf%2Fsimply%402.6.8) (2026-08-13)

### Bug Fixes

- update command snapshot ([7a42075](https://github.com/SimplySF/simply/commit/7a42075096e352b3177b23d344638821e2130c4f))

## [2.6.7](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.6.6...%40simplysf%2Fsimply%402.6.7) (2026-08-13)

**Note:** Version bump only for package @simplysf/simply

## [2.6.6](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.6.5...%40simplysf%2Fsimply%402.6.6) (2026-08-13)

**Note:** Version bump only for package @simplysf/simply

## [2.6.5](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.6.4...%40simplysf%2Fsimply%402.6.5) (2026-08-13)

**Note:** Version bump only for package @simplysf/simply

## [2.6.4](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.6.3...%40simplysf%2Fsimply%402.6.4) (2026-08-13)

**Note:** Version bump only for package @simplysf/simply

## [2.6.3](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.6.2...%40simplysf%2Fsimply%402.6.3) (2026-08-13)

**Note:** Version bump only for package @simplysf/simply

## [2.6.2](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.6.1...%40simplysf%2Fsimply%402.6.2) (2026-08-13)

**Note:** Version bump only for package @simplysf/simply

## [2.6.1](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.6.0...%40simplysf%2Fsimply%402.6.1) (2026-08-13)

**Note:** Version bump only for package @simplysf/simply

# [2.6.0](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.5.1...%40simplysf%2Fsimply%402.6.0) (2026-08-13)

### Bug Fixes

- update command snapshot ([10a25f6](https://github.com/SimplySF/simply/commit/10a25f6d7b0ae05bccf88dc9bc17f33fa738b688))

### Features

- add missing plugins ([e66b749](https://github.com/SimplySF/simply/commit/e66b749c85596859b422374534cb3ee1159b7855))

## [2.5.1](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.5.0...%40simplysf%2Fsimply%402.5.1) (2026-08-13)

**Note:** Version bump only for package @simplysf/simply

# [2.5.0](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.4.6...%40simplysf%2Fsimply%402.5.0) (2026-08-13)

### Features

- add additional plugins ([8b1cd26](https://github.com/SimplySF/simply/commit/8b1cd26a3f94624a2adbe9e59890cee7b41d544c))

## [2.4.6](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.4.5...%40simplysf%2Fsimply%402.4.6) (2026-08-12)

**Note:** Version bump only for package @simplysf/simply

## [2.4.5](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.4.4...%40simplysf%2Fsimply%402.4.5) (2026-08-12)

**Note:** Version bump only for package @simplysf/simply

## [2.4.4](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.4.3...%40simplysf%2Fsimply%402.4.4) (2026-08-12)

**Note:** Version bump only for package @simplysf/simply

## [2.4.3](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.4.2...%40simplysf%2Fsimply%402.4.3) (2026-08-11)

**Note:** Version bump only for package @simplysf/simply

## [2.4.2](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.4.1...%40simplysf%2Fsimply%402.4.2) (2026-08-11)

**Note:** Version bump only for package @simplysf/simply

## [2.4.1](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.4.0...%40simplysf%2Fsimply%402.4.1) (2026-08-11)

**Note:** Version bump only for package @simplysf/simply

# [2.4.0](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.3.1...%40simplysf%2Fsimply%402.4.0) (2026-08-11)

### Features

- add build logic for command snapshot ([2edb0d4](https://github.com/SimplySF/simply/commit/2edb0d4ae7cd5cf71f585e382c2c1edf1166013a))

## [2.3.1](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.3.0...%40simplysf%2Fsimply%402.3.1) (2026-08-10)

### Bug Fixes

- revert devdependency change ([ce9e431](https://github.com/SimplySF/simply/commit/ce9e4319292f20f69efe2ddc39b8a389baccb6cc))

# [2.3.0](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.2.8...%40simplysf%2Fsimply%402.3.0) (2026-08-09)

### Bug Fixes

- bad link-check command ([8095693](https://github.com/SimplySF/simply/commit/80956938d83b0bdfc17dd03b46ca1d58cdcb183d))

### Features

- upgrade dependencies ([7631028](https://github.com/SimplySF/simply/commit/7631028c48904fcf914a34a34b5ac0f1e646c051))

## [2.2.8](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.2.7...%40simplysf%2Fsimply%402.2.8) (2026-08-09)

**Note:** Version bump only for package @simplysf/simply

## [2.2.7](https://github.com/SimplySF/simply/compare/%40simplysf%2Fsimply%402.2.6...%40simplysf%2Fsimply%402.2.7) (2026-08-09)

**Note:** Version bump only for package @simplysf/simply

## [2.2.6](https://github.com/SimplySF/simply/compare/@simplysf/simply@2.2.5...@simplysf/simply@2.2.6) (2026-08-09)

**Note:** Version bump only for package @simplysf/simply

## [2.2.5](https://github.com/SimplySF/simply/compare/@simplysf/simply@2.2.4...@simplysf/simply@2.2.5) (2026-08-09)

**Note:** Version bump only for package @simplysf/simply

## [2.2.4](https://github.com/SimplySF/simply/compare/@simplysf/simply@2.2.3...@simplysf/simply@2.2.4) (2026-08-09)

**Note:** Version bump only for package @simplysf/simply

## [2.2.3](https://github.com/SimplySF/simply/compare/@simplysf/simply@2.2.2...@simplysf/simply@2.2.3) (2026-08-09)

### Bug Fixes

- remove shrinkwrap ([aa18fab](https://github.com/SimplySF/simply/commit/aa18fab3bee5ff3ac864a1dec62696cbf7d0bcbb))

## [2.2.2](https://github.com/SimplySF/simply/compare/@simplysf/simply@2.2.1...@simplysf/simply@2.2.2) (2026-08-09)

**Note:** Version bump only for package @simplysf/simply

## [2.2.1](https://github.com/SimplySF/simply/compare/@simplysf/simply@2.2.0...@simplysf/simply@2.2.1) (2026-08-09)

**Note:** Version bump only for package @simplysf/simply

# [2.2.0](https://github.com/SimplySF/simply/compare/2.1.1...2.2.0) (2026-05-14)

### Features

- bump simply-package version ([d4599f8](https://github.com/SimplySF/simply/commit/d4599f85ee6c1ec634c0c9319f14ee0a2f7000d0))

## [2.1.1](https://github.com/SimplySF/simply/compare/2.1.0...2.1.1) (2026-05-14)

### Bug Fixes

- bad repo name ([0a666ea](https://github.com/SimplySF/simply/commit/0a666eac54092519e1fcbf3b852c94549340bddb))

# [2.1.0](https://github.com/SimplySF/simply/compare/1.6.0...2.1.0) (2026-05-14)

### Features

- update plugin versions ([8cd5828](https://github.com/SimplySF/simply/commit/8cd5828f9a52fae85ee9b1fd34c26a2deb5f815b))

# [1.6.0](https://github.com/SimplySF/simply/compare/1.5.0...1.6.0) (2025-01-06)

### Features

- bump data and package versions ([c77f11c](https://github.com/SimplySF/simply/commit/c77f11ccb024f7a9c203dbe3ce85e99f495a5c9d))

# [1.5.0](https://github.com/SimplySF/simply/compare/1.4.0...1.5.0) (2024-12-28)

### Features

- bump simply-data version ([7d1f841](https://github.com/SimplySF/simply/commit/7d1f8416303301750650a41191a2d0a06e3f31d5))

# [1.4.0](https://github.com/SimplySF/simply/compare/1.3.2...1.4.0) (2024-12-27)

### Features

- upgrade simply data ([e782930](https://github.com/SimplySF/simply/commit/e782930d65a2052a3b7a6a776c3340aca83009fd))

## [1.3.2](https://github.com/SimplySF/simply/compare/1.3.1...1.3.2) (2024-04-08)

### Bug Fixes

- **deps:** bump @simplysf/simply-package from 1.2.0 to 1.2.4 ([f09ade9](https://github.com/SimplySF/simply/commit/f09ade9aef5151770c6f8de0a16db2b4ac6922c2))

## [1.3.1](https://github.com/SimplySF/simply/compare/1.3.0...1.3.1) (2024-04-08)

### Bug Fixes

- **deps:** bump @simplysf/simply-data from 1.2.0 to 1.2.1 ([529d6ee](https://github.com/SimplySF/simply/commit/529d6ee14adceff7d8bd959828bc16a8bf1fd060))

# [1.3.0](https://github.com/SimplySF/simply/compare/1.2.1...1.3.0) (2024-03-25)

### Features

- upgrade data and package ([fac18c1](https://github.com/SimplySF/simply/commit/fac18c182839246efe5a9cc834d2dd3d6456ba36))

## [1.2.1](https://github.com/SimplySF/simply/compare/1.2.0...1.2.1) (2024-03-13)

### Bug Fixes

- correct yarn lock ([092cd9c](https://github.com/SimplySF/simply/commit/092cd9c560e0a89cde0f5ef9ab9a2308cd1ddf45))

# [1.2.0](https://github.com/SimplySF/simply/compare/1.1.2...1.2.0) (2024-03-13)

### Features

- upgrade data/package deps ([85d3f54](https://github.com/SimplySF/simply/commit/85d3f542c4dc88f38e6c644c1e239229fb0a57e9))

## [1.1.2](https://github.com/SimplySF/simply/compare/1.1.1...1.1.2) (2024-03-05)

### Bug Fixes

- **deps:** bump @simplysf/simply-package from 1.1.2 to 1.1.4 ([89e2933](https://github.com/SimplySF/simply/commit/89e2933b66c1c73f8479586afbc9e33d9fc69939))

## [1.1.1](https://github.com/SimplySF/simply/compare/1.1.0...1.1.1) (2024-03-05)

### Bug Fixes

- **deps:** bump @simplysf/simply-data from 1.1.2 to 1.1.5 ([f997517](https://github.com/SimplySF/simply/commit/f997517d4c77d826082ea3266b4531e8f0e38bd6))

# [1.1.0](https://github.com/SimplySF/simply/compare/767527c95008af3ac96c3e904c34248dec558792...1.1.0) (2024-02-26)

### Bug Fixes

- incorrect github workflows ([552676d](https://github.com/SimplySF/simply/commit/552676d81583c2739c2175927d8f54d86e4833a3))

### Features

- update with simply versions ([767527c](https://github.com/SimplySF/simply/commit/767527c95008af3ac96c3e904c34248dec558792))

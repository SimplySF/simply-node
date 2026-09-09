/*
 * Copyright (c) 2026, SimplySF.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Connection, Lifecycle, NamedPackageDir, SfError, SfProject } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import {
  InstalledPackages,
  PackageEvents,
  PackagingSObjects,
  SubscriberPackageVersion,
  VersionNumber,
} from '@salesforce/packaging';
import sinon from 'sinon';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installPackageDependencies,
  type InstallPackageDependenciesOptions,
  type InstallPackageDependenciesProgress,
} from '../src/packageDependenciesInstall.js';

const SUBSCRIBER_PACKAGE_ID_A = '0330000000000AAA';
const SUBSCRIBER_PACKAGE_ID_B = '0330000000001AAA';

// Currently installed in the org: version 1.0.0.1 of package A.
const INSTALLED_VERSION_ID = '04t100000000000AAA';
// Same version as what's installed (1.0.0.1) but resolved via a different SubscriberPackageVersionId.
const SAME_VERSION_ID = '04t100000000004AAA';
// A newer version (1.1.0.1) of the same installed package.
const NEWER_VERSION_ID = '04t100000000001AAA';
// A package that isn't installed in the org at all.
const NOT_INSTALLED_VERSION_ID = '04t100000000003AAA';

const PACKAGE2_ID = '0Ho000000000000AAA';
const DEV_HUB_RESOLVED_VERSION_ID = '04t100000000005AAA';

// Every dependency's SubscriberPackageVersionId resolves to its parent SubscriberPackageId, since
// the service always resolves this (regardless of `installType`) to report the existing package.
const subscriberPackageIdByVersionId: Record<string, string> = {
  [INSTALLED_VERSION_ID]: SUBSCRIBER_PACKAGE_ID_A,
  [SAME_VERSION_ID]: SUBSCRIBER_PACKAGE_ID_A,
  [NEWER_VERSION_ID]: SUBSCRIBER_PACKAGE_ID_A,
  [NOT_INSTALLED_VERSION_ID]: SUBSCRIBER_PACKAGE_ID_B,
  [DEV_HUB_RESOLVED_VERSION_ID]: SUBSCRIBER_PACKAGE_ID_B,
};

const versionNumberByVersionId: Record<string, VersionNumber> = {
  [SAME_VERSION_ID]: new VersionNumber(1, 0, 0, 1),
  [NEWER_VERSION_ID]: new VersionNumber(1, 1, 0, 1),
};

const mockInstalledPackages: InstalledPackages[] = [
  {
    Id: 'installed-1',
    SubscriberPackageId: SUBSCRIBER_PACKAGE_ID_A,
    SubscriberPackageVersionId: INSTALLED_VERSION_ID,
    MinPackageVersionId: '',
    SubscriberPackageVersion: {
      Id: INSTALLED_VERSION_ID,
      MajorVersion: 1,
      MinorVersion: 0,
      PatchVersion: 0,
      BuildNumber: 1,
    } as unknown as PackagingSObjects.SubscriberPackageVersion,
  },
];

type Dependency = { package: string; versionNumber?: string };

/** Builds a fake `SfProject` exposing one package directory with the given dependencies. */
function fakeProject(dependencies: Dependency[], aliases: Record<string, string> = {}): SfProject {
  const packageDirectories: NamedPackageDir[] = [
    {
      path: 'force-app',
      name: 'force-app',
      fullPath: '/test/force-app',
      default: true,
      dependencies,
    },
  ];
  return {
    getPackageDirectories: () => packageDirectories,
    getPackageIdFromAlias: (alias: string) => aliases[alias],
  } as unknown as SfProject;
}

/** Builds a fake target-org `Connection` — only what the service itself reads off it. */
function fakeConnection(apiVersion = '62.0'): Connection {
  return { getApiVersion: () => apiVersion, getUsername: () => 'user@example.com' } as unknown as Connection;
}

/** A progress sink that records every callback invocation, for asserting what was reported. */
function recordingProgress(): InstallPackageDependenciesProgress & { calls: Array<[string, string | undefined]> } {
  const calls: Array<[string, string | undefined]> = [];
  return {
    calls,
    info: (message) => calls.push(['info', message]),
    warn: (message) => calls.push(['warn', message]),
    stepStart: (message) => calls.push(['stepStart', message]),
    stepStatus: (message) => calls.push(['stepStatus', message]),
    stepStop: (message) => calls.push(['stepStop', message]),
  };
}

describe('installPackageDependencies', () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sandbox.stub(SubscriberPackageVersion, 'installedList').resolves(mockInstalledPackages);
    sandbox.stub(SubscriberPackageVersion.prototype, 'getSubscriberPackageId').callsFake(async function (this: {
      id: string;
    }) {
      return subscriberPackageIdByVersionId[this.id] ?? '0330000000009ZZZ';
    });
    sandbox.stub(SubscriberPackageVersion.prototype, 'getVersionNumber').callsFake(async function (this: {
      id: string;
    }) {
      return versionNumberByVersionId[this.id];
    });
    sandbox.stub(SubscriberPackageVersion.prototype, 'getId').callsFake(async function (this: { id: string }) {
      return this.id;
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  /** Stubs `install()` to succeed every time. */
  function stubInstallSuccess(): sinon.SinonStub {
    return sandbox
      .stub(SubscriberPackageVersion.prototype, 'install')
      .resolves({ Id: 'install-request-1', Status: 'SUCCESS' } as never);
  }

  /** Stubs `install()` with a test-controlled outcome per call. */
  function stubInstallWith(installFake: () => Promise<unknown>): sinon.SinonStub {
    return sandbox.stub(SubscriberPackageVersion.prototype, 'install').callsFake(installFake as never);
  }

  function run(
    dependencies: Dependency[],
    overrides: Partial<InstallPackageDependenciesOptions> = {},
  ): ReturnType<typeof installPackageDependencies> {
    return installPackageDependencies({
      project: fakeProject(dependencies),
      targetOrgConnection: fakeConnection(),
      ...overrides,
    });
  }

  it('installs newer versions and skips packages that are not newer with installType Upgrade', async () => {
    stubInstallSuccess();

    const results = await run(
      [INSTALLED_VERSION_ID, SAME_VERSION_ID, NEWER_VERSION_ID, NOT_INSTALLED_VERSION_ID].map((id) => ({
        package: id,
      })),
      { installType: 'Upgrade' },
    );

    const resultFor = (id: string) => results.find((result) => result.SubscriberPackageVersionId === id);

    expect(resultFor(INSTALLED_VERSION_ID)?.Status).toBe('Skipped');
    expect(resultFor(INSTALLED_VERSION_ID)?.ExistingSubscriberPackageVersionId).toBe(INSTALLED_VERSION_ID);

    expect(resultFor(SAME_VERSION_ID)?.Status).toBe('Skipped');
    expect(resultFor(SAME_VERSION_ID)?.ExistingSubscriberPackageVersionId).toBe(INSTALLED_VERSION_ID);

    expect(resultFor(NEWER_VERSION_ID)?.Status).toBe('Installed');
    expect(resultFor(NEWER_VERSION_ID)?.ExistingSubscriberPackageVersionId).toBe(INSTALLED_VERSION_ID);

    expect(resultFor(NOT_INSTALLED_VERSION_ID)?.Status).toBe('Installed');
    expect(resultFor(NOT_INSTALLED_VERSION_ID)?.ExistingSubscriberPackageVersionId).toBe('');
  });

  it('defaults installType to Upgrade', async () => {
    stubInstallSuccess();

    const results = await run([{ package: SAME_VERSION_ID }, { package: NEWER_VERSION_ID }]);

    expect(results.map((result) => result.Status)).toStrictEqual(['Skipped', 'Installed']);
  });

  it('does not skip an installable version that merely has the same version number with installType Delta', async () => {
    stubInstallSuccess();

    const results = await run([{ package: SAME_VERSION_ID }], { installType: 'Delta' });

    expect(results).toHaveLength(1);
    expect(results[0].Status).toBe('Installed');
    expect(results[0].ExistingSubscriberPackageVersionId).toBe(INSTALLED_VERSION_ID);
  });

  it('does not skip anything, but still reports the existing package, with installType All', async () => {
    stubInstallSuccess();

    const results = await run([{ package: INSTALLED_VERSION_ID }], { installType: 'All' });

    expect(results).toHaveLength(1);
    expect(results[0].Status).toBe('Installed');
    expect(results[0].ExistingSubscriberPackageVersionId).toBe(INSTALLED_VERSION_ID);
  });

  it('resolves dependency aliases through the project and de-duplicates by SubscriberPackageVersionId', async () => {
    const install = stubInstallSuccess();

    const results = await installPackageDependencies({
      project: fakeProject([{ package: 'MyDep' }, { package: NOT_INSTALLED_VERSION_ID }], {
        MyDep: NOT_INSTALLED_VERSION_ID,
      }),
      targetOrgConnection: fakeConnection(),
      installType: 'All',
    });

    expect(results).toStrictEqual([
      {
        PackageName: 'MyDep',
        ExistingSubscriberPackageVersionId: '',
        SubscriberPackageVersionId: NOT_INSTALLED_VERSION_ID,
        Status: 'Installed',
      },
    ]);
    expect(install.callCount).toBe(1);
  });

  it('returns an empty result, without touching the org, when the project declares no dependencies', async () => {
    const install = stubInstallSuccess();
    const progress = recordingProgress();

    const results = await run([], { progress });

    expect(results).toStrictEqual([]);
    expect(install.called).toBe(false);
    expect(progress.calls).toContainEqual(['info', 'No packages were found to install']);
  });

  it('rejects a dependency that does not resolve to a SubscriberPackageVersionId', async () => {
    await expect(run([{ package: 'NotAnAlias' }])).rejects.toMatchObject({
      name: 'InvalidSubscriberPackageVersionIdError',
      message: 'Unable to determine a valid SubscriberPackageVersionId for NotAnAlias.',
    });
  });

  it('rejects a target org below API version 36.0', async () => {
    await expect(
      installPackageDependencies({
        project: fakeProject([{ package: NOT_INSTALLED_VERSION_ID }]),
        targetOrgConnection: fakeConnection('35.0'),
      }),
    ).rejects.toMatchObject({ name: 'ApiVersionTooLowError' });
  });

  describe('package + versionNumber dependencies', () => {
    it('requires a Dev Hub connection', async () => {
      await expect(run([{ package: PACKAGE2_ID, versionNumber: '1.0.0.LATEST' }])).rejects.toMatchObject({
        name: 'TargetDevHubMissingError',
      });
    });

    it('rejects a package that does not resolve to a Package2Id', async () => {
      await expect(
        run([{ package: 'NotAPackage', versionNumber: '1.0.0.LATEST' }], {
          targetDevHubConnection: fakeConnection(),
        }),
      ).rejects.toMatchObject({
        name: 'InvalidPackage2IdError',
        message: 'Unable to determine a valid Package2Id for NotAPackage.',
      });
    });

    it('resolves the version through the Dev Hub, invoking a connection factory only when needed', async () => {
      const devHubConnection = fakeConnection();
      const resolveId = sandbox.stub(SubscriberPackageVersion, 'resolveId').resolves(DEV_HUB_RESOLVED_VERSION_ID);
      const factory = sinon.stub().resolves(devHubConnection);
      stubInstallSuccess();

      const results = await installPackageDependencies({
        project: fakeProject([{ package: 'MyPkg', versionNumber: '1.0.0.LATEST' }], { MyPkg: PACKAGE2_ID }),
        targetOrgConnection: fakeConnection(),
        targetDevHubConnection: factory,
        branch: 'feature',
        installType: 'All',
      });

      expect(factory.callCount).toBe(1);
      expect(
        resolveId.calledOnceWith(devHubConnection, sinon.match({ packageId: PACKAGE2_ID, branch: 'feature' })),
      ).toBe(true);
      expect(results).toStrictEqual([
        {
          PackageName: 'MyPkg',
          ExistingSubscriberPackageVersionId: '',
          SubscriberPackageVersionId: DEV_HUB_RESOLVED_VERSION_ID,
          Status: 'Installed',
        },
      ]);
    });

    it('does not invoke the Dev Hub connection factory when no dependency needs it', async () => {
      const factory = sinon.stub().resolves(fakeConnection());
      stubInstallSuccess();

      await run([{ package: NOT_INSTALLED_VERSION_ID }], { targetDevHubConnection: factory });

      expect(factory.called).toBe(false);
    });
  });

  describe('install request', () => {
    it('maps the security/upgrade/apex-compile options onto the request and passes the installation key', async () => {
      const install = stubInstallSuccess();

      await installPackageDependencies({
        project: fakeProject([{ package: 'MyDep' }], { MyDep: NOT_INSTALLED_VERSION_ID }),
        targetOrgConnection: fakeConnection(),
        installType: 'All',
        installationKeys: { MyDep: 'secret' },
        apexCompile: 'package',
        securityType: 'AllUsers',
        upgradeType: 'DeprecateOnly',
        skipHandlers: ['FeatureEnforcement'],
        wait: Duration.minutes(5),
      });

      const [request, installOptions] = install.firstCall.args as [Record<string, unknown>, Record<string, unknown>];
      expect(request).toMatchObject({
        ApexCompileType: 'package',
        EnableRss: true,
        Password: 'secret',
        SecurityType: 'full',
        SkipHandlers: 'FeatureEnforcement',
        SubscriberPackageVersionKey: NOT_INSTALLED_VERSION_ID,
        UpgradeType: 'deprecate-only',
      });
      expect((installOptions.pollingTimeout as Duration).minutes).toBe(5);
      expect((install.firstCall.thisValue as { password: string }).password).toBe('secret');
    });

    it('rejects an installation key that does not resolve to a SubscriberPackageVersionId', async () => {
      await expect(
        run([{ package: NOT_INSTALLED_VERSION_ID }], { installationKeys: { Unknown: 'secret' } }),
      ).rejects.toMatchObject({ name: 'InvalidSubscriberPackageVersionIdError' });
    });

    it('uses the defaults AdminsOnly / Mixed when not specified', async () => {
      const install = stubInstallSuccess();

      await run([{ package: NOT_INSTALLED_VERSION_ID }], { installType: 'All' });

      expect(install.firstCall.args[0]).toMatchObject({ SecurityType: 'none', UpgradeType: 'mixed-mode' });
    });
  });

  describe('prompts', () => {
    it('auto-approves everything, without querying the package, when prompts are omitted', async () => {
      const getExternalSites = sandbox.stub(SubscriberPackageVersion.prototype, 'getExternalSites');
      const getPackageType = sandbox.stub(SubscriberPackageVersion.prototype, 'getPackageType');
      stubInstallSuccess();

      await run([{ package: NOT_INSTALLED_VERSION_ID }], { installType: 'All', upgradeType: 'Delete' });

      expect(getExternalSites.called).toBe(false);
      expect(getPackageType.called).toBe(false);
    });

    it('sets EnableRss from confirmEnableRss when the package declares external sites', async () => {
      sandbox.stub(SubscriberPackageVersion.prototype, 'getExternalSites').resolves(['https://example.com']);
      const install = stubInstallSuccess();
      const confirmEnableRss = sinon.stub().resolves(false);

      await run([{ package: NOT_INSTALLED_VERSION_ID }], {
        installType: 'All',
        prompts: { confirmEnableRss, confirmUpgradeTypeDelete: sinon.stub().resolves(true) },
      });

      expect(confirmEnableRss.calledOnceWith(NOT_INSTALLED_VERSION_ID, ['https://example.com'])).toBe(true);
      expect(install.firstCall.args[0]).toMatchObject({ EnableRss: false });
    });

    it('cancels a Delete upgrade of an unlocked package when confirmUpgradeTypeDelete declines', async () => {
      sandbox.stub(SubscriberPackageVersion.prototype, 'getPackageType').resolves('Unlocked');
      const install = stubInstallSuccess();

      await expect(
        run([{ package: NOT_INSTALLED_VERSION_ID }], {
          installType: 'All',
          upgradeType: 'Delete',
          prompts: {
            confirmEnableRss: sinon.stub().resolves(true),
            confirmUpgradeTypeDelete: sinon.stub().resolves(false),
          },
        }),
      ).rejects.toMatchObject({ name: 'PackageInstallCanceledError' });

      expect(install.called).toBe(false);
    });
  });

  describe('retries', () => {
    it('retries a failed install up to retryAttempts times before succeeding', async () => {
      let installCalls = 0;
      stubInstallWith(async () => {
        installCalls += 1;
        if (installCalls < 3) {
          throw new Error('transient install failure');
        }
        return { Id: 'install-request-1', Status: 'SUCCESS' };
      });
      const progress = recordingProgress();

      const results = await run([{ package: NOT_INSTALLED_VERSION_ID }], {
        installType: 'All',
        retryAttempts: 2,
        retryBackoff: 1,
        progress,
      });

      expect(installCalls).toBe(3);
      expect(results[0].Status).toBe('Installed');
      expect(progress.calls.filter(([kind]) => kind === 'warn')).toStrictEqual([
        ['warn', `Package ${NOT_INSTALLED_VERSION_ID} failed to install (retry 1 of 2); retrying in 1 seconds...`],
        ['warn', `Package ${NOT_INSTALLED_VERSION_ID} failed to install (retry 2 of 2); retrying in 1 seconds...`],
      ]);
    });

    it('throws after exhausting retryAttempts on a persistently failing install', async () => {
      let installCalls = 0;
      stubInstallWith(async () => {
        installCalls += 1;
        throw new Error('permanent install failure');
      });

      await expect(
        run([{ package: NOT_INSTALLED_VERSION_ID }], { installType: 'All', retryAttempts: 2, retryBackoff: 1 }),
      ).rejects.toThrow('permanent install failure');

      expect(installCalls).toBe(3);
    });

    it('applies a packageRetryAttempts override instead of retryAttempts for that package', async () => {
      let installCalls = 0;
      stubInstallWith(async () => {
        installCalls += 1;
        if (installCalls < 2) {
          throw new Error('transient install failure');
        }
        return { Id: 'install-request-1', Status: 'SUCCESS' };
      });

      // retryAttempts defaults to 0, so without the override this would fail on the first attempt.
      const results = await installPackageDependencies({
        project: fakeProject([{ package: 'MyDep' }], { MyDep: NOT_INSTALLED_VERSION_ID }),
        targetOrgConnection: fakeConnection(),
        installType: 'All',
        retryBackoff: 1,
        packageRetryAttempts: { MyDep: 1 },
      });

      expect(installCalls).toBe(2);
      expect(results[0].Status).toBe('Installed');
    });

    it('does not retry when the install is still in progress after the polling timeout', async () => {
      let installCalls = 0;
      stubInstallWith(async () => {
        installCalls += 1;
        return { Id: 'install-request-1', Status: 'IN_PROGRESS' };
      });

      const options = { installType: 'All' as const, retryAttempts: 3, retryBackoff: 1 };
      const dependencies = [{ package: NOT_INSTALLED_VERSION_ID }];

      await expect(run(dependencies, options)).rejects.toMatchObject({
        name: 'PackageInstallInProgressError',
        message: expect.stringContaining('sf package install report -i install-request-1 -o user@example.com'),
      });
      expect(installCalls).toBe(1);
    });

    it('marks a failed request Failed and surfaces its errors', async () => {
      const failed = { Id: 'install-request-1', Status: 'ERROR', Errors: { errors: [{ message: 'Boom' }] } };
      stubInstallWith(async () => {
        const error = new SfError('polling timed out', 'PackageInstallTimeout');
        error.setData(failed);
        throw error;
      });
      const progress = recordingProgress();

      await expect(
        run([{ package: NOT_INSTALLED_VERSION_ID }], { installType: 'All', progress }),
      ).rejects.toMatchObject({
        name: 'PackageInstallError',
        message: 'Encountered errors installing the package! Installation errors: \n1) Boom',
      });
      expect(progress.calls).toContainEqual(['stepStop', 'Polling timeout exceeded']);
    });
  });

  describe('Lifecycle events', () => {
    it('forwards packaging warnings and status to progress while installing, then removes its listeners', async () => {
      const lifecycle = Lifecycle.getInstance();
      const progress = recordingProgress();
      stubInstallWith(async () => {
        await lifecycle.emit(PackageEvents.install.warning, 'careful');
        await lifecycle.emit(PackageEvents.install.status, { Status: 'IN_PROGRESS' });
        return { Id: 'install-request-1', Status: 'SUCCESS' };
      });

      await run([{ package: NOT_INSTALLED_VERSION_ID }], { installType: 'All', wait: Duration.minutes(10), progress });

      expect(progress.calls).toContainEqual(['warn', 'careful']);
      expect(progress.calls).toContainEqual([
        'stepStatus',
        '10 minutes remaining until timeout. Install status: IN_PROGRESS',
      ]);
      expect(lifecycle.getListeners(PackageEvents.install.warning)).toHaveLength(0);
      expect(lifecycle.getListeners(PackageEvents.install.status)).toHaveLength(0);
      expect(lifecycle.getListeners(PackageEvents.install['subscriber-status'])).toHaveLength(0);
    });
  });
});

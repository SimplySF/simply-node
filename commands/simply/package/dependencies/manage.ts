/*
 * Copyright (c) 2026, Clay Chipps; Copyright (c) 2026 Salesforce, Inc.
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

/* eslint-disable no-await-in-loop */
import { select } from '@inquirer/prompts';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { DependencyChange, PackageDependenciesManageResult } from '../../../../schemas/manage/dependencyChange.js';
import { ParsedDependency } from '../../../../schemas/manage/parsedDependency.js';
import {
  buildVersionService,
  VersionChoice,
  VersionServiceFilterIds,
} from '../../../../common/packageVersionService.js';
import { buildProjectService } from '../../../../common/sfdxProjectService.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@simplysf/simply-package', 'simply.package.dependencies.manage');

export type { PackageDependenciesManageResult };

export default class PackageDependenciesManage extends SfCommand<PackageDependenciesManageResult[]> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');
  public static readonly requiresProject = true;

  public static readonly flags = {
    ...SfCommand.baseFlags,
    branch: Flags.string({
      summary: messages.getMessage('flags.branch.summary'),
      description: messages.getMessage('flags.branch.description'),
      char: 'b',
    }),
    'update-to-released': Flags.boolean({
      summary: messages.getMessage('flags.update-to-released.summary'),
      description: messages.getMessage('flags.update-to-released.description'),
      default: false,
      exclusive: ['update-to-latest'],
    }),
    'update-to-latest': Flags.boolean({
      summary: messages.getMessage('flags.update-to-latest.summary'),
      description: messages.getMessage('flags.update-to-latest.description'),
      default: false,
      exclusive: ['update-to-released'],
    }),
    'api-version': Flags.orgApiVersion(),
    'target-dev-hub': Flags.requiredHub(),
  };

  // eslint-disable-next-line complexity
  public async run(): Promise<PackageDependenciesManageResult[]> {
    const { flags } = await this.parse(PackageDependenciesManage);

    const isInteractive = !flags['update-to-released'] && !flags['update-to-latest'];
    const connection = flags['target-dev-hub'].getConnection(flags['api-version']);

    this.spinner.start(messages.getMessage('info.analyzingDependencies'));
    const projectService = await buildProjectService(this.project!);
    const dependenciesByDirectory = projectService.getDependenciesByDirectory();
    const dependenciesToIgnore = projectService.getDependenciesToIgnore();
    const branchesWithReleased = projectService.getBranchesWithReleasedVersions();
    this.spinner.stop();

    const allDependencies = [...dependenciesByDirectory.values()].flat();
    const filterIds: VersionServiceFilterIds = {
      package2Ids: allDependencies.flatMap((d) => (d.package2Id ? [d.package2Id] : [])),
      subscriberVersionIds: allDependencies.flatMap((d) =>
        d.subscriberPackageVersionId ? [d.subscriberPackageVersionId] : []
      ),
    };

    this.spinner.start(messages.getMessage('info.loadingDevHubData'));
    const versionService = await buildVersionService(connection, this.project!, filterIds);
    this.spinner.stop();

    const changesByDirectory = new Map<string, DependencyChange[]>();
    const results: PackageDependenciesManageResult[] = [];

    for (const [dirPath, dependencies] of dependenciesByDirectory) {
      changesByDirectory.set(dirPath, []);
      const dirResults: PackageDependenciesManageResult = { packageDirectory: dirPath, changes: [] };

      for (const rawDependency of dependencies) {
        const dependency = versionService.enrichDependency(rawDependency);
        const package2Id = dependency.package2Id;

        const dependencyDisplayName = buildDisplayName(dependency, projectService.findAlias.bind(projectService));

        this.info('');

        if (
          !package2Id ||
          (!versionService.knowsAboutPackage(package2Id) &&
            !versionService.knowsAboutVersion(dependency.subscriberPackageVersionId ?? ''))
        ) {
          this.info(messages.getMessage('info.dependencyNotManagedByDevHub', [dependencyDisplayName]));
          const oldAlias =
            projectService.findAlias(dependency.subscriberPackageVersionId ?? dependency.package2Id ?? '') ??
            dependencyDisplayName;
          changesByDirectory.get(dirPath)!.push({
            oldAlias,
            oldDependency: dependency,
            newAlias: oldAlias,
            newSubscriberPackageVersionId: dependency.subscriberPackageVersionId,
            newPackage2Id: dependency.package2Id,
            newVersionNumber: dependency.versionNumber,
            isSameAsOld: true,
          });
          dirResults.changes.push({ oldAlias, newAlias: oldAlias, changed: false });
          continue;
        }

        this.info(messages.getMessage('info.reviewingDependency', [dependencyDisplayName]));

        const oldAlias =
          versionService.getVersionAlias(dependency.subscriberPackageVersionId ?? '') ??
          projectService.findAlias(dependency.subscriberPackageVersionId ?? dependency.package2Id ?? '') ??
          dependencyDisplayName;

        const isIgnored =
          dependenciesToIgnore.includes(package2Id) ||
          dependenciesToIgnore.includes(versionService.getPackageAlias(package2Id) ?? '');

        let choices: VersionChoice[] = [];

        if (isIgnored) {
          choices =
            dependency.subscriberPackageVersionId &&
            versionService.knowsAboutVersion(dependency.subscriberPackageVersionId)
              ? [{ name: 'Current version specified', value: dependency.subscriberPackageVersionId, short: oldAlias }]
              : [];
        } else if (isInteractive) {
          choices = versionService.buildInteractiveChoices(dependency, flags.branch ?? '', branchesWithReleased);
        } else if (flags['update-to-released']) {
          choices = versionService.buildReleasedChoices(dependency, branchesWithReleased);
        } else {
          choices = versionService.buildLatestChoices(dependency);
        }

        this.info('');

        if (choices.length === 0) {
          this.info(messages.getMessage('info.noAlternatesFound', [dependencyDisplayName]));
          dirResults.changes.push({ oldAlias, newAlias: oldAlias, changed: false });
          continue;
        }

        let selectedValue: string;

        if (isInteractive && !isIgnored) {
          const packageDisplayName = versionService.getPackageAlias(package2Id) ?? package2Id;
          selectedValue = await this.promptForVersion(
            messages.getMessage('prompt.selectVersion', [packageDisplayName]),
            choices
          );
        } else {
          selectedValue = choices[0].value;
        }

        const change = buildChange(
          oldAlias,
          dependency,
          selectedValue,
          versionService.getVersionAlias.bind(versionService),
          versionService.getPackage2IdForVersion.bind(versionService)
        );
        changesByDirectory.get(dirPath)!.push(change);

        if (isIgnored) {
          this.info(messages.getMessage('info.versionIgnored', [dependencyDisplayName]));
        } else {
          this.info(messages.getMessage('info.versionSelected', [dependencyDisplayName, change.newAlias]));
        }

        dirResults.changes.push({ oldAlias, newAlias: change.newAlias, changed: !change.isSameAsOld });
        this.info('');
        this.info('*'.repeat(88));
        this.info('');
      }

      results.push(dirResults);
    }

    await projectService.applyChanges(changesByDirectory);
    return results;
  }

  // eslint-disable-next-line class-methods-use-this
  protected async promptForVersion(message: string, choices: VersionChoice[]): Promise<string> {
    return select({ message, choices, pageSize: 8 });
  }
}

function buildDisplayName(dependency: ParsedDependency, findAlias: (id: string) => string | undefined): string {
  if (dependency.subscriberPackageVersionId) {
    const alias = findAlias(dependency.subscriberPackageVersionId);
    return alias ? `${alias} (${dependency.subscriberPackageVersionId})` : dependency.subscriberPackageVersionId;
  }
  if (dependency.package2Id && dependency.versionNumber) {
    const alias = findAlias(dependency.package2Id);
    const base = alias ? `${alias} (${dependency.package2Id})` : dependency.package2Id;
    return `${base} version ${dependency.versionNumber}`;
  }
  return '<unknown dependency>';
}

function buildChange(
  oldAlias: string,
  oldDependency: ParsedDependency,
  selectedValue: string,
  getVersionAlias: (id: string) => string | undefined,
  getPackage2Id: (id: string) => string | undefined
): DependencyChange {
  // Pinned selection: value is a SubscriberPackageVersionId (04t)
  if (selectedValue.startsWith('04t')) {
    const newAlias = getVersionAlias(selectedValue) ?? selectedValue;
    const newPackage2Id = getPackage2Id(selectedValue);
    return {
      oldAlias,
      oldDependency,
      newAlias,
      newSubscriberPackageVersionId: selectedValue,
      newPackage2Id,
      isSameAsOld: selectedValue === oldDependency.subscriberPackageVersionId,
    };
  }

  // Non-pinned selection: value is "package2Id|major.minor.patch.LATEST"
  const [package2Id, versionNumber] = selectedValue.split('|');
  const newAlias = (getVersionAlias(package2Id) ?? package2Id) + '@' + versionNumber;
  return {
    oldAlias,
    oldDependency,
    newAlias,
    newPackage2Id: package2Id,
    newVersionNumber: versionNumber,
    isSameAsOld: package2Id === oldDependency.package2Id && versionNumber === oldDependency.versionNumber,
  };
}

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

import { Connection } from '@salesforce/core';
import { SfProject } from '@salesforce/core';
import { Package, Package2Fields, PackageVersionListResult, PackagingSObjects } from '@salesforce/packaging';
import { ParsedDependency } from '../schemas/manage/parsedDependency.js';

export type VersionChoice = {
  name: string;
  value: string;
  short: string;
};

// Map structure: Package2Id → Branch → Major → Minor → Patch → Build → PackageVersionListResult
type VersionMap = Map<
  string,
  Map<string, Map<number, Map<number, Map<number, Map<number, PackageVersionListResult>>>>>
>;

export type PackageVersionService = {
  knowsAboutVersion(subscriberPackageVersionId: string): boolean;
  knowsAboutPackage(package2Id: string): boolean;
  getPackage2IdForVersion(subscriberPackageVersionId: string): string | undefined;
  getVersionAlias(subscriberPackageVersionId: string): string | undefined;
  getPackageAlias(package2Id: string): string | undefined;
  enrichDependency(dependency: ParsedDependency): ParsedDependency;
  buildInteractiveChoices(
    dependency: ParsedDependency,
    branch: string,
    branchesWithReleased: string[]
  ): VersionChoice[];
  buildReleasedChoices(dependency: ParsedDependency, branchesWithReleased: string[]): VersionChoice[];
  buildLatestChoices(dependency: ParsedDependency): VersionChoice[];
  findVersionById(subscriberPackageVersionId: string): PackageVersionListResult | undefined;
};

export type VersionServiceFilterIds = {
  package2Ids: string[];
  subscriberVersionIds: string[];
};

export async function buildVersionService(
  connection: Connection,
  project: SfProject,
  filterIds?: VersionServiceFilterIds
): Promise<PackageVersionService> {
  let packages: PackagingSObjects.Package2[];
  let versions: PackageVersionListResult[];

  if (filterIds) {
    const package2IdSet = new Set<string>(filterIds.package2Ids);
    if (filterIds.subscriberVersionIds.length > 0) {
      const inClause = filterIds.subscriberVersionIds.map((id) => `'${id}'`).join(', ');
      const result = await connection.autoFetchQuery(
        `SELECT Package2Id FROM Package2Version WHERE SubscriberPackageVersionId IN (${inClause})`,
        { tooling: true }
      );
      for (const rec of result.records as unknown as Array<{ Package2Id: string }>) {
        package2IdSet.add(rec.Package2Id);
      }
    }

    const targetPackage2Ids = [...package2IdSet];

    if (targetPackage2Ids.length === 0) {
      packages = [];
      versions = [];
    } else {
      const apiVersion = connection.getApiVersion();
      const fields = Package2Fields.filter((f) => apiVersion >= '59.0' || f !== 'AppAnalyticsEnabled').filter(
        (f) => apiVersion >= '66.0' || f !== 'RecommendedVersionId'
      );
      const inClause = targetPackage2Ids.map((id) => `'${id}'`).join(', ');
      const pkg2Result = await connection.autoFetchQuery(
        `SELECT ${fields.join(', ')} FROM Package2 WHERE Id IN (${inClause}) ORDER BY NamespacePrefix, Name`,
        { tooling: true }
      );
      packages = (pkg2Result?.records ?? []) as unknown as PackagingSObjects.Package2[];
      versions = await Package.listVersions(connection, project, {
        concise: false,
        createdLastDays: undefined as unknown as number,
        modifiedLastDays: undefined as unknown as number,
        orderBy: 'Package2Id, Branch, MajorVersion, MinorVersion, PatchVersion, BuildNumber',
        isReleased: undefined,
        verbose: true,
        packages: targetPackage2Ids,
      });
    }
  } else {
    packages = await Package.list(connection);
    versions = await Package.listVersions(connection, project, {
      concise: false,
      createdLastDays: undefined as unknown as number,
      modifiedLastDays: undefined as unknown as number,
      orderBy: 'Package2Id, Branch, MajorVersion, MinorVersion, PatchVersion, BuildNumber',
      isReleased: undefined,
      verbose: true,
    });
  }

  const versionsBySubscriberId = new Map<string, PackageVersionListResult>();
  const packageAliasById = new Map<string, string>();
  const versionsByPackageAndBranch: VersionMap = new Map();
  const releasedVersionsByPackageAndBranch: VersionMap = new Map();

  for (const pkg of packages) {
    packageAliasById.set(pkg.Id, computePackageAlias(pkg));
  }

  for (const version of versions) {
    versionsBySubscriberId.set(version.SubscriberPackageVersionId, version);
    sortVersionIntoMap(versionsByPackageAndBranch, version);
    if (version.IsReleased) {
      sortVersionIntoMap(releasedVersionsByPackageAndBranch, version);
    }
  }

  function computePackageAlias(pkg: PackagingSObjects.Package2): string {
    return (pkg.NamespacePrefix ? pkg.NamespacePrefix + '.' : '') + pkg.Name;
  }

  function computeVersionAlias(v: PackageVersionListResult, branch?: string): string {
    const seg = `${v.MajorVersion}.${v.MinorVersion}.${v.PatchVersion}-${v.BuildNumber}` + (branch ? '-' + branch : '');
    const pkgAlias = packageAliasById.get(v.Package2Id) ?? v.Package2Id;
    return pkgAlias + '@' + seg;
  }

  function sortVersionIntoMap(map: VersionMap, v: PackageVersionListResult): void {
    const branch = v.Branch ?? '';
    const major = parseInt(v.MajorVersion, 10);
    const minor = parseInt(v.MinorVersion, 10);
    const patch = parseInt(v.PatchVersion, 10);
    const build = parseInt(v.BuildNumber, 10);

    if (!map.has(v.Package2Id)) map.set(v.Package2Id, new Map());
    const byBranch = map.get(v.Package2Id)!;

    if (!byBranch.has(branch)) byBranch.set(branch, new Map());
    const byMajor = byBranch.get(branch)!;

    if (!byMajor.has(major)) byMajor.set(major, new Map());
    const byMinor = byMajor.get(major)!;

    if (!byMinor.has(minor)) byMinor.set(minor, new Map());
    const byPatch = byMinor.get(minor)!;

    if (!byPatch.has(patch)) byPatch.set(patch, new Map());
    const byBuild = byPatch.get(patch)!;

    if (!byBuild.has(build)) byBuild.set(build, v);
  }

  // Walks a version map block to the latest (highest-key) entry at any depth
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findLatestFromBlock(block: Map<number, any>): PackageVersionListResult {
    const keys = [...block.keys()];
    const maxKey = keys.reduce((max, k) => (k > max ? k : max), keys[0]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const entry = block.get(maxKey);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return entry instanceof Map ? findLatestFromBlock(entry) : (entry as PackageVersionListResult);
  }

  enum ChunkLevel {
    Major = 1,
    Minor,
    Patch,
  }

  function findBlock(
    map: VersionMap,
    package2Id: string,
    branch: string,
    dependency: ParsedDependency,
    level: ChunkLevel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Map<number, any> | undefined {
    const resolvedBranch = branch ?? '';
    const byBranch = map.get(package2Id);
    if (!byBranch?.has(resolvedBranch)) return undefined;

    const byMajor = byBranch.get(resolvedBranch);
    if (level === ChunkLevel.Major) return byMajor;

    const byMinor = byMajor?.get(dependency.majorVersion!);
    if (level === ChunkLevel.Minor || byMinor === undefined) return byMinor;

    return byMinor.get(dependency.minorVersion!);
  }

  function makeVersionChoice(v: PackageVersionListResult, label: string, branch?: string): VersionChoice {
    const seg = `${v.MajorVersion}.${v.MinorVersion}.${v.PatchVersion}-${v.BuildNumber}` + (branch ? '-' + branch : '');
    return {
      name: `${label}: ${seg}`,
      value: v.SubscriberPackageVersionId,
      short: seg,
    };
  }

  function makeLatestChoice(v: PackageVersionListResult, label: string): VersionChoice {
    const seg = `${v.MajorVersion}.${v.MinorVersion}.${v.PatchVersion}.LATEST`;
    return {
      name: label,
      value: `${v.Package2Id}|${seg}`,
      short: seg,
    };
  }

  function findLatestReleasedForBranch(
    package2Id: string,
    branch: string,
    dependency: ParsedDependency,
    seen: Set<string>
  ): VersionChoice | undefined {
    const block = findBlock(releasedVersionsByPackageAndBranch, package2Id, branch, dependency, ChunkLevel.Major);
    if (!block) return undefined;
    const v = findLatestFromBlock(block);
    if (seen.has(v.SubscriberPackageVersionId)) return undefined;
    seen.add(v.SubscriberPackageVersionId);
    const label = branch
      ? `Latest released version on build branch - ${branch}`
      : 'Latest released version on main build branch';
    return makeVersionChoice(v, label, branch || undefined);
  }

  function findLatestForBranch(
    package2Id: string,
    branch: string,
    dependency: ParsedDependency,
    level: ChunkLevel,
    label: string,
    seen: Set<string>
  ): VersionChoice | undefined {
    const block = findBlock(versionsByPackageAndBranch, package2Id, branch, dependency, level);
    if (!block) return undefined;
    const v = findLatestFromBlock(block);
    if (seen.has(v.SubscriberPackageVersionId)) return undefined;
    seen.add(v.SubscriberPackageVersionId);
    return makeVersionChoice(v, label, branch || undefined);
  }

  return {
    knowsAboutVersion(id: string): boolean {
      return versionsBySubscriberId.has(id);
    },

    knowsAboutPackage(package2Id: string): boolean {
      return packageAliasById.has(package2Id);
    },

    getPackage2IdForVersion(subscriberPackageVersionId: string): string | undefined {
      return versionsBySubscriberId.get(subscriberPackageVersionId)?.Package2Id;
    },

    getVersionAlias(subscriberPackageVersionId: string): string | undefined {
      const v = versionsBySubscriberId.get(subscriberPackageVersionId);
      if (!v) return undefined;
      return computeVersionAlias(v, v.Branch || undefined);
    },

    getPackageAlias(package2Id: string): string | undefined {
      return packageAliasById.get(package2Id);
    },

    findVersionById(subscriberPackageVersionId: string): PackageVersionListResult | undefined {
      return versionsBySubscriberId.get(subscriberPackageVersionId);
    },

    enrichDependency(dependency: ParsedDependency): ParsedDependency {
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      if (dependency.package2Id || !dependency.subscriberPackageVersionId) return dependency;
      const v = versionsBySubscriberId.get(dependency.subscriberPackageVersionId);
      if (!v) return dependency;
      const parts = `${v.MajorVersion}.${v.MinorVersion}.${v.PatchVersion}.${v.BuildNumber}`.split('.');
      return {
        ...dependency,
        package2Id: v.Package2Id,
        versionNumber: `${v.MajorVersion}.${v.MinorVersion}.${v.PatchVersion}.${v.BuildNumber}`,
        majorVersion: parseInt(parts[0], 10),
        minorVersion: parseInt(parts[1], 10),
        patchVersion: parseInt(parts[2], 10),
        buildVersion: parseInt(parts[3], 10),
      };
    },

    // eslint-disable-next-line complexity
    buildInteractiveChoices(
      dependency: ParsedDependency,
      branch: string,
      branchesWithReleased: string[]
    ): VersionChoice[] {
      const package2Id = dependency.package2Id!;
      const maj = dependency.majorVersion ?? '';
      const min = dependency.minorVersion ?? '';
      const pat = dependency.patchVersion ?? '';
      const choices: VersionChoice[] = [];
      const releasedChoices: VersionChoice[] = [];
      const seen = new Set<string>();

      // Latest released on null/main branch and named release branches
      const releasedMain = findLatestReleasedForBranch(package2Id, '', dependency, seen);
      if (releasedMain) releasedChoices.push(releasedMain);
      for (const b of branchesWithReleased ?? []) {
        const rc = findLatestReleasedForBranch(package2Id, b, dependency, seen);
        if (rc) releasedChoices.push(rc);
      }

      // Latest version on the specified feature branch
      if (branch) {
        const c = findLatestForBranch(
          package2Id,
          branch,
          dependency,
          ChunkLevel.Patch,
          `Latest version on '${branch}' branch`,
          seen
        );
        if (c) choices.push(c);
      }

      // Latest build with same Major.Minor.Patch on main branch and release branches
      const patchMain = findLatestForBranch(
        package2Id,
        '',
        dependency,
        ChunkLevel.Patch,
        `Latest ${maj}.${min}.${pat} version on main build branch`,
        seen
      );
      if (patchMain) choices.push(patchMain);
      for (const b of branchesWithReleased ?? []) {
        const c = findLatestForBranch(
          package2Id,
          b,
          dependency,
          ChunkLevel.Patch,
          `Latest ${maj}.${min}.${pat} version on build branch - ${b}`,
          seen
        );
        if (c) choices.push(c);
      }

      // Latest build with same Major.Minor on main branch and release branches
      const minorMain = findLatestForBranch(
        package2Id,
        '',
        dependency,
        ChunkLevel.Minor,
        `Latest ${maj}.${min} version on main build branch`,
        seen
      );
      if (minorMain) choices.push(minorMain);
      for (const b of branchesWithReleased ?? []) {
        const c = findLatestForBranch(
          package2Id,
          b,
          dependency,
          ChunkLevel.Minor,
          `Latest ${maj}.${min} version on build branch - ${b}`,
          seen
        );
        if (c) choices.push(c);
      }

      // Latest build overall on main branch and release branches
      const majorMain = findLatestForBranch(
        package2Id,
        '',
        dependency,
        ChunkLevel.Major,
        'Latest version on main build branch',
        seen
      );
      if (majorMain) choices.push(majorMain);
      for (const b of branchesWithReleased ?? []) {
        const c = findLatestForBranch(
          package2Id,
          b,
          dependency,
          ChunkLevel.Major,
          `Latest version on build branch - ${b}`,
          seen
        );
        if (c) choices.push(c);
      }

      // Released choices go after so they appear clearly
      choices.push(...releasedChoices);

      // Non-pinned latest for current Major.Minor.Patch
      const block =
        findBlock(versionsByPackageAndBranch, package2Id, branch, dependency, ChunkLevel.Patch) ??
        findBlock(versionsByPackageAndBranch, package2Id, '', dependency, ChunkLevel.Patch) ??
        findBlock(versionsByPackageAndBranch, package2Id, '', dependency, ChunkLevel.Minor);
      if (block) {
        const v = findLatestFromBlock(block);
        choices.push(makeLatestChoice(v, `Non-pinned latest ${maj}.${min}.${pat} build`));
      }

      // Keep the current version as last option
      if (dependency.subscriberPackageVersionId && versionsBySubscriberId.has(dependency.subscriberPackageVersionId)) {
        const v = versionsBySubscriberId.get(dependency.subscriberPackageVersionId)!;
        choices.push(makeVersionChoice(v, 'Current version specified', v.Branch || undefined));
      }

      return choices;
    },

    buildReleasedChoices(dependency: ParsedDependency, branchesWithReleased: string[]): VersionChoice[] {
      const package2Id = dependency.package2Id!;
      const choices: VersionChoice[] = [];
      const seen = new Set<string>();

      const main = findLatestReleasedForBranch(package2Id, '', dependency, seen);
      if (main) choices.push(main);
      for (const b of branchesWithReleased ?? []) {
        const c = findLatestReleasedForBranch(package2Id, b, dependency, seen);
        if (c) choices.push(c);
      }

      return choices;
    },

    buildLatestChoices(dependency: ParsedDependency): VersionChoice[] {
      const package2Id = dependency.package2Id!;
      const block =
        findBlock(versionsByPackageAndBranch, package2Id, '', dependency, ChunkLevel.Patch) ??
        findBlock(versionsByPackageAndBranch, package2Id, '', dependency, ChunkLevel.Minor);
      if (!block) return [];
      const v = findLatestFromBlock(block);
      const maj = dependency.majorVersion ?? '';
      const min = dependency.minorVersion ?? '';
      const pat = dependency.patchVersion ?? '';
      return [makeLatestChoice(v, `Non-pinned latest ${maj}.${min}.${pat} build`)];
    },
  };
}

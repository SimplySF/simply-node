/*
 * Copyright (c) 2026, Clay Chipps.
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

import { SfdxPackageDirectory, SfdxProject } from '@simplysf/simply-core';
import { isSubscriberPackageVersionId } from './packageUtils.js';

/** Where in `sfdx-project.json` a version was declared. */
export type PackageVersionSource = 'dependency' | 'packageDirectory';

/** One place a package name is declared in `sfdx-project.json`, and the version found there. */
export type PackageVersionMatch = {
  /** The name matched on, as written in the project file. */
  package: string;
  /** The declared version, or `undefined` if the declaration carries no resolvable version. */
  version?: string;
  source: PackageVersionSource;
  /** The `path` of the package directory the declaration was found in. */
  packageDirectory: string;
  /** The `04t` the declaration resolves to, when one is knowable from `packageAliases`. */
  subscriberPackageVersionId?: string;
};

/** Narrows which package directories {@link findPackageVersions} looks at. */
export type FindPackageVersionsOptions = {
  /** Only search the package directory with this `path`. */
  directory?: string;
};

/**
 * Split a package reference into its name and version parts.
 *
 * Splits on the *last* `@`, matching how `sfdx-project.json` aliases are written and how
 * `simply-cicd`'s dependabot updater already parses them, so a name that itself contains an `@`
 * (a scoped-style `@ns/pkg`) keeps its name intact.
 *
 * @param value - A package reference, e.g. `test-package@0.1.0+2`, `test-package`, or an ID.
 * @returns The name, plus the version if the reference carried one.
 */
export function splitPackageAlias(value: string): { name: string; version?: string } {
  const lastAtIndex = value.lastIndexOf('@');

  // An `@` at index 0 is part of the name (`@ns/pkg`), not a version separator.
  if (lastAtIndex <= 0) {
    return { name: value };
  }

  return { name: value.slice(0, lastAtIndex), version: value.slice(lastAtIndex + 1) || undefined };
}

/**
 * Find every place `packageName` is declared in a project, and the version declared with it.
 *
 * A package can be declared four ways, all of which are searched:
 * 1. A dependency whose `package` is a versioned alias — `test-package@0.1.0+2`.
 * 2. A dependency whose `package` is a bare name plus a sibling `versionNumber`.
 * 3. A dependency whose `package` is a raw ID, where `packageAliases` maps a versioned alias for
 * `packageName` onto that same ID.
 * 4. A package directory that *builds* `packageName`, i.e. the project's own package version.
 *
 * Matches are returned rather than resolved to a single answer because "the same package declared
 * at two different versions in two directories" is a real project state, and only the caller knows
 * whether that's an error or a list to display.
 *
 * @param project - The parsed `sfdx-project.json` contents.
 * @param packageName - The package name or alias to look up.
 * @param options - Narrows which package directories are searched.
 * @returns Every match, in package-directory order, dependencies before the directory's own
 * package. A match with no `version` means the package is declared but its version isn't
 * knowable from the project file alone.
 */
export function findPackageVersions(
  project: SfdxProject,
  packageName: string,
  options: FindPackageVersionsOptions = {},
): PackageVersionMatch[] {
  const aliases = project.packageAliases ?? {};
  const directories = options.directory
    ? project.packageDirectories.filter((directory) => directory.path === options.directory)
    : project.packageDirectories;

  return directories.flatMap((directory) => [
    ...findDependencyMatches(directory, packageName, aliases),
    ...findOwnPackageMatch(directory, packageName),
  ]);
}

/**
 * @param directory - The package directory to search.
 * @param packageName - The package name or alias to look up.
 * @param aliases - The project's `packageAliases` map.
 * @returns Matches among `directory`'s declared dependencies.
 */
function findDependencyMatches(
  directory: SfdxPackageDirectory,
  packageName: string,
  aliases: Record<string, string>,
): PackageVersionMatch[] {
  const packageDirectory = directory.path ?? '';

  return (directory.dependencies ?? []).flatMap((dependency) => {
    if (!dependency.package) {
      return [];
    }

    const { name, version } = splitPackageAlias(dependency.package);

    if (name === packageName) {
      return [
        {
          package: dependency.package,
          version: version ?? dependency.versionNumber,
          source: 'dependency' as const,
          packageDirectory,
          subscriberPackageVersionId: subscriberVersionIdFor(dependency.package, aliases),
        },
      ];
    }

    // The dependency is written as a raw ID: recover the version from whichever versioned alias
    // for this package points at that same ID.
    const aliasForId = Object.keys(aliases).find(
      (alias) => aliases[alias] === dependency.package && splitPackageAlias(alias).name === packageName,
    );

    if (!aliasForId) {
      return [];
    }

    return [
      {
        package: aliasForId,
        version: splitPackageAlias(aliasForId).version ?? dependency.versionNumber,
        source: 'dependency' as const,
        packageDirectory,
        subscriberPackageVersionId: isSubscriberPackageVersionId(dependency.package) ? dependency.package : undefined,
      },
    ];
  });
}

/**
 * @param directory - The package directory to search.
 * @param packageName - The package name or alias to look up.
 * @returns A single match if this directory builds `packageName`, otherwise nothing.
 */
function findOwnPackageMatch(directory: SfdxPackageDirectory, packageName: string): PackageVersionMatch[] {
  if (!directory.package) {
    return [];
  }

  const { name, version } = splitPackageAlias(directory.package);

  if (name !== packageName) {
    return [];
  }

  return [
    {
      package: directory.package,
      version: directory.versionNumber ?? version,
      source: 'packageDirectory',
      packageDirectory: directory.path ?? '',
    },
  ];
}

/**
 * @param reference - A dependency's `package` value.
 * @param aliases - The project's `packageAliases` map.
 * @returns The `04t` `reference` denotes, either directly or through an alias, if any.
 */
function subscriberVersionIdFor(reference: string, aliases: Record<string, string>): string | undefined {
  if (isSubscriberPackageVersionId(reference)) {
    return reference;
  }

  const resolved = aliases[reference];

  return resolved && isSubscriberPackageVersionId(resolved) ? resolved : undefined;
}

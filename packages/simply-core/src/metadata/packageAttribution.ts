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

import { Connection } from '@salesforce/core';
import { chunkedInQuery } from '../query/chunkedInQuery.js';

/** The `Publisher.Name` the Tooling API reports for metadata that belongs to no package. */
export const LOCAL_PUBLISHER_NAME = '<local>';

/** How unpackaged metadata is labelled in generated reports. */
export const LOCAL_PACKAGE_LABEL = 'Local (Unpackaged)';

/** The length of the 15-character, case-sensitive form of a Salesforce ID. */
const SHORT_ID_LENGTH = 15;

/** A queried `Package2Member` record, attributing one metadata component to a 2GP package. */
type Package2MemberRecord = {
  SubjectId: string;
  SubscriberPackage?: { Name?: string };
};

/** A queried `EntityDefinition` record, carrying the publisher of an object. */
type EntityDefinitionRecord = {
  QualifiedApiName: string;
  Publisher?: { Name?: string };
};

export type ResolvePackageNamesOptions = {
  /** How many IDs/names per `IN (...)` clause. */
  chunkSize: number;
  /** Swallow query failures instead of rejecting. Defaults to `false`. */
  tolerateFailure?: boolean;
};

export type ResolvePackageNamesByApiNameOptions = ResolvePackageNamesOptions & {
  /**
   * Label to use when a record carries no publisher at all — which is what standard objects look
   * like, as distinct from the explicit `<local>` publisher that unpackaged custom metadata gets.
   * Defaults to {@link LOCAL_PACKAGE_LABEL}.
   */
  fallbackLabel?: string;
};

/**
 * Turn a raw Tooling API `Publisher.Name` into the label a report should show.
 *
 * There are two distinct "not in a package" cases and they mean different things: an explicit
 * `<local>` publisher means unpackaged metadata in this org, while a missing publisher usually
 * means a standard, Salesforce-shipped component. Callers pick their own label for the second
 * case because it's user-visible in generated reports.
 *
 * @param publisherName - The raw `Publisher.Name`, if the record had one.
 * @param fallbackLabel - Label for records carrying no publisher at all.
 * @returns The display label for the owning package.
 */
export function normalizePublisherName(publisherName: string | undefined, fallbackLabel: string): string {
  if (publisherName === LOCAL_PUBLISHER_NAME) {
    return LOCAL_PACKAGE_LABEL;
  }

  return publisherName ?? fallbackLabel;
}

/**
 * Resolve which unlocked (2GP) package each metadata component belongs to, via `Package2Member`.
 *
 * Components installed from an unlocked package aren't attributed by `NamespacePrefix` or
 * `Publisher.Name` the way managed-package components are — `Package2Member` is the only place
 * that mapping exists, and it's Tooling API only.
 *
 * @param connection - The org connection to query against.
 * @param subjectIds - Component IDs, in either 15- or 18-character form.
 * @param options - Chunk size, and whether to tolerate query failure.
 * @returns Package name by 15-character component ID. Components with no `Package2Member` row are
 * absent from the map rather than present with a placeholder, so callers keep control of the
 * "not in a package" label. Empty if `subjectIds` is empty.
 */
export async function resolvePackageNamesBySubjectId(
  connection: Connection,
  subjectIds: readonly string[],
  options: ResolvePackageNamesOptions,
): Promise<Map<string, string>> {
  const shortIds = subjectIds.map((id) => id.substring(0, SHORT_ID_LENGTH));

  const records = await chunkedInQuery<Package2MemberRecord>(
    connection,
    shortIds,
    (inClause) => `SELECT SubjectId, SubscriberPackage.Name FROM Package2Member WHERE SubjectId IN (${inClause})`,
    { chunkSize: options.chunkSize, tooling: true, tolerateFailure: options.tolerateFailure },
  );

  const packageNames = new Map<string, string>();

  for (const record of records) {
    const packageName = record.SubscriberPackage?.Name;
    if (packageName) {
      packageNames.set(record.SubjectId.substring(0, SHORT_ID_LENGTH), packageName);
    }
  }

  return packageNames;
}

/**
 * Resolve the publishing package of each named object, via `EntityDefinition.Publisher.Name`.
 *
 * This covers managed packages and standard objects; unlocked-package components need
 * {@link resolvePackageNamesBySubjectId} instead.
 *
 * @param connection - The org connection to query against.
 * @param apiNames - Object API names to resolve.
 * @param options - Chunk size, failure tolerance, and the no-publisher label.
 * @returns Package label by object API name, for every object the query returned.
 */
export async function resolvePackageNamesByApiName(
  connection: Connection,
  apiNames: readonly string[],
  options: ResolvePackageNamesByApiNameOptions,
): Promise<Map<string, string>> {
  const records = await chunkedInQuery<EntityDefinitionRecord>(
    connection,
    apiNames,
    (inClause) =>
      `SELECT DurableId, QualifiedApiName, Publisher.Name FROM EntityDefinition WHERE QualifiedApiName IN (${inClause})`,
    { chunkSize: options.chunkSize, tooling: true, tolerateFailure: options.tolerateFailure },
  );

  const packageNames = new Map<string, string>();

  for (const record of records) {
    packageNames.set(
      record.QualifiedApiName,
      normalizePublisherName(record.Publisher?.Name, options.fallbackLabel ?? LOCAL_PACKAGE_LABEL),
    );
  }

  return packageNames;
}

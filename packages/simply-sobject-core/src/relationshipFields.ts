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

import type { Connection } from '@salesforce/core';

type SObjectField = Awaited<ReturnType<Connection['describe']>>['fields'][number];

/**
 * @param field - A field from an SObject describe result.
 * @returns Whether `field` is a single-target lookup/master-detail field that can be safely
 * expanded into a dot-notation relationship path. Polymorphic references (e.g. `OwnerId`, which
 * can point at `User` or `Group`) are excluded, since a single dotted path can't reliably select
 * fields across more than one possible target type.
 */
function isExpandableReferenceField(field: SObjectField): boolean {
  return field.type === 'reference' && Boolean(field.relationshipName) && field.referenceTo?.length === 1;
}

/**
 * @param targetDescribe - The describe result of a relationship field's target SObject.
 * @returns The target object's identifying field names: whichever field is flagged as its name
 * field (e.g. `Name`), plus `DeveloperName` when present. For `RecordType`, this yields `Name`
 * and `DeveloperName`; for most other objects, just `Name`.
 */
function identifyingFieldNames(targetDescribe: Awaited<ReturnType<Connection['describe']>>): string[] {
  return targetDescribe.fields
    .filter((field) => field.nameField || field.name === 'DeveloperName')
    .map((field) => field.name);
}

/**
 * Given an SObject's describe fields, discover the identifying fields of every parent it
 * references through a single-target lookup or master-detail relationship, and return them as
 * dot-notation relationship paths ready to add to a SOQL field list (e.g. `RecordTypeId` ->
 * `RecordType.Name`, `RecordType.DeveloperName`).
 *
 * Describe calls for each distinct target object are deduplicated and fetched concurrently;
 * `Connection#describe` already memoizes per-instance, so repeat calls for the same object name
 * (including calls made elsewhere on the same connection) are cheap.
 *
 * @param connection - The org connection to describe relationship targets with.
 * @param fields - The describe fields of the SObject being backed up.
 * @returns Dot-notation relationship field paths, in no particular order.
 */
export async function discoverRelationshipFields(connection: Connection, fields: SObjectField[]): Promise<string[]> {
  const referenceFields = fields.filter(isExpandableReferenceField);

  const targetObjectNames = [...new Set(referenceFields.map((field) => field.referenceTo![0]))];

  const targetDescribes = await Promise.all(
    targetObjectNames.map(async (objectName) => [objectName, await connection.describe(objectName)] as const),
  );
  const describeByObjectName = new Map(targetDescribes);

  return referenceFields.flatMap((field) => {
    const targetDescribe = describeByObjectName.get(field.referenceTo![0]);

    if (!targetDescribe) {
      return [];
    }

    return identifyingFieldNames(targetDescribe).map((fieldName) => `${field.relationshipName!}.${fieldName}`);
  });
}

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

import type { BoolLike } from './schemaGenerateUtils.js';

/** Salesforce field types this command knows how to generate `CustomField` metadata for. */
export const IMPLEMENTED_FIELD_TYPES = new Set([
  'AutoNumber',
  'Checkbox',
  'Date',
  'DateTime',
  'Email',
  'Html',
  'LongTextArea',
  'Lookup',
  'MultiselectPicklist',
  'Number',
  'Percent',
  'Picklist',
  'Text',
  'Url',
]);

/** Field types whose `CustomField` metadata never carries a `required` tag. */
export const FIELD_TYPES_WITHOUT_REQUIRED_PROP = new Set([
  'MasterDetail',
  'AutoNumber',
  'Checkbox',
  'Html',
  'LongTextArea',
]);

/**
 * A field's normalized configuration, common to both the CSV flow (a row of a flat CSV, where
 * every value arrives as a string) and the Excel flow (a row of the `fields` worksheet, massaged
 * by {@link normalizeExcelField}).
 */
export type NormalizedFieldData = {
  ApiName?: string;
  Label?: string;
  FieldType?: string;
  Description?: string;
  InlineHelpText?: string;
  Required?: BoolLike;
  ExternalId?: BoolLike;
  TrackHistory?: BoolLike;
  TrackTrending?: BoolLike;
  Unique?: BoolLike;
  Formula?: string;
  FormulaTreatBlanksAs?: string;
  Length?: string | number;
  Precision?: string | number;
  Scale?: string | number;
  VisibleLines?: string | number;
  DisplayFormat?: string;
  StartingNumber?: string | number;
  ReferenceTo?: string;
  RelationshipLabel?: string;
  RelationshipName?: string;
  DeleteConstraint?: string;
  RestrictedPicklist?: BoolLike;
  ValueSetName?: string;
  ValueSetControllingField?: string;
  ValueSetSheet?: string;
  ValueSetDefinitionSorted?: BoolLike;
  ValueSet?: string;
};

/** A record type row from the CSV flow. */
export type RecordTypeData = {
  ApiName?: string;
  Label?: string;
  Active?: BoolLike;
  Description?: string;
  PicklistAssignments?: string;
};

/** An object's normalized configuration, common to both the CSV and Excel flows. */
export type ObjectData = {
  DeploymentStatus?: string;
  Description?: string;
  EnableActivities?: BoolLike;
  EnableBulkApi?: BoolLike;
  EnableFeeds?: BoolLike;
  EnableHistory?: BoolLike;
  EnableReports?: BoolLike;
  EnableSharing?: BoolLike;
  EnableStreamingApi?: BoolLike;
  ExternalSharingModel?: string;
  Label?: string;
  NameFieldLabel?: string;
  NameFieldType?: string;
  NameFieldDisplayFormat?: string;
  NameFieldStartingNumber?: string | number;
  PluralLabel?: string;
  SharingModel?: string;
  Visibility?: string;
};

export type PicklistValueSetValue = { fullName: string; default: boolean; label?: string };
export type PicklistValueSetDefinition = { sorted: boolean; value: PicklistValueSetValue[] };
export type PicklistValueSettingEntry = { controllingFieldValue: string[]; valueName: string };

/** The `valueSet` node structure for a `Picklist`/`MultiselectPicklist` `CustomField`. */
export type PicklistValueSet = {
  controllingField?: string;
  restricted?: boolean;
  valueSetName?: string;
  valueSetDefinition?: PicklistValueSetDefinition;
  valueSettings?: PicklistValueSettingEntry[];
};

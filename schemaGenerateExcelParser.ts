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

import type ExcelJS from 'exceljs';
import { toBoolean } from './schemaGenerateUtils.js';

/** The `object` worksheet's key/value pairs, describing the sObject to generate. */
export type ExcelObjectInfo = Record<string, string | undefined>;

/**
 * One row of the `fields` worksheet, keyed by the header row's column names. Every dynamic column
 * value is a `string` (via {@link cellToString}); the index signature also allows `number` purely
 * so the fixed `excelRow` property can coexist with it.
 */
export type ExcelFieldRow = { excelRow: number } & Record<string, string | number | undefined>;

/** One row of a picklist values worksheet. */
export type ExcelValueRow = {
  label: string;
  fullName: string;
  default: boolean;
  controllingFieldValues?: string[];
};

/**
 * Converts a raw exceljs cell value to a plain string. Cells can come back as rich text, formula
 * results, or hyperlink objects instead of a plain primitive, so this normalizes to the string the
 * rest of the pipeline expects (matching how CSV input always arrives as plain strings).
 *
 * @param raw - The raw cell value.
 * @returns The cell's string value, or `undefined` if empty.
 */
function cellToString(raw: ExcelJS.CellValue): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'object') {
    const richValue = raw as { text?: unknown; result?: unknown; richText?: Array<{ text?: unknown }> };
    if (typeof richValue.text === 'string') return richValue.text;
    if (richValue.richText) {
      return richValue.richText.map((part) => primitiveToString(part.text) ?? '').join('');
    }
    if (richValue.result !== undefined) return primitiveToString(richValue.result);
    return undefined;
  }
  return String(raw);
}

/**
 * Stringifies a value only when it's a primitive with a meaningful `String()` conversion,
 * avoiding the `[object Object]` a bare `String()` would produce for anything else.
 *
 * @param value - The value to stringify.
 * @returns The stringified value, or `undefined` if it isn't a string/number/boolean.
 */
function primitiveToString(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

/**
 * Reads the `object` worksheet -- a two-column key/value sheet describing the sObject to generate
 * -- into a plain property map.
 *
 * @param workbook - The Excel workbook.
 * @returns The object's properties, keyed by the first column's value.
 */
export function getObjectInfo(workbook: ExcelJS.Workbook): ExcelObjectInfo {
  const objectWorksheet = workbook.getWorksheet('object');
  const objectObj: ExcelObjectInfo = {};
  if (objectWorksheet) {
    objectWorksheet.eachRow((row) => {
      const values = row.values as ExcelJS.CellValue[];
      const key = cellToString(values[1]);
      if (key) objectObj[key] = cellToString(values[2]);
    });
  }
  return objectObj;
}

/**
 * Reads the `fields` worksheet into one row object per field, keyed by the header row's column
 * names.
 *
 * @param workbook - The Excel workbook.
 * @returns The parsed field rows, or `[]` if there's no `fields` worksheet.
 */
export function getFieldInfo(workbook: ExcelJS.Workbook): ExcelFieldRow[] {
  const fieldsWorksheet = workbook.getWorksheet('fields');
  if (!fieldsWorksheet) return [];

  const headerValues = fieldsWorksheet.getRow(1).values as ExcelJS.CellValue[];
  const fieldColumns = headerValues.slice(1).map((value) => cellToString(value) ?? '');

  const fieldsArray: ExcelFieldRow[] = [];
  fieldsWorksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowObj: ExcelFieldRow = { excelRow: rowNumber };
    fieldColumns.forEach((columnName, index) => {
      if (columnName) rowObj[columnName] = cellToString(row.getCell(index + 1).value);
    });
    fieldsArray.push(rowObj);
  });
  return fieldsArray;
}

/**
 * Reads a picklist values worksheet into one entry per value, resolving each value's API name
 * (falling back to its label) and any controlling-field values it's restricted to.
 *
 * @param valuesWorksheet - The worksheet listing picklist values, if the field references one.
 * @returns The parsed value rows, or `[]` if there's no worksheet.
 */
export function getValuesInfo(valuesWorksheet: ExcelJS.Worksheet | undefined): ExcelValueRow[] {
  const valuesArray: ExcelValueRow[] = [];
  if (!valuesWorksheet) return valuesArray;

  valuesWorksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const label = cellToString(row.getCell(1).value) ?? '';
    const apiNameOptional = cellToString(row.getCell(2).value);
    const fullName = apiNameOptional && apiNameOptional.trim().length > 0 ? apiNameOptional : label;
    const isDefault = cellToString(row.getCell(3).value);
    const controllingFieldValuesRaw = cellToString(row.getCell(4).value);
    const controllingFieldValues = controllingFieldValuesRaw
      ? controllingFieldValuesRaw
          .split(/\r?\n/)
          .map((v) => v.trim())
          .filter(Boolean)
      : undefined;

    valuesArray.push({
      label,
      fullName,
      default: toBoolean(isDefault) ?? false,
      controllingFieldValues,
    });
  });

  return valuesArray;
}

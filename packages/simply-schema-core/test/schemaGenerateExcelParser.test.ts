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

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { getFieldInfo, getObjectInfo, getValuesInfo } from '../src/schemaGenerateExcelParser.js';

describe('getObjectInfo', () => {
  it('reads the object worksheet into a key/value map', () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('object');
    worksheet.addRow(['Label', 'My Object']);
    worksheet.addRow(['PluralLabel', 'My Objects']);

    expect(getObjectInfo(workbook)).to.deep.equal({ Label: 'My Object', PluralLabel: 'My Objects' });
  });

  it('returns an empty object when there is no object worksheet', () => {
    const workbook = new ExcelJS.Workbook();

    expect(getObjectInfo(workbook)).to.deep.equal({});
  });
});

describe('getFieldInfo', () => {
  it('reads the fields worksheet into one row object per field, keyed by header', () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('fields');
    worksheet.addRow(['ApiName', 'Label', 'Required']);
    worksheet.addRow(['My_Field__c', 'My Field', 'true']);
    worksheet.addRow(['Other_Field__c', 'Other Field', 'false']);

    expect(getFieldInfo(workbook)).to.deep.equal([
      { excelRow: 2, ApiName: 'My_Field__c', Label: 'My Field', Required: 'true' },
      { excelRow: 3, ApiName: 'Other_Field__c', Label: 'Other Field', Required: 'false' },
    ]);
  });

  it('returns an empty array when there is no fields worksheet', () => {
    const workbook = new ExcelJS.Workbook();

    expect(getFieldInfo(workbook)).to.deep.equal([]);
  });
});

describe('getValuesInfo', () => {
  it('returns an empty array when there is no worksheet', () => {
    expect(getValuesInfo(undefined)).to.deep.equal([]);
  });

  it('parses value rows, falling back to the label when no API name is given', () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('values');
    worksheet.addRow(['Label', 'ApiName', 'Default', 'ControllingValues']);
    worksheet.addRow(['Red', 'Red_Value', 'true', 'ControllingA\nControllingB']);
    worksheet.addRow(['Blue']);

    expect(getValuesInfo(worksheet)).to.deep.equal([
      { label: 'Red', fullName: 'Red_Value', default: true, controllingFieldValues: ['ControllingA', 'ControllingB'] },
      { label: 'Blue', fullName: 'Blue', default: false, controllingFieldValues: undefined },
    ]);
  });
});

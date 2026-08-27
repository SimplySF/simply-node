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

import { describe, expect, it } from 'vitest';
import { readPackageManifestMembers } from '../../src/metadata/packageManifest.js';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">';

describe('readPackageManifestMembers', () => {
  it('normalizes a single <types> block with a single <members> element', () => {
    const xml = `${XML_HEADER}\n  <types>\n    <members>My_Flow</members>\n    <name>Flow</name>\n  </types>\n  <version>62.0</version>\n</Package>\n`;

    expect(readPackageManifestMembers(xml, 'Flow')).to.deep.equal(['My_Flow']);
  });

  it('normalizes multiple <types> blocks, each with multiple <members>', () => {
    const xml = `${XML_HEADER}\n  <types>\n    <members>My_Flow</members>\n    <members>Another_Flow</members>\n    <name>Flow</name>\n  </types>\n  <types>\n    <members>My_Permission_Set</members>\n    <members>Another_Permission_Set</members>\n    <name>PermissionSet</name>\n  </types>\n  <version>62.0</version>\n</Package>\n`;

    expect(readPackageManifestMembers(xml, 'Flow')).to.deep.equal(['My_Flow', 'Another_Flow']);
    expect(readPackageManifestMembers(xml, 'PermissionSet')).to.deep.equal([
      'My_Permission_Set',
      'Another_Permission_Set',
    ]);
  });

  it('returns an empty array when the requested type is not present', () => {
    const xml = `${XML_HEADER}\n  <types>\n    <members>My_Flow</members>\n    <name>Flow</name>\n  </types>\n  <version>62.0</version>\n</Package>\n`;

    expect(readPackageManifestMembers(xml, 'PermissionSetGroup')).to.deep.equal([]);
  });

  it('returns an empty array for a Package with no <types> at all', () => {
    const xml = `${XML_HEADER}\n  <version>62.0</version>\n</Package>\n`;

    expect(readPackageManifestMembers(xml, 'Flow')).to.deep.equal([]);
  });
});

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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadJsonConfig,
  loadJsonConfigSync,
  parseJsonConfig,
  type ConfigSchema,
} from '../../src/config/loadJsonConfig.js';

type Widget = { name: string };

/** A stand-in for a zod schema: accepts `{ name: string }` and reports the same failure shape. */
const widgetSchema: ConfigSchema<Widget> = {
  safeParse(data: unknown) {
    const candidate = data as Partial<Widget> | null;

    return typeof candidate?.name === 'string'
      ? { success: true, data: { name: candidate.name } }
      : { success: false, error: { message: 'name: expected string' } };
  },
};

describe('parseJsonConfig', () => {
  it('returns the validated value for input the schema accepts', () => {
    const result = parseJsonConfig('{"name":"gizmo"}', widgetSchema);

    expect(result.success).to.equal(true);
    expect(result.success && result.data).to.deep.equal({ name: 'gizmo' });
  });

  it("returns the validator's own message for input the schema rejects", () => {
    const result = parseJsonConfig('{"name":42}', widgetSchema);

    expect(result.success).to.equal(false);
    expect(!result.success && result.message).to.equal('name: expected string');
  });

  it('throws a SyntaxError for malformed JSON, so callers can report it separately', () => {
    expect(() => parseJsonConfig('{ not json', widgetSchema)).to.throw(SyntaxError);
  });
});

describe('loadJsonConfig', () => {
  let configPath: string | undefined;

  afterEach(() => {
    if (configPath && fs.existsSync(configPath)) {
      fs.rmSync(configPath, { force: true });
    }
    configPath = undefined;
  });

  const writeConfig = (contents: string): string => {
    const target = path.join(os.tmpdir(), `simply-core-config-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(target, contents);
    return target;
  };

  it('reads and validates a config file', async () => {
    configPath = writeConfig('{"name":"gizmo"}');

    const result = await loadJsonConfig(configPath, widgetSchema);

    expect(result.success && result.data).to.deep.equal({ name: 'gizmo' });
  });

  it('reports a schema violation without throwing', async () => {
    configPath = writeConfig('{"name":42}');

    const result = await loadJsonConfig(configPath, widgetSchema);

    expect(!result.success && result.message).to.equal('name: expected string');
  });

  it('rejects when the file cannot be read', async () => {
    const missing = path.join(os.tmpdir(), `simply-core-config-missing-${process.pid}-${Date.now()}.json`);

    await expect(loadJsonConfig(missing, widgetSchema)).rejects.toThrow('ENOENT');
  });

  it('reads and validates synchronously', () => {
    configPath = writeConfig('{"name":"gizmo"}');

    const result = loadJsonConfigSync(configPath, widgetSchema);

    expect(result.success && result.data).to.deep.equal({ name: 'gizmo' });
  });
});

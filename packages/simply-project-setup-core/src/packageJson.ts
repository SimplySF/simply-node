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

import { writeFileSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { log } from './log.js';
import { orderMap } from './orderMap.js';
import { loadRootPath } from './loadRootPath.js';
import { exists } from './exists.js';

export interface PackageJsonContents {
  [key: string]: unknown;
  name: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/** Reads, mutates, and writes back a project's `package.json`, ordering key maps on write. */
export class PackageJson {
  public actions: string[];
  public contents: PackageJsonContents;
  public name: string;
  public originalContents: string;
  public path: string;
  public pjsonPath: string;

  public constructor(packageRoot?: string) {
    this.actions = [];
    let root: string;
    if (packageRoot) {
      root = packageRoot;
    } else {
      try {
        root = loadRootPath('package.json');
      } catch {
        root = process.cwd();
      }
    }
    this.path = root;
    this.name = basename(root);
    this.pjsonPath = join(root, 'package.json');
    if (exists(this.pjsonPath)) {
      this.contents = JSON.parse(readFileSync(this.pjsonPath, 'utf8')) as PackageJsonContents;
    } else {
      this.contents = { name: this.name };
    }
    this.originalContents = this.stringify();
  }

  public stringify(): string {
    if (this.contents.scripts) {
      this.contents.scripts = orderMap(this.contents.scripts);
    }
    if (this.contents.dependencies) {
      this.contents.dependencies = orderMap(this.contents.dependencies);
    }
    if (this.contents.devDependencies) {
      this.contents.devDependencies = orderMap(this.contents.devDependencies);
    }
    return JSON.stringify(this.contents, null, 2) + '\n';
  }

  public write(): void {
    const pjson = this.stringify();
    if (this.originalContents !== pjson) {
      log(`Found changes for ${this.contents.name}`);
      for (const action of this.actions) {
        log(action, 2);
      }

      writeFileSync(this.pjsonPath, pjson);
      log(`wrote changes to ${this.pjsonPath}`, 1);
    }
  }

  public get<T>(name: string, defaultValue: T): T {
    if (!name) {
      throw new Error('property name is required');
    }
    this.contents[name] ??= defaultValue;
    return this.contents[name] as T;
  }
}

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

import { z } from 'zod';

const PackageDirDependencySchema = z
  .object({
    package: z.string(),
    versionNumber: z.string().optional(),
    branch: z.string().optional(),
  })
  .catchall(z.unknown());

/** Base properties for all package directories */
const BasePackageDirPropsSchema = z.object({
  default: z
    .boolean()
    .default(true)
    .optional()
    .describe(
      'If you have specified more than one path, include this parameter for the default path to indicate which is the default package directory.'
    ),
  path: z
    .string()
    .meta({ title: 'Path' })
    .describe("If you don't specify a path, the Salesforce CLI uses a placeholder when you create a package."),
});

/** Package directory with package (requires versionNumber) */
const BasePackageDirWithDependenciesSchema = BasePackageDirPropsSchema.extend({
  dependencies: z
    .array(PackageDirDependencySchema)
    .optional()
    .describe(
      'To specify dependencies for 2GP within the same Dev Hub, use either the package version alias or a combination of the package name and the version number.'
    ),
});

export type PackageDirDependency = z.infer<typeof PackageDirDependencySchema>;
export type BasePackageDirWithDependencies = z.infer<typeof BasePackageDirWithDependenciesSchema>;

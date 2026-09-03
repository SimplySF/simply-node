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

import { z } from 'zod';

/**
 * The schema for a project's `.sfdevrc.json` — this package's one opinionated, named config-file
 * format (unlike template packs/presets/package.json defaults, which are entirely a consumer's own
 * choice). `resolveSetupConfig` reads `setup.include`/`setup.exclude`; `buildBranchRegex` reads
 * `branchRegex`/`jiraProjectKey`/`jiraProjectKeys`. The remaining fields (`gitlabProjectId`,
 * `deploymentPlugins`) aren't consumed by anything in this package — they're validated here anyway
 * so a project has exactly one schema to satisfy, whether the field is read by this package, by a
 * consumer's own commands (e.g. a release command keyed on `gitlabProjectId`), or both.
 */
export const sfdevrcSchema = z
  .object({
    $schema: z.string().url().optional().describe('Path to the JSON schema.'),
    gitlabProjectId: z
      .string()
      .optional()
      .describe('The GitLab project ID, used by a release command to set default branches.'),
    jiraProjectKey: z
      .string()
      .optional()
      .describe(
        "A single JIRA project key (e.g., 'ABC'). If configured, local branch names must match JIRA conventions.",
      ),
    jiraProjectKeys: z
      .array(z.string())
      .optional()
      .describe('An array of JIRA project keys to support multi-project work streams. Combined with jiraProjectKey.'),
    branchRegex: z
      .string()
      .optional()
      .describe(
        'A custom regular expression pattern to validate local branch names against. Bypasses standard JIRA-key validation.',
      ),
    deploymentPlugins: z
      .array(z.string())
      .optional()
      .describe(
        'An array of Salesforce CLI plugins that the project requires to be installed automatically during project or happy-soup deployments.',
      ),
    setup: z
      .object({
        include: z.array(z.string()).optional(),
        exclude: z.array(z.string()).optional(),
      })
      .optional()
      .describe('Configuration for the project setup command.'),
  })
  .strict();

export type Sfdevrc = z.infer<typeof sfdevrcSchema>;

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

import fs from 'node:fs';

type SfDevRcConfig = {
  jiraProjectKey?: string;
  jiraProjectKeys?: string[];
};

/**
 * Retrieves Jira project keys from the `.sfdevrc.json` configuration file, or falls back to a
 * provided default. Reads a single or multiple project keys from the configuration, deduplicates
 * them, and filters out empty values.
 */
export function getJiraProjectKeys(passedProjectKey?: string): string[] {
  let projectKeys: string[] = [];
  try {
    if (fs.existsSync('.sfdevrc.json')) {
      const content = fs.readFileSync('.sfdevrc.json', 'utf8');
      const config = JSON.parse(content) as SfDevRcConfig;
      if (config.jiraProjectKey) {
        projectKeys.push(config.jiraProjectKey);
      }
      if (Array.isArray(config.jiraProjectKeys)) {
        projectKeys.push(...config.jiraProjectKeys);
      }
    }
  } catch {
    // Ignore and fall back to the passed command-line project key.
  }

  projectKeys = [...new Set(projectKeys.filter(Boolean))];

  if (projectKeys.length > 0) {
    return projectKeys;
  }

  return passedProjectKey ? [passedProjectKey] : [];
}

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

import { execa } from 'execa';
import { getJiraProjectKeys } from '../sfConfig.js';
import { logger } from '../logger.js';

export type CommitStories = { stories: string; storiesWithUrl: string };

export type GetCommitStoriesOptions = {
  debug?: boolean;
  /** Base URL for linking a Jira issue key, e.g. `https://jira.example.com/browse`. Links are omitted if not provided. */
  jiraBaseUrl?: string;
};

const NOT_AVAILABLE: CommitStories = { stories: 'N/A', storiesWithUrl: 'N/A' };

/**
 * Retrieves Jira story keys referenced in the commit logs between two tags/commits. Fetches the
 * git history, parses commit messages between the two versions, identifies unique Jira keys
 * based on configured prefixes, and builds both a plain string and (if `jiraBaseUrl` is provided)
 * an HTML list with hyperlinks to Jira.
 */
export async function getCommitStories(
  previousVersion: string | undefined,
  targetVersion: string | undefined,
  jiraStoryPrefix: string | undefined,
  options?: GetCommitStoriesOptions,
): Promise<CommitStories> {
  if (
    !previousVersion ||
    !targetVersion ||
    previousVersion === 'N/A' ||
    targetVersion === 'N/A' ||
    previousVersion === targetVersion
  ) {
    return NOT_AVAILABLE;
  }

  try {
    await execa('git', ['fetch', '--unshallow', '--prune', '--tags', '--quiet']);
    const { stdout: commits } = await execa('git', [
      'log',
      '--pretty=oneline',
      `${previousVersion}...${targetVersion}`,
    ]);

    if (!commits) {
      return NOT_AVAILABLE;
    }

    const prefixes = getJiraProjectKeys(jiraStoryPrefix);
    if (prefixes.length === 0) {
      return NOT_AVAILABLE;
    }

    const escapedPrefixes = prefixes.map((p) => p.replace(/[-/^$*+?.()|[\]{}]/g, '\\$&'));
    const storyRegex = new RegExp(`(?:${escapedPrefixes.join('|')})-[0-9]+`, 'gi');
    const stories = [...new Set(commits.toUpperCase().match(storyRegex) ?? [])].sort();

    if (stories.length === 0) {
      return NOT_AVAILABLE;
    }

    const storiesString = stories.join(', ');
    const jiraBaseUrl = options?.jiraBaseUrl;
    const storiesWithUrl = jiraBaseUrl
      ? stories.map((story) => `<a href='${jiraBaseUrl}/${story}'>${story}</a>`).join(', ')
      : storiesString;

    return { stories: storiesString, storiesWithUrl };
  } catch (error) {
    logger.error(`Error getting commit stories: ${(error as Error).message}`);
    if (options?.debug) {
      logger.error(String(error));
    }
    return NOT_AVAILABLE;
  }
}

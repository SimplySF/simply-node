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

export type DevHubConfig = {
  name: string;
  username: string;
  clientId: string;
  instanceUrl: string;
};

/** Zips the four parallel `--dev-hub-*` flag arrays into a list of Dev Hub configs. */
export function parseDevHubs(
  names: string[] = [],
  usernames: string[] = [],
  clientIds: string[] = [],
  instanceUrls: string[] = [],
): DevHubConfig[] {
  if (!(
    names.length === usernames.length &&
    names.length === clientIds.length &&
    names.length === instanceUrls.length
  )) {
    throw new Error(
      'Mismatched number of Dev Hub arguments. Each --dev-hub-name must be accompanied by a username, client-id, and instance-url.',
    );
  }

  return names.map((name, i) => ({
    name,
    username: usernames[i],
    clientId: clientIds[i],
    instanceUrl: instanceUrls[i],
  }));
}

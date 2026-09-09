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
import { OAuth2 } from '@jsforce/jsforce-node';
import { AuthInfo, SfError } from '@salesforce/core';

export type ClientCredentialsAuthOptions = {
  /** The org's login/instance URL, e.g. `https://mydomain.my.salesforce.com`. */
  loginUrl: string;
  /** The Connected App's consumer key (OAuth client ID). */
  consumerKey: string;
  /** The Connected App's consumer secret. Mutually exclusive with `consumerSecretFile`. */
  consumerSecret?: string;
  /** Path to a file containing the consumer secret. Mutually exclusive with `consumerSecret`. */
  consumerSecretFile?: string;
  /** Alias to assign the resulting org auth entry. */
  alias?: string;
  /** Set the resulting org as the default org. */
  setDefault?: boolean;
  /** Set the resulting org as the default Dev Hub. */
  setDefaultDevHub?: boolean;
};

export type ClientCredentialsAuthResult = {
  authInfo: AuthInfo;
  username: string;
  orgId: string;
  instanceUrl: string;
};

async function resolveConsumerSecret(options: ClientCredentialsAuthOptions): Promise<string> {
  const { consumerSecret, consumerSecretFile } = options;

  if (Boolean(consumerSecret) === Boolean(consumerSecretFile)) {
    throw new SfError(
      'Exactly one of consumerSecret or consumerSecretFile must be provided.',
      'InvalidClientCredentialsSecretError',
    );
  }

  if (consumerSecret) {
    return consumerSecret;
  }

  const fileContents = await fs.promises.readFile(consumerSecretFile as string, 'utf8');
  return fileContents.trim();
}

/**
 * Authenticates to a Salesforce org using the OAuth 2.0 Client Credentials grant, and persists
 * the result to the local Salesforce CLI auth store exactly like `sf login org jwt`/`sf org login
 * web` do — the returned org is aliasable and usable via `--target-org` anywhere in the `sf`/
 * `simply` ecosystem afterward.
 *
 * The Salesforce CLI has no built-in support for this grant (only web, JWT, and SFDX auth-url).
 * This proxies `@jsforce/jsforce-node`'s generic OAuth2 token exchange into `@salesforce/core`'s
 * `AuthInfo`, mirroring the same access-token handoff the JWT flow uses internally after its own
 * token exchange.
 *
 * The Connected App's OAuth policy must include the `api` and `id`/`openid` scopes — `AuthInfo`
 * resolves the username/org ID via the `/services/oauth2/userinfo` endpoint, which depends on
 * them. Unlike JWT or web auth, a Client Credentials token runs as the single "run as" user
 * configured on the Connected App in Setup, not a per-request user.
 *
 * @param options - Login URL, Connected App credentials, and optional alias/default settings.
 * @returns The persisted `AuthInfo`, along with the resolved username/org ID/instance URL.
 * @throws {SfError} `InvalidClientCredentialsSecretError` if not exactly one of `consumerSecret`/
 * `consumerSecretFile` is given.
 * @throws {SfError} `ClientCredentialsAuthError` if the token exchange fails.
 */
export async function authenticateClientCredentials(
  options: ClientCredentialsAuthOptions,
): Promise<ClientCredentialsAuthResult> {
  const { loginUrl, consumerKey, alias, setDefault, setDefaultDevHub } = options;
  const consumerSecret = await resolveConsumerSecret(options);

  const oauth2 = new OAuth2({ loginUrl, clientId: consumerKey, clientSecret: consumerSecret });

  let accessToken: string;
  let instanceUrl: string;
  try {
    // eslint-disable-next-line camelcase -- OAuth2 wire-format param name, not ours to rename
    const tokenResponse = await oauth2.requestToken({ grant_type: 'client_credentials' });
    accessToken = tokenResponse.access_token;
    instanceUrl = tokenResponse.instance_url;
  } catch (error) {
    throw new SfError(
      `Client Credentials authentication failed: ${(error as Error).message}`,
      'ClientCredentialsAuthError',
      undefined,
      error as Error,
    );
  }

  const authInfo = await AuthInfo.create({ accessTokenOptions: { accessToken, instanceUrl, loginUrl } });
  await authInfo.save();

  if (alias ?? setDefault ?? setDefaultDevHub) {
    await authInfo.handleAliasAndDefaultSettings({
      alias,
      setDefault: Boolean(setDefault),
      setDefaultDevHub: Boolean(setDefaultDevHub),
    });
  }

  return {
    authInfo,
    username: authInfo.getUsername(),
    orgId: authInfo.getFields().orgId ?? '',
    instanceUrl,
  };
}

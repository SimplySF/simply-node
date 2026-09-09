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
import { OAuth2 } from '@jsforce/jsforce-node';
import { AuthInfo, SfError } from '@salesforce/core';
import { TestContext } from '@salesforce/core/testSetup';
import sinon from 'sinon';
import { afterEach, describe, expect, it } from 'vitest';
import { authenticateClientCredentials } from '../../src/auth/clientCredentialsAuth.js';

/* eslint-disable camelcase -- OAuth2 wire-format field names, not ours to rename */

describe('authenticateClientCredentials', () => {
  const $$ = new TestContext({ sinon });
  let secretFile: string | undefined;

  afterEach(() => {
    $$.restore();
    if (secretFile && fs.existsSync(secretFile)) {
      fs.rmSync(secretFile);
    }
    secretFile = undefined;
  });

  function stubHappyPath(): {
    requestTokenStub: sinon.SinonStub;
    createStub: sinon.SinonStub;
    saveStub: sinon.SinonStub;
    handleAliasStub: sinon.SinonStub;
  } {
    const requestTokenStub = $$.SANDBOX.stub(OAuth2.prototype, 'requestToken').resolves({
      access_token: 'token123',
      instance_url: 'https://my-org.my.salesforce.com',
      token_type: 'Bearer',
      scope: 'api',
      id: 'https://login.salesforce.com/id/00D.../005...',
      signature: 'sig',
      issued_at: '0',
    });

    const saveStub = sinon.stub().resolves();
    const handleAliasStub = sinon.stub().resolves();
    const fakeAuthInfo = {
      save: saveStub,
      handleAliasAndDefaultSettings: handleAliasStub,
      getUsername: () => 'client-credentials-user@example.com',
      getFields: () => ({ orgId: '00Dxx0000000001' }),
    } as unknown as AuthInfo;

    const createStub = $$.SANDBOX.stub(AuthInfo, 'create').resolves(fakeAuthInfo);

    return { requestTokenStub, createStub, saveStub, handleAliasStub };
  }

  it('exchanges a client_credentials grant and persists the resulting AuthInfo', async () => {
    const { requestTokenStub, createStub, saveStub, handleAliasStub } = stubHappyPath();

    const result = await authenticateClientCredentials({
      loginUrl: 'https://my-org.my.salesforce.com',
      consumerKey: 'consumer-key',
      consumerSecret: 'consumer-secret',
    });

    expect(requestTokenStub.calledOnceWith({ grant_type: 'client_credentials' })).to.equal(true);
    expect(createStub.calledOnce).to.equal(true);
    expect(createStub.firstCall.args[0]).to.deep.equal({
      accessTokenOptions: {
        accessToken: 'token123',
        instanceUrl: 'https://my-org.my.salesforce.com',
        loginUrl: 'https://my-org.my.salesforce.com',
      },
    });
    expect(saveStub.calledOnce).to.equal(true);
    expect(handleAliasStub.called).to.equal(false);
    expect(result).to.deep.equal({
      authInfo: await createStub.returnValues[0],
      username: 'client-credentials-user@example.com',
      orgId: '00Dxx0000000001',
      instanceUrl: 'https://my-org.my.salesforce.com',
    });
  });

  it('constructs the OAuth2 client with the given login URL and consumer key/secret', async () => {
    const { requestTokenStub } = stubHappyPath();

    await authenticateClientCredentials({
      loginUrl: 'https://my-org.my.salesforce.com',
      consumerKey: 'consumer-key',
      consumerSecret: 'consumer-secret',
    });

    const oauth2Instance = requestTokenStub.thisValues[0] as OAuth2;
    expect(oauth2Instance.loginUrl).to.equal('https://my-org.my.salesforce.com');
    expect(oauth2Instance.clientId).to.equal('consumer-key');
    expect(oauth2Instance.clientSecret).to.equal('consumer-secret');
  });

  it('reads and trims the secret from consumerSecretFile when given', async () => {
    const { requestTokenStub } = stubHappyPath();
    secretFile = path.join(os.tmpdir(), `simply-core-consumer-secret-${process.pid}-${Date.now()}.txt`);
    fs.writeFileSync(secretFile, 'secret-from-file\n');

    await authenticateClientCredentials({
      loginUrl: 'https://my-org.my.salesforce.com',
      consumerKey: 'consumer-key',
      consumerSecretFile: secretFile,
    });

    expect(requestTokenStub.calledOnce).to.equal(true);
  });

  it('throws before any network call when both consumerSecret and consumerSecretFile are given', async () => {
    const { requestTokenStub } = stubHappyPath();
    secretFile = path.join(os.tmpdir(), `simply-core-consumer-secret-${process.pid}-${Date.now()}.txt`);
    fs.writeFileSync(secretFile, 'secret-from-file');

    await expect(
      authenticateClientCredentials({
        loginUrl: 'https://my-org.my.salesforce.com',
        consumerKey: 'consumer-key',
        consumerSecret: 'consumer-secret',
        consumerSecretFile: secretFile,
      }),
    ).rejects.toThrow(SfError);
    expect(requestTokenStub.called).to.equal(false);
  });

  it('throws before any network call when neither consumerSecret nor consumerSecretFile is given', async () => {
    const { requestTokenStub } = stubHappyPath();

    await expect(
      authenticateClientCredentials({ loginUrl: 'https://my-org.my.salesforce.com', consumerKey: 'consumer-key' }),
    ).rejects.toThrow(SfError);
    expect(requestTokenStub.called).to.equal(false);
  });

  it('wraps a token-exchange failure in an SfError and never calls AuthInfo.create', async () => {
    $$.SANDBOX.stub(OAuth2.prototype, 'requestToken').rejects(
      Object.assign(new Error('invalid_client_id'), { name: 'invalid_client' }),
    );
    const createStub = $$.SANDBOX.stub(AuthInfo, 'create');

    await expect(
      authenticateClientCredentials({
        loginUrl: 'https://my-org.my.salesforce.com',
        consumerKey: 'bad-key',
        consumerSecret: 'bad-secret',
      }),
    ).rejects.toThrow(/Client Credentials authentication failed/);
    expect(createStub.called).to.equal(false);
  });

  it('sets alias/default/default-dev-hub when requested', async () => {
    const { handleAliasStub } = stubHappyPath();

    await authenticateClientCredentials({
      loginUrl: 'https://my-org.my.salesforce.com',
      consumerKey: 'consumer-key',
      consumerSecret: 'consumer-secret',
      alias: 'my-org',
      setDefault: true,
    });

    expect(handleAliasStub.calledOnceWith({ alias: 'my-org', setDefault: true, setDefaultDevHub: false })).to.equal(
      true,
    );
  });
});

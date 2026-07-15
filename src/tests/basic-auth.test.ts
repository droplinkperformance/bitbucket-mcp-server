import { describe, it, expect } from 'vitest';
import { BasicAuthProvider } from '../auth/BasicAuthProvider.js';
import { isBitbucketApiToken } from '../auth/AuthProvider.js';
import { loadConfig, resetConfigCache } from '../infrastructure/config/env.js';

describe('BasicAuthProvider', () => {
  it('builds a Basic Authorization header from email and API token', async () => {
    const provider = new BasicAuthProvider('user@example.com', 'ATATT-secret');
    expect(await provider.getAuthorizationHeader()).toBe(
      `Basic ${Buffer.from('user@example.com:ATATT-secret').toString('base64')}`,
    );
  });

  it('returns the secret as getAccessToken for masking/logging', async () => {
    const provider = new BasicAuthProvider('user@example.com', 'ATATT-secret');
    expect(await provider.getAccessToken()).toBe('ATATT-secret');
  });
});

describe('isBitbucketApiToken', () => {
  it('detects ATATT-prefixed tokens', () => {
    expect(isBitbucketApiToken('ATATT3xabc')).toBe(true);
    expect(isBitbucketApiToken('oauth-token')).toBe(false);
  });
});

describe('loadConfig auth mode', () => {
  it('requires BITBUCKET_EMAIL for ATATT API tokens', () => {
    resetConfigCache();
    expect(() =>
      loadConfig({
        BITBUCKET_ACCESS_TOKEN: 'ATATT3xabc',
      } as NodeJS.ProcessEnv),
    ).toThrow(/BITBUCKET_EMAIL/i);
  });

  it('selects basic mode when email + ATATT token are provided', () => {
    resetConfigCache();
    const config = loadConfig({
      BITBUCKET_ACCESS_TOKEN: 'ATATT3xabc',
      BITBUCKET_EMAIL: 'user@example.com',
    } as NodeJS.ProcessEnv);
    expect(config.authMode).toBe('basic');
  });

  it('selects bearer token mode for non-ATATT tokens without email', () => {
    resetConfigCache();
    const config = loadConfig({
      BITBUCKET_ACCESS_TOKEN: 'oauth-access-token',
    } as NodeJS.ProcessEnv);
    expect(config.authMode).toBe('token');
  });
});

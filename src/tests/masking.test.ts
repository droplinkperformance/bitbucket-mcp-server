import { describe, it, expect } from 'vitest';
import { Service } from '../services/masking/Service.js';

describe('masking Service', () => {
  const service = new Service();

  it('masks bearer tokens in strings', () => {
    expect(service.maskString('Authorization: Bearer abc.def.ghi')).toContain('[REDACTED]');
    expect(service.maskString('Authorization: Bearer abc.def.ghi')).not.toContain('abc.def.ghi');
  });

  it('masks access_token query params but keeps the key', () => {
    const out = service.maskString('https://x/y?access_token=supersecret&page=2');
    expect(out).toContain('access_token=[REDACTED]');
    expect(out).toContain('page=2');
  });

  it('masks sensitive object keys recursively', () => {
    const masked = service.mask({
      authorization: 'Bearer abc',
      nested: { refresh_token: 'r1', safe: 'value' },
      list: [{ client_secret: 's' }],
    }) as Record<string, any>;
    expect(masked.authorization).toBe('[REDACTED]');
    expect(masked.nested.refresh_token).toBe('[REDACTED]');
    expect(masked.nested.safe).toBe('value');
    expect(masked.list[0].client_secret).toBe('[REDACTED]');
  });

  it('masks JWT-like tokens embedded in text', () => {
    const out = service.maskString('token is eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 done');
    expect(out).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });
});

import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { TokenBundle, TokenStore } from './TokenStore.js';

/**
 * Default token store. Persists the rotating refresh token to disk with
 * restrictive permissions (0600) so a long-lived process survives restarts
 * without forcing a full re-authorization.
 */
export class FileTokenStore implements TokenStore {
  private readonly filePath: string;

  constructor(options: { filePath: string }) {
    this.filePath = resolve(options.filePath);
  }

  async load(): Promise<TokenBundle | null> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as TokenBundle;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async save(bundle: TokenBundle): Promise<void> {
    await fs.mkdir(dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(bundle, null, 2), { mode: 0o600 });
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

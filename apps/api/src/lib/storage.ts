import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config';

/**
 * Private file storage. Files are never served statically; the documents route streams them after
 * an authorisation check. shortcut: only a local-disk driver exists; add an S3-compatible driver
 * implementing this interface before running more than one API instance.
 */
export interface StorageDriver {
  put(data: Buffer): Promise<string>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

const root = resolve(config.STORAGE_LOCAL_DIR);
const safePath = (key: string) => {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid storage key');
  return join(root, key.slice(0, 2), key);
};

export const storage: StorageDriver = {
  async put(data) {
    const key = randomUUID();
    const p = safePath(key);
    await mkdir(join(root, key.slice(0, 2)), { recursive: true });
    await writeFile(p, data, { mode: 0o600 });
    return key;
  },
  get: (key) => readFile(safePath(key)),
  remove: (key) => rm(safePath(key), { force: true }),
};

/** Check magic bytes so a renamed executable cannot pass as a PDF/JPEG/PNG. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

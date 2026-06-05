import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolves to backend/cache/ regardless of src vs dist
const CACHE_DIR = join(__dirname, '../../../cache');

function cacheFile(key: string): string {
  return join(CACHE_DIR, `${key}.json`);
}

export function readDiskCache<T>(key: string): T | null {
  const file = cacheFile(key);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export function writeDiskCache<T>(key: string, data: T): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cacheFile(key), JSON.stringify(data, null, 2), 'utf-8');
}

export function deleteDiskCache(key: string): boolean {
  const file = cacheFile(key);
  if (!existsSync(file)) return false;
  try {
    unlinkSync(file);
    return true;
  } catch {
    return false;
  }
}

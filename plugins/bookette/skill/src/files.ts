import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Every file under dir, recursively; an absent directory is simply empty. */
export function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) found.push(full);
    }
  };
  walk(dir);
  return found;
}

import { readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
function* files(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) yield* files(path);
    else if (name.endsWith('.js')) yield path;
  }
}
for (const file of files('v2/src')) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for(const file of readdirSync('v2/src').filter(f=>f.endsWith('.js')&&!f.startsWith('.'))) {
  const result=spawnSync(process.execPath,['--check',`v2/src/${file}`],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}

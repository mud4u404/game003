import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const relay=path.resolve('tools/codex-relay.mjs');
for (const blocked of [false, true]) test(`paginated jobs continue with ${blocked ? 'persistent' : 'transient'} notification failure without reruns or private logs`,()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'relay-integration-')),bin=path.join(dir,'bin');mkdirSync(bin);
  const executable=(name,body)=>{const p=path.join(bin,name);writeFileSync(p,`#!${process.execPath}\n${body}`,{mode:0o700});return p;};
  try {
    const gh=executable('gh',`const fs=require('fs'),p=require('path');const a=process.argv.slice(2),dir=process.env.FIXTURE_DIR;
if(a[0]==='api'&&a[1].includes('/issues/comments?'))console.log(JSON.stringify([[...(process.env.FAIL_NOTICES ? [{id:11,issue_url:'https://api.github.com/repos/mud4u404/game003/issues/8',html_url:'https://github.com/mud4u404/game003/pull/8#issuecomment-11',user:{login:'mud4u404'},body:'<!-- relay:codex --> second',created_at:'2026-09-28T00:01:00Z'}] : []),{id:10,issue_url:'https://api.github.com/repos/mud4u404/game003/issues/7',html_url:'https://github.com/mud4u404/game003/pull/7#issuecomment-10',user:{login:'mud4u404'},body:'<!-- relay:codex --> fixture',created_at:'2026-09-28T00:00:00Z'}],[]]));
else if(a[0]==='api'&&a[1].includes('/pulls/'))console.log(JSON.stringify({state:'open',head:{ref:'codex/T999-fixture',repo:{full_name:'mud4u404/game003'}}}));
else if(a[0]==='api')console.log('[[]]');
else if(a[0]==='pr'&&a[1]==='comment') {if(process.env.FAIL_NOTICES && a[2]==='7')process.exit(1);if(!fs.existsSync(p.join(dir,'first-failure'))){fs.writeFileSync(p.join(dir,'first-failure'),'1');process.exit(1);} fs.writeFileSync(p.join(dir,'comment'),fs.readFileSync(a[a.indexOf('--body-file')+1]));}
else process.exit(2);`);
    executable('git',`const a=process.argv.slice(2);if(a[0]==='branch')console.log('codex/T999-fixture');else if(a[0]==='rev-list')console.log('0');else if(a[0]==='rev-parse')console.log('abc');else if(a[0]==='ls-remote')console.log('abc\\trefs/heads/codex/T999-fixture');`);
    const codex=executable('codex fake',`const fs=require('fs'),p=require('path');process.stdin.resume();process.stdin.on('end',()=>{fs.appendFileSync(p.join(process.env.FIXTURE_DIR,'runs'),'run\\n');const a=process.argv.slice(2);fs.writeFileSync(a[a.indexOf('--output-last-message')+1],'fixture complete');console.error('PRIVATE TOOL LOG MUST STAY LOCAL');});`);
    const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,RELAY_ROOT:dir,RELAY_STATE_DIR:path.join(dir,'state'),GH_BIN:gh,CODEX_CMD:JSON.stringify([codex,'exec']),FIXTURE_DIR:dir,RELAY_RETRY_MS:'1',FAIL_NOTICES:blocked?'1':''};
    for(let i=0;i<2;i++){const r=spawnSync(process.execPath,[relay,'--once'],{env,encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);}
    assert.equal(readFileSync(path.join(dir,'runs'),'utf8'),blocked?'run\nrun\n':'run\n');
    const comment=readFileSync(path.join(dir,'comment'),'utf8');assert.match(comment,/fixture complete/);assert.doesNotMatch(comment,/PRIVATE/);
    assert.equal(JSON.parse(readFileSync(path.join(dir,'state/state.json'),'utf8')).jobs['10'].status,blocked?'finished':'notified');
    const check=spawnSync(process.execPath,[relay,'--check'],{env,encoding:'utf8'});assert.equal(check.status,0);assert.equal(readFileSync(path.join(dir,'runs'),'utf8'),blocked?'run\nrun\n':'run\n');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

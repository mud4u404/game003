import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { commandArgs,pendingComments,readState,saveState,acquireLock,MARK,DONE } from '../../tools/codex-relay.mjs';
test('CLI commands support spaces/quotes without a shell',()=>{
  assert.deepEqual(commandArgs('"/Applications/Test App/codex" exec -c \'a="b c"\''),['/Applications/Test App/codex','exec','-c','a="b c"']);
  assert.deepEqual(commandArgs('["/a b/codex","exec","--approve-for-me"]'),['/a b/codex','exec','--approve-for-me']);
  assert.throws(()=>commandArgs('codex "'));assert.throws(()=>commandArgs('[]'));assert.throws(()=>commandArgs('[1]'));
  assert.ok(!commandArgs().includes('--full-auto'));assert.ok(commandArgs().includes('--approve-for-me'));
});
test('only allowed marked comments run, oldest first, exactly once',()=>{
  const c=(id,author,body=MARK)=>({id,user:{login:author},body,created_at:`2026-09-${String(id).padStart(2,'0')}`});
  assert.deepEqual(pendingComments([c(5,'owner'),c(1,'other'),c(2,'owner',MARK+DONE),c(3,'owner'),c(4,'owner')],['owner'],{'4':{status:'finished'}}).map(c=>c.id),[3,5]);
});
test('state is durable, legacy handled IDs retained, corrupt state fails closed',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'relay-state-')),file=path.join(dir,'state.json');
  try{const s=readState(file,'2026-09-28T00:00:00Z');saveState(file,s);assert.deepEqual(readState(file),s);
    writeFileSync(file,JSON.stringify({since:s.since,handled:[123]}));assert.equal(readState(file).jobs['123'].status,'notified');
    writeFileSync(file,'not json');assert.throws(()=>readState(file));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('single-instance lock protects an active process',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'relay-lock-')),file=path.join(dir,'relay.lock');
  try{const release=acquireLock(file);assert.throws(()=>acquireLock(file),/already running/);release();const again=acquireLock(file);again();}
  finally{rmSync(dir,{recursive:true,force:true});}
});

#!/usr/bin/env node
// Install this revision as a macOS login LaunchAgent; do not run from a task branch.
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, copyFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.platform !== 'darwin') throw new Error('This installer targets macOS launchd');
const run = (cmd,args) => execFileSync(cmd,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const locate = name => run('/usr/bin/which',[name]);
const node = process.execPath, codex = locate('codex'), gh = locate('gh');
run(codex,['login','status']);run(gh,['auth','status']);
const home = os.homedir(), install = path.join(home,'Library/Application Support/game003-relay');
const workspace = path.join(install,'workspace'), state = path.join(install,'state');
const label = 'com.mud4u404.game003.codex-relay', domain = `gui/${process.getuid()}`;
const plist = path.join(home,'Library/LaunchAgents',label+'.plist');
mkdirSync(state,{recursive:true,mode:0o700});mkdirSync(path.dirname(plist),{recursive:true});
if (!existsSync(path.join(workspace,'.git'))) run('git',['clone','git@github.com:mud4u404/game003.git',workspace]);
const remote=run('git',['-C',workspace,'remote','get-url','origin']);
if(remote!=='git@github.com:mud4u404/game003.git')throw new Error('Unexpected runtime remote; inspect instead of overwriting');
run('git',['-C',workspace,'config','pull.ff','only']);run('git',['-C',workspace,'config','push.default','simple']);
// Stop only our existing service, leaving any running task's checkout intact.
try { run('launchctl',['print',`${domain}/${label}`]);run('launchctl',['bootout',`${domain}/${label}`]); } catch(e) { if(!String(e.stderr||'').includes('Could not find service'))throw e; }
copyFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'codex-relay.mjs'),path.join(install,'codex-relay.mjs'));
const env = {
  PATH:[path.dirname(node),path.dirname(codex),path.dirname(gh),'/usr/bin','/bin','/usr/sbin','/sbin'].join(':'),
  CODEX_CMD:process.env.CODEX_CMD||JSON.stringify([codex,'exec','--approve-for-me','-c','sandbox_workspace_write.network_access=true']),
  GH_BIN:gh,GH_PROMPT_DISABLED:'1',GIT_TERMINAL_PROMPT:'0',
  RELAY_ROOT:workspace,RELAY_STATE_DIR:state,RELAY_REPO:'mud4u404/game003',
  RELAY_AUTHORS:process.env.RELAY_AUTHORS||'mud4u404',RELAY_INTERVAL_SEC:'60',
};
const xml = text => String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
writeFileSync(plist,`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(node)}</string><string>${xml(path.join(install,'codex-relay.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${xml(workspace)}</string>
<key>EnvironmentVariables</key><dict>${Object.entries(env).map(([k,v])=>`<key>${xml(k)}</key><string>${xml(v)}</string>`).join('')}</dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>60</integer>
<key>StandardOutPath</key><string>${xml(path.join(state,'launchd.stdout.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(state,'launchd.stderr.log'))}</string>
</dict></plist>\n`,{mode:0o600});
run('plutil',['-lint',plist]);run('launchctl',['enable',`${domain}/${label}`]);
// bootout can finish asynchronously; retry only our own validated job for a short window.
for(let attempt=0;;attempt++){
  try{run('launchctl',['bootstrap',domain,plist]);break;}
  catch(e){if(attempt>=4)throw e;await new Promise(resolve=>setTimeout(resolve,1000));}
}
console.log(run('launchctl',['print',`${domain}/${label}`]));
console.log(`Installed: ${plist}\nRuntime: ${workspace}\nLogs/state: ${state}`);

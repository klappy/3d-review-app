// DEV deploy path for the Workers Builds trigger "Dev Deploy (main)".
// Order: roadmap one-off (kept until retired) -> wrangler d1 migrations apply -> wrangler deploy.
// Borrowed, not built: Wrangler's own migrations table (d1_migrations, ./migrations). Any failure fails the build.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const cli=join(root,'node_modules/wrangler/wrangler-dist/cli.js');
// Invoke the pinned CLI directly: Wrangler's bin wrapper maps a signal-killed child to exit 0.
export function run(args,{spawn=spawnSync,env={...process.env,CI:'true'}}={}){
 const r=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit'});
 if(r.error||r.signal||r.status!==0)throw Error(`step failed: ${args.slice(1).join(' ')} status=${r.status??'none'} signal=${r.signal??'none'}`);
}
export function steps(){
 const s=[];
 if(existsSync(join(root,'scripts/prepare-roadmap-deploy.mjs')))s.push([join(root,'scripts/prepare-roadmap-deploy.mjs'),'dev']);
 s.push([cli,'d1','migrations','apply','DB','--remote','--config','wrangler.toml']);
 s.push([cli,'deploy','--config','wrangler.toml']);
 return s;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 try{for(const a of steps())run(a);}catch(e){console.error(e.message);process.exitCode=1;}
}

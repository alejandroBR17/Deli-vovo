import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';

test('compiled schedule module starts in native Node ESM without the development TS loader',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'delivovo-esm-'));
 try {
  await writeFile(path.join(directory,'package.json'),JSON.stringify({type:'module'}));
  for(const name of ['order-schedule','store-hours']){
   const source=await readFile(new URL(`../src/utils/${name}.ts`,import.meta.url),'utf8');
   const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
   await writeFile(path.join(directory,`${name}.js`),result.outputText);
  }
  const url=pathToFileURL(path.join(directory,'order-schedule.js')).href;
  const script=`const {validateSchedule}=await import(${JSON.stringify(url)});console.log(validateSchedule('2099-01-01T15:00',{}));`;
  const output=execFileSync(process.execPath,['--input-type=module','--eval',script],{encoding:'utf8',env:{...process.env,NODE_OPTIONS:''}});
  assert.equal(output.trim(),'2099-01-01T15:00:00-03:00');
 }finally{
  assert.equal(path.dirname(directory),tmpdir());assert.ok(path.basename(directory).startsWith('delivovo-esm-'));
  await rm(directory,{recursive:true});
 }
});

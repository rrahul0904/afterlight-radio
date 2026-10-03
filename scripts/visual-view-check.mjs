import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime=await readFile(new URL('./visual-view-runtime.js',import.meta.url),'utf8');
const idleGuard=await readFile(new URL('./visual-idle-guard.js',import.meta.url),'utf8');
const build=await readFile(new URL('./build.mjs',import.meta.url),'utf8');
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));

for(const marker of [
  'Another view',
  'Music keeps playing',
  "afterlight:visual-preferences:v1",
  'pointer-events:none',
  'prefers-reduced-motion:reduce',
  'requestFullscreen',
  "['original','closer','soft-glow','after-dark']",
  "['default','focus','canvas']"
]) assert.ok(runtime.includes(marker),`visual runtime missing contract marker: ${marker}`);

for(const marker of [
  'afterlight-visual-hidden',
  "attributeFilter:['class','data-auto-hide','data-display-mode']",
  "canvas:['.copy','.player']",
  "focus:['.copy']"
]) assert.ok(idleGuard.includes(marker),`idle guard missing contract marker: ${marker}`);

for(const [label,source] of [['visual runtime',runtime],['idle guard',idleGuard]]){
  for(const forbidden of [/\bnew\s+Audio\s*\(/,/\.play\s*\(/,/\.pause\s*\(/,/\.src\s*=/]){
    assert.equal(forbidden.test(source),false,`${label} must not control playback: ${forbidden}`);
  }
}

assert.ok(build.includes("'/visual-view-runtime.js'"),'build must inject visual-view-runtime.js');
assert.ok(build.includes("'visual-view-runtime.js'"),'build must copy visual-view-runtime.js');
assert.ok(build.includes("'/visual-idle-guard.js'"),'build must inject visual-idle-guard.js');
assert.ok(build.includes("'visual-idle-guard.js'"),'build must copy visual-idle-guard.js');
assert.equal(pkg.scripts['check:visual-view'],'node scripts/visual-view-check.mjs');
assert.ok(pkg.scripts.test.includes('check:visual-view'),'npm test must enforce the visual-view contract');

console.log('visual-view contract OK');

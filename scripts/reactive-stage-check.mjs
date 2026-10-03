import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime=await readFile(new URL('./reactive-stage-runtime.js',import.meta.url),'utf8');
const build=await readFile(new URL('./build.mjs',import.meta.url),'utf8');
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));

for(const marker of [
  "afterlight:reactive-stage:v1",
  "['halo','drift','pulse']",
  'createMediaElementSource(audio)',
  'createAnalyser()',
  'getByteFrequencyData',
  'requestAnimationFrame',
  'prefers-reduced-motion: reduce',
  'pointer-events:none!important',
  'user-select:none!important',
  'URL.createObjectURL(file)',
  'URL.revokeObjectURL',
  "startsWith('audio/')",
  'Local audition loaded · stays on this device'
]) assert.ok(runtime.includes(marker),`reactive stage missing contract marker: ${marker}`);

for(const forbidden of [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /sendBeacon/,
  /\bFormData\b/,
  /trackEvent\s*\(/,
  /localStorage\.setItem\([^\n]*localName/,
  /sessionStorage\.setItem\([^\n]*localName/
]) assert.equal(forbidden.test(runtime),false,`reactive stage must remain local-first: ${forbidden}`);

assert.ok(build.includes("'/reactive-stage-runtime.js'"),'build must inject reactive-stage-runtime.js');
assert.ok(build.includes("'reactive-stage-runtime.js'"),'build must copy reactive-stage-runtime.js');
assert.equal(pkg.scripts['check:reactive-stage'],'node scripts/reactive-stage-check.mjs');
assert.ok(pkg.scripts.test.includes('check:reactive-stage'),'npm test must enforce reactive-stage contract');

console.log('reactive-stage contract OK');

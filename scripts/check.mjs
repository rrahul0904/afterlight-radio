import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const pub=path.join(root,'public');
const slugs=['roma','window','long-way-home','two-hundred','one-more-log','rooftop','friends','backroom','headspace','last-bus','momentum','between'];

await access(path.join(pub,'index.html'));
for (const slug of slugs) await access(path.join(pub,slug,'index.html'));

const html=await readFile(path.join(root,'index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
const runtime=scripts.at(-1)?.[1];
if (!runtime) throw new Error('Inline runtime script missing');
new Function(runtime);

const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const wrangler=JSON.parse(await readFile(path.join(root,'wrangler.jsonc'),'utf8'));
if (pkg.scripts.build !== 'node scripts/build.mjs') throw new Error('Unexpected build command');
if (wrangler.assets?.directory !== './public') throw new Error('Wrangler assets directory mismatch');

for (const slug of slugs) {
  if (!html.includes(`slug:'${slug}'`)) throw new Error(`Room missing from runtime: ${slug}`);
}
if ((html.match(/slug:'/g)||[]).length !== 12) throw new Error('Runtime must contain exactly 12 rooms');
if (!html.includes('audio/wav')) throw new Error('Runtime WAV generation is missing');
if (!html.includes('new Audio()')) throw new Error('HTMLMediaElement player is missing');
if (!html.includes("setAttribute('playsinline','')")) throw new Error('iOS playsinline path is missing');
if (!html.includes("if(i<0)i=5")) throw new Error('Root rooftop fallback is missing');

const productChecks = [
  ["FREE=new Set(['rooftop','window','roma'])",'Free/premium entitlement boundary'],
  ["id=\"favorite\"",'Favorites control'],
  ["id=\"shareBtn\"",'Share control'],
  ["id=\"timerBtn\"",'Timer control'],
  ["data-min=\"15\"",'15 minute timer'],
  ["data-min=\"30\"",'30 minute timer'],
  ["data-min=\"60\"",'60 minute timer'],
  ["id=\"upgrade\"",'Afterlight+ upgrade dialog'],
  ["$2.99",'Monthly pricing'],
  ["$19.99",'Founding annual pricing'],
  ["id=\"home\"",'Editorial discovery home'],
  ["navigator.share",'Native share path'],
  ["favs=new Set",'Persistent favorites state'],
  ["timerEnd",'Persistent listening timer state']
];
for (const [needle,label] of productChecks) {
  if (!html.includes(needle)) throw new Error(`${label} is missing`);
}

console.log('PASS: 12 routes, runtime JS syntax, Cloudflare config, WAV audio, native Audio player, iOS playsinline, rooftop default, editorial home, freemium gating, favorites, share, timers and pricing UX');

import { readFile } from 'node:fs/promises';

const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
if(config.outputDirectory!=='public')throw new Error('Vercel outputDirectory must remain public');
if(config.rewrites?.[0]?.destination!=='/api?path=:path*')throw new Error('Vercel API proxy rewrite drifted');
const global=config.headers?.find(rule=>rule.source==='/(.*)');
if(!global)throw new Error('Global Vercel security headers missing');
const headers=Object.fromEntries(global.headers.map(({key,value})=>[key.toLowerCase(),value]));
const required={
  'x-frame-options':'DENY',
  'x-content-type-options':'nosniff',
  'referrer-policy':'strict-origin-when-cross-origin',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  'cross-origin-opener-policy':'same-origin'
};
for(const [key,value] of Object.entries(required))if(headers[key]!==value)throw new Error(`Missing or incorrect ${key}`);
const audio=config.headers?.find(rule=>rule.source==='/audio/(.*)');
if(!audio?.headers?.some(h=>h.key.toLowerCase()==='cache-control'&&h.value.includes('immutable')))throw new Error('Immutable audio cache header missing');
console.log('PASS: Vercel routing, production security headers and immutable audio cache policy');

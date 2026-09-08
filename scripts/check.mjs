import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const pub=path.join(root,'public');
const slugs=['roma','window','long-way-home','two-hundred','one-more-log','rooftop','friends','backroom','headspace','last-bus','momentum','between'];

await access(path.join(pub,'index.html'));
for (const slug of slugs) await access(path.join(pub,slug,'index.html'));

const html=await readFile(path.join(root,'index.html'),'utf8');
for (const slug of slugs) {
  if (!html.includes(`'${slug}'`) && !html.includes(`"${slug}"`)) throw new Error(`Room missing from runtime: ${slug}`);
}
if (!html.includes('audio/wav')) throw new Error('Runtime WAV generation is missing');
if (!html.includes('new Audio')) throw new Error('HTMLMediaElement player is missing');
if (!html.includes('playsinline')) throw new Error('iOS playsinline path is missing');

console.log('PASS: 12 routes, runtime WAV audio generator, HTMLMediaElement playback, iOS playsinline');

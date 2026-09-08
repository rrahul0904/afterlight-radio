import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'public');
const slugs = ['roma','window','long-way-home','two-hundred','one-more-log','rooftop','friends','backroom','headspace','last-bus','momentum','between'];

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

const html = await readFile(path.join(root,'index.html'),'utf8');
await writeFile(path.join(out,'index.html'), html);

for (const slug of slugs) {
  const dir = path.join(out,slug);
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'index.html'), html);
}

await writeFile(path.join(out,'404.html'), html);
await writeFile(path.join(out,'_headers'), `
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`.trimStart());

console.log(`Built ${slugs.length} clean room routes into public/`);

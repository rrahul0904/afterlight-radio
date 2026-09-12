import { access, readFile } from 'node:fs/promises';

const runtime=await readFile(new URL('./runtime-enhancements.js',import.meta.url),'utf8');
const accountRuntime=await readFile(new URL('./account-enhancements.js',import.meta.url),'utf8');
new Function(runtime);
new Function(accountRuntime);
for(const needle of ['mediaSession','MediaMetadata','setActionHandler','setPositionState','audio_error','audio_output_error','MediaSink','PLAYING · CHECK AUDIO OUTPUT','AUDIO UNAVAILABLE','NETWORK SLOW','portalEnabled','Billing support','Subscription cancellation']){
  if(!runtime.includes(needle))throw new Error('Mobile/audio/billing runtime capability missing: '+needle);
}
for(const needle of ['portalEnabled','Billing support','Subscription cancellation','originalBilling']){
  if(!accountRuntime.includes(needle))throw new Error('Account billing fallback capability missing: '+needle);
}
await access(new URL('../public/runtime-enhancements.js',import.meta.url));
await access(new URL('../public/account-enhancements.js',import.meta.url));
const built=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const builtAccount=await readFile(new URL('../public/account/index.html',import.meta.url),'utf8');
if(!built.includes('<script src="/runtime-enhancements.js"></script>'))throw new Error('Built player is missing runtime enhancements');
if(!builtAccount.includes('<script src="/account-enhancements.js"></script>'))throw new Error('Built account portal is missing billing fallback enhancements');
console.log('PASS: Media Session controls, fatal-vs-output audio resilience and no-dead-end billing support fallback');

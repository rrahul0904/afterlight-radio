import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { musicRooms } from './audio-library.mjs';

const args=process.argv.slice(2);
const arg=(name,fallback)=>{
  const i=args.indexOf('--'+name);
  return i>=0&&args[i+1]!==undefined?args[i+1]:fallback;
};
const audioPath=path.resolve(arg('audio',''));
const metadataPath=path.resolve(arg('metadata',''));
const outRoot=path.resolve(arg('out','.music-lab/imported-master'));
if(!arg('audio','')||!arg('metadata',''))throw new Error('Usage: node scripts/music-master-intake.mjs --audio master.wav --metadata master.json [--out .music-lab/<package>]');

function readAscii(buffer,start,length){return buffer.subarray(start,start+length).toString('ascii')}
function parseWav(buffer){
  if(buffer.length<44||readAscii(buffer,0,4)!=='RIFF'||readAscii(buffer,8,4)!=='WAVE')throw new Error('Master must be a RIFF/WAVE file');
  let offset=12,fmt=null,data=null;
  while(offset+8<=buffer.length){
    const id=readAscii(buffer,offset,4),size=buffer.readUInt32LE(offset+4),start=offset+8,end=start+size;
    if(end>buffer.length)throw new Error('Malformed WAV chunk '+id);
    if(id==='fmt '){
      if(size<16)throw new Error('WAV fmt chunk is too short');
      fmt={
        audioFormat:buffer.readUInt16LE(start),
        channels:buffer.readUInt16LE(start+2),
        sampleRate:buffer.readUInt32LE(start+4),
        byteRate:buffer.readUInt32LE(start+8),
        blockAlign:buffer.readUInt16LE(start+12),
        bits:buffer.readUInt16LE(start+14)
      };
    }else if(id==='data'&&!data){
      data={start,size};
    }
    offset=end+(size%2);
  }
  if(!fmt||!data)throw new Error('WAV is missing fmt or data chunk');
  if(fmt.audioFormat!==1)throw new Error('Only uncompressed PCM WAV masters are accepted in this slice');
  if(fmt.channels!==2)throw new Error('Master must be stereo');
  if(![32000,44100,48000].includes(fmt.sampleRate))throw new Error('Master sample rate must be 32, 44.1, or 48 kHz');
  if(![16,24].includes(fmt.bits))throw new Error('Master bit depth must be 16-bit or 24-bit PCM');
  const expectedBlock=fmt.channels*(fmt.bits/8);
  if(fmt.blockAlign!==expectedBlock)throw new Error('Unexpected WAV block alignment');
  const frames=Math.floor(data.size/fmt.blockAlign),duration=frames/fmt.sampleRate;
  if(duration<90||duration>600)throw new Error('Master duration must be between 90 and 600 seconds; got '+duration.toFixed(2));
  return {...fmt,...data,frames,duration};
}

function sampleAt(buffer,offset,bits){
  if(bits===16)return buffer.readInt16LE(offset)/32768;
  const raw=buffer.readIntLE(offset,3);
  return raw/8388608;
}
function metrics(buffer,wav){
  const bytesPerSample=wav.bits/8,stride=Math.max(1,Math.floor(wav.sampleRate/1200));
  let sum=0,sumL=0,sumR=0,diff=0,mono=0,peak=0,dcL=0,dcR=0,count=0,nearClip=0;
  for(let frame=0;frame<wav.frames;frame+=stride){
    const base=wav.start+frame*wav.blockAlign;
    if(base+wav.blockAlign>buffer.length)break;
    const l=sampleAt(buffer,base,wav.bits),r=sampleAt(buffer,base+bytesPerSample,wav.bits);
    sum+=(l*l+r*r)/2;sumL+=l*l;sumR+=r*r;diff+=(l-r)*(l-r);mono+=((l+r)*.5)**2;
    dcL+=l;dcR+=r;peak=Math.max(peak,Math.abs(l),Math.abs(r));
    if(Math.abs(l)>.999||Math.abs(r)>.999)nearClip++;count++;
  }
  if(!count)throw new Error('Master contains no readable audio frames');
  const rms=Math.sqrt(sum/count),leftRms=Math.sqrt(sumL/count),rightRms=Math.sqrt(sumR/count),stereoRatio=Math.sqrt(diff/count)/(Math.sqrt(mono/count)+.0001);
  const dc=Math.max(Math.abs(dcL/count),Math.abs(dcR/count)),balance=Math.min(leftRms,rightRms)/(Math.max(leftRms,rightRms)+.000001);
  const technicalPass=rms>=.008&&rms<=.45&&peak>=.08&&peak<.99995&&peak/(rms||.00001)>=1.2&&stereoRatio>=.025&&dc<=.04&&balance>=.35&&nearClip===0;
  return {
    durationSeconds:Number(wav.duration.toFixed(2)),
    sampleRate:wav.sampleRate,
    channels:wav.channels,
    bits:wav.bits,
    rms:Number(rms.toFixed(5)),
    samplePeak:Number(peak.toFixed(5)),
    crest:Number((peak/(rms||.00001)).toFixed(3)),
    stereoRatio:Number(stereoRatio.toFixed(3)),
    dc:Number(dc.toFixed(6)),
    channelBalance:Number(balance.toFixed(3)),
    nearClipSamples:nearClip,
    technicalPass
  };
}
function slug(value){
  return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
}
function validateMetadata(meta){
  if(meta?.schemaVersion!==1)throw new Error('Metadata schemaVersion must be 1');
  const id=slug(meta.id),room=String(meta.room||'').trim();
  const knownRoom=musicRooms.find(entry=>entry.slug===room);
  if(!id)throw new Error('Metadata id is required');
  if(!knownRoom)throw new Error('Metadata room must be one of: '+musicRooms.map(entry=>entry.slug).join(', '));
  if(!String(meta.title||'').trim())throw new Error('Metadata title is required');
  if(!['open-music-studio','human-produced','commissioned-original'].includes(meta.sourceType))throw new Error('Unsupported sourceType');
  if(!['first-party','licensed-for-afterlight'].includes(meta.rightsStatus))throw new Error('rightsStatus must be first-party or licensed-for-afterlight');
  if(meta.rightsStatus==='licensed-for-afterlight'&&!String(meta.licenseReference||'').trim())throw new Error('Licensed masters require licenseReference');
  if(!String(meta.creator||'').trim())throw new Error('creator is required');
  if(!String(meta.sourceRevision||'').trim())throw new Error('sourceRevision is required');
  if(meta.commercialUseCleared!==true)throw new Error('commercialUseCleared must be true');
  if(meta.containsThirdPartySamples===true&&!String(meta.thirdPartyClearanceReference||'').trim())throw new Error('Third-party samples require thirdPartyClearanceReference');
  if(meta.aiAssisted===true&&!String(meta.modelDisclosure||'').trim())throw new Error('AI-assisted masters require modelDisclosure');
  return {id,knownRoom};
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function reviewHtml(manifest){
  const c=manifest.candidates[0];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Afterlight Master Review · ${escapeHtml(c.title)}</title>
<style>body{margin:0;background:#eee6d8;color:#211d18;font:14px/1.5 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:50px 20px 100px}h1{font:400 48px/1 Georgia,serif}audio{width:100%}.card{background:#f8f3ea;border:1px solid #cfc3b4;padding:22px}.meta{display:flex;gap:8px;flex-wrap:wrap}.meta span{border:1px solid #cfc3b4;border-radius:999px;padding:5px 9px;font-size:11px}.scores{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:20px}label{display:grid;gap:6px;font-size:11px}select,input,textarea{font:inherit;padding:9px;border:1px solid #cfc3b4;background:#fffaf3}textarea{min-height:100px}.row{display:grid;grid-template-columns:1fr 220px;gap:12px;margin-top:14px}button{margin-top:18px;padding:11px 16px;background:#211d18;color:white;border:0}@media(max-width:700px){.scores{grid-template-columns:1fr 1fr}.row{grid-template-columns:1fr}}</style></head><body><main>
<p>Afterlight · Studio master intake</p><h1>${escapeHtml(c.title)}</h1><div class="card"><audio controls preload="metadata" src="./candidates/${escapeHtml(c.file)}"></audio>
<div class="meta"><span>${Math.round(c.metrics.durationSeconds)} sec</span><span>${escapeHtml(c.sourceType)}</span><span>${c.metrics.sampleRate} Hz</span><span>${c.metrics.bits}-bit</span><span>${c.metrics.technicalPass?'TECH PASS':'TECH FAIL'}</span></div>
<label style="margin-top:18px">Reviewer ID<input id="reviewer" required></label><div class="scores">
${['roomFit','musicality','fatigueResistance','variation','productionPolish'].map(key=>`<label>${({roomFit:'Room fit',musicality:'Musicality',fatigueResistance:'Low fatigue',variation:'Variation',productionPolish:'Production polish'})[key]}<select data-score="${key}"><option value="">—</option>${[1,2,3,4,5].map(v=>`<option>${v}</option>`).join('')}</select></label>`).join('')}</div>
<div class="row"><label>Notes<textarea id="notes"></textarea></label><label>Decision<select id="decision"><option value="">Choose…</option><option value="reject">Reject</option><option value="rework">Rework</option><option value="shortlist">Shortlist</option></select></label></div>
<button id="export">Export review JSON</button><p id="status">A technical pass does not approve this master.</p></div></main>
<script>const manifest=${JSON.stringify(manifest)},audio=document.querySelector('audio');let listened=0,last=0;
audio.addEventListener('timeupdate',()=>{if(!audio.paused){listened+=Math.max(0,Math.min(1,audio.currentTime-last))}last=audio.currentTime});audio.addEventListener('seeked',()=>last=audio.currentTime);
document.getElementById('export').onclick=()=>{const reviewer=document.getElementById('reviewer').value.trim();if(!reviewer){status.textContent='Reviewer ID is required.';return}
const scores={};for(const el of document.querySelectorAll('[data-score]'))scores[el.dataset.score]=el.value?Number(el.value):null;
const out={schemaVersion:1,packageId:manifest.packageId,room:manifest.room,generatedAt:new Date().toISOString(),reviewer,reviews:[{candidateId:'${escapeHtml(c.id)}',candidateSha256:'${c.sha256}',listenedSeconds:Math.round(listened),scores,decision:document.getElementById('decision').value||null,notes:document.getElementById('notes').value.trim()}]};
const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=manifest.room+'-master-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);status.textContent='Review exported.'}</script></body></html>`;
}

const metadata=JSON.parse(await readFile(metadataPath,'utf8'));
const {id,knownRoom}=validateMetadata(metadata);
const audio=await readFile(audioPath),wav=parseWav(audio),measured=metrics(audio,wav);
if(!measured.technicalPass)throw new Error('Master failed technical intake: '+JSON.stringify(measured));
const sha256=createHash('sha256').update(audio).digest('hex');
const file='master.wav';
await mkdir(path.join(outRoot,'candidates'),{recursive:true});
await copyFile(audioPath,path.join(outRoot,'candidates',file));

const candidate={
  id,
  file,
  sha256,
  room:knownRoom.slug,
  roomName:knownRoom.name,
  title:String(metadata.title).trim(),
  sourceType:metadata.sourceType,
  creator:String(metadata.creator).trim(),
  sourceRevision:String(metadata.sourceRevision).trim(),
  rights:String(metadata.rightsStatus),
  licenseReference:metadata.licenseReference||null,
  commercialUseCleared:true,
  containsThirdPartySamples:metadata.containsThirdPartySamples===true,
  thirdPartyClearanceReference:metadata.thirdPartyClearanceReference||null,
  aiAssisted:metadata.aiAssisted===true,
  modelDisclosure:metadata.modelDisclosure||null,
  provenanceNotes:metadata.provenanceNotes||null,
  metrics:measured
};
const packageId=createHash('sha256').update(JSON.stringify({room:knownRoom.slug,candidate:{id,sha256,sourceRevision:candidate.sourceRevision}})).digest('hex');
const manifest={
  schemaVersion:1,
  status:'audition-only',
  packageId,
  room:knownRoom.slug,
  roomName:knownRoom.name,
  generatedAt:new Date().toISOString(),
  source:'studio-master-intake',
  policy:'music/catalog-policy.json',
  warning:'Imported master passed technical intake only. Human listening review is mandatory.',
  candidates:[candidate]
};
await writeFile(path.join(outRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(outRoot,'review.html'),reviewHtml(manifest));
await writeFile(path.join(outRoot,'review-template.json'),JSON.stringify({
  schemaVersion:1,packageId,room:knownRoom.slug,reviewer:'',generatedAt:null,
  reviews:[{candidateId:id,candidateSha256:sha256,listenedSeconds:0,scores:{roomFit:null,musicality:null,fatigueResistance:null,variation:null,productionPolish:null},decision:null,notes:''}]
},null,2)+'\n');
console.log(JSON.stringify({status:'audition-only',packageId,room:knownRoom.slug,candidateId:id,sha256,metrics:measured,out:outRoot},null,2));

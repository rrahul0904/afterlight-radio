import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { musicRooms, renderMusicCandidate } from './audio-library.mjs';

const args=process.argv.slice(2);
const arg=(name,fallback)=>{
  const i=args.indexOf('--'+name);
  return i>=0&&args[i+1]!==undefined?args[i+1]:fallback;
};
const roomArg=String(arg('room','rooftop')).trim();
const count=Math.max(2,Math.min(8,Number(arg('count','4'))||4));
const bars=Math.max(24,Math.min(96,Number(arg('bars','48'))||48));
const outRoot=path.resolve(arg('out',path.join('.music-lab',roomArg)));
const rooms=roomArg==='all'?musicRooms:[musicRooms.find(room=>room.slug===roomArg)].filter(Boolean);
if(!rooms.length)throw new Error('Unknown room. Valid rooms: '+musicRooms.map(room=>room.slug).join(', '));

function wavMetrics(bytes){
  const b=Buffer.from(bytes);
  if(b.subarray(0,4).toString()!=='RIFF'||b.subarray(8,12).toString()!=='WAVE')throw new Error('Candidate is not WAV');
  const channels=b.readUInt16LE(22),sampleRate=b.readUInt32LE(24),bits=b.readUInt16LE(34),dataBytes=b.readUInt32LE(40);
  const frameBytes=channels*(bits/8),frames=dataBytes/frameBytes,duration=frames/sampleRate;
  let sum=0,diff=0,mono=0,peak=0,dcL=0,dcR=0,count=0,clipped=0;
  const stride=37;
  for(let frame=0;frame<frames;frame+=stride){
    const p=44+frame*frameBytes;if(p+3>=b.length)break;
    const l=b.readInt16LE(p)/32768,r=b.readInt16LE(p+2)/32768;
    sum+=(l*l+r*r)/2;diff+=(l-r)*(l-r);mono+=((l+r)*.5)**2;
    peak=Math.max(peak,Math.abs(l),Math.abs(r));dcL+=l;dcR+=r;
    if(Math.abs(l)>.999||Math.abs(r)>.999)clipped++;count++;
  }
  const rms=Math.sqrt(sum/count),stereoRatio=Math.sqrt(diff/count)/(Math.sqrt(mono/count)+.0001),dc=Math.max(Math.abs(dcL/count),Math.abs(dcR/count));
  return {
    channels,sampleRate,bits,
    durationSeconds:Number(duration.toFixed(2)),
    rms:Number(rms.toFixed(5)),
    peak:Number(peak.toFixed(5)),
    crest:Number((peak/(rms||.00001)).toFixed(3)),
    stereoRatio:Number(stereoRatio.toFixed(3)),
    dc:Number(dc.toFixed(6)),
    clippedSamples:clipped,
    technicalPass:channels===2&&sampleRate===32000&&bits===16&&duration>=75&&rms>=.012&&rms<=.42&&peak>=.12&&peak<.9999&&stereoRatio>=.04&&dc<=.06&&clipped===0
  };
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function reviewHtml(manifest){
  const cards=manifest.candidates.map((c,index)=>`
  <article class="candidate" data-id="${escapeHtml(c.id)}">
    <header><div><span class="blind">Candidate ${String.fromCharCode(65+index)}</span><h2>${escapeHtml(manifest.roomName)}</h2></div><span class="tech ${c.metrics.technicalPass?'pass':'fail'}">${c.metrics.technicalPass?'TECH PASS':'TECH FAIL'}</span></header>
    <audio controls preload="metadata" src="./candidates/${escapeHtml(c.file)}"></audio>
    <div class="meta"><span>${Math.round(c.metrics.durationSeconds)} sec</span><span>${escapeHtml(c.style)}</span><span>${escapeHtml(c.key)}</span><span>${c.bpm} BPM</span></div>
    <div class="scores">
      ${['roomFit','musicality','fatigueResistance','variation','productionPolish'].map(key=>`
      <label>${({roomFit:'Room fit',musicality:'Musicality',fatigueResistance:'Low fatigue',variation:'Variation',productionPolish:'Production polish'})[key]}
        <select data-score="${key}"><option value="">—</option>${[1,2,3,4,5].map(v=>`<option value="${v}">${v}</option>`).join('')}</select>
      </label>`).join('')}
    </div>
    <label class="decision">Decision
      <select data-decision><option value="">Choose…</option><option value="reject">Reject</option><option value="rework">Rework</option><option value="shortlist">Shortlist</option></select>
    </label>
    <label class="notes">Notes<textarea data-notes placeholder="What becomes repetitive? Any harsh frequency? Does it fit the room? Would you keep listening for 30 minutes?"></textarea></label>
    <details><summary>Technical / provenance details</summary><pre>${escapeHtml(JSON.stringify({seed:c.seed,trackRole:c.trackRole,bars:c.bars,metrics:c.metrics,sha256:c.sha256,generator:c.generator},null,2))}</pre></details>
  </article>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Afterlight Music Lab · ${escapeHtml(manifest.roomName)}</title>
<style>
:root{--paper:#eee6d8;--card:#f8f3ea;--ink:#211d18;--muted:#6b6257;--line:#cfc3b4;--good:#315f45;--bad:#873f3f}*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.5 Inter,system-ui,sans-serif}main{width:min(1100px,calc(100% - 28px));margin:0 auto;padding:52px 0 100px}
.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:var(--muted)}h1{font:400 clamp(44px,7vw,78px)/.95 Georgia,serif;letter-spacing:-.045em;margin:10px 0 14px}.intro{max-width:760px;color:var(--muted)}
.rules{margin:28px 0;padding:18px;border:1px solid var(--line);background:rgba(255,255,255,.25)}.rules strong{font-weight:650}
.grid{display:grid;gap:18px}.candidate{border:1px solid var(--line);background:var(--card);padding:22px}.candidate header{display:flex;justify-content:space-between;gap:20px}.blind{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted)}h2{font:400 28px/1 Georgia,serif;margin:6px 0 16px}audio{width:100%}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 18px}.meta span{border:1px solid var(--line);border-radius:999px;padding:5px 9px;font-size:10px}
.tech{font-size:9px;letter-spacing:.1em;border:1px solid currentColor;padding:6px 8px;height:max-content}.pass{color:var(--good)}.fail{color:var(--bad)}
.scores{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.scores label,.decision,.notes{display:grid;gap:6px;font-size:11px;color:var(--muted)}
select,textarea,input{font:inherit;color:var(--ink);background:#fffaf3;border:1px solid var(--line);padding:9px}.reviewer{display:grid;gap:6px;max-width:360px;margin:20px 0;font-size:11px;color:var(--muted)}.decision{margin-top:12px;max-width:220px}.notes{margin-top:12px}textarea{min-height:90px;resize:vertical}
details{margin-top:16px;color:var(--muted);font-size:11px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eee5d8;padding:12px}
.actions{position:sticky;bottom:0;margin-top:26px;padding:14px;background:rgba(238,230,216,.95);border:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:12px;backdrop-filter:blur(12px)}
button{border:1px solid var(--ink);background:var(--ink);color:#fff;padding:11px 16px;cursor:pointer}#status{color:var(--muted);font-size:11px}
@media(max-width:760px){.scores{grid-template-columns:1fr 1fr}.candidate{padding:16px}}
</style></head><body><main>
<div class="eyebrow">Afterlight · Music Lab</div><h1>${escapeHtml(manifest.roomName)}</h1>
<p class="intro">Blind listening review for long-form candidates. Technical validity is necessary but not sufficient. A candidate should only move toward production if it feels musically intentional, fits the room, avoids fatigue, and remains interesting beyond the first thirty seconds.</p>
<label class="reviewer">Reviewer ID<input id="reviewer" autocomplete="name" placeholder="Name or stable reviewer ID" required></label>
<div class="rules"><strong>Listening protocol:</strong> use headphones and speakers if possible. Hear the opening, at least one middle section, and the final minute. For a public-launch shortlist, score Room fit, Musicality, Low fatigue and Production polish at least 4/5. Do not shortlist a technical failure.</div>
<div class="grid">${cards}</div>
<div class="actions"><span id="status">Nothing is production-approved automatically.</span><button id="export">Export review JSON</button></div>
</main><script>
const manifest=${JSON.stringify(manifest)};
const listened={};
for(const card of document.querySelectorAll('.candidate')){
  const id=card.dataset.id,audio=card.querySelector('audio');listened[id]=0;
  let last=0;
  audio.addEventListener('timeupdate',()=>{if(!audio.paused){const delta=Math.max(0,Math.min(1,audio.currentTime-last));listened[id]+=delta}last=audio.currentTime});
  audio.addEventListener('seeked',()=>{last=audio.currentTime});
}
document.getElementById('export').onclick=()=>{
  const reviewer=document.getElementById('reviewer').value.trim();
  if(!reviewer){document.getElementById('status').textContent='Add a reviewer ID before exporting.';return;}
  const reviews=[...document.querySelectorAll('.candidate')].map(card=>{
    const scores={};for(const el of card.querySelectorAll('[data-score]'))scores[el.dataset.score]=el.value?Number(el.value):null;
    return {candidateId:card.dataset.id,listenedSeconds:Math.round(listened[card.dataset.id]),scores,decision:card.querySelector('[data-decision]').value||null,notes:card.querySelector('[data-notes]').value.trim()};
  });
  const output={schemaVersion:1,room:manifest.room,generatedAt:new Date().toISOString(),reviewer,reviews};
  const blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=manifest.room+'-music-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
  document.getElementById('status').textContent='Review exported. Keep the JSON with the candidate artifact.';
};
</script></body></html>`;
}

await rm(outRoot,{recursive:true,force:true});
await mkdir(outRoot,{recursive:true});

const summary=[];
for(const room of rooms){
  const roomRoot=roomArg==='all'?path.join(outRoot,room.slug):outRoot;
  await mkdir(path.join(roomRoot,'candidates'),{recursive:true});
  const candidates=[];
  for(let i=0;i<count;i++){
    const label=String.fromCharCode(65+i),seed=room.slug+'-'+label+'-'+String(i+1).padStart(2,'0'),trackRole=(i%3)+1;
    const rendered=renderMusicCandidate({roomSlug:room.slug,seed,trackRole,bars});
    const metrics=wavMetrics(rendered.bytes),file=label.toLowerCase()+'.wav',sha256=createHash('sha256').update(rendered.bytes).digest('hex');
    await writeFile(path.join(roomRoot,'candidates',file),rendered.bytes);
    candidates.push({id:room.slug+'-'+label,file,sha256,...rendered.metadata,metrics});
  }
  const manifest={
    schemaVersion:1,
    status:'audition-only',
    room:room.slug,
    roomName:room.name,
    generatedAt:new Date().toISOString(),
    policy:'music/catalog-policy.json',
    warning:'Candidates are not production-approved. Human listening review is mandatory.',
    candidates
  };
  await writeFile(path.join(roomRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  await writeFile(path.join(roomRoot,'review.html'),reviewHtml(manifest));
  await writeFile(path.join(roomRoot,'review-template.json'),JSON.stringify({
    schemaVersion:1,room:room.slug,reviewer:'',generatedAt:null,
    reviews:candidates.map(c=>({candidateId:c.id,listenedSeconds:0,scores:{roomFit:null,musicality:null,fatigueResistance:null,variation:null,productionPolish:null},decision:null,notes:''}))
  },null,2)+'\n');
  summary.push({room:room.slug,candidates:candidates.length,minDuration:Math.min(...candidates.map(c=>c.metrics.durationSeconds)),maxDuration:Math.max(...candidates.map(c=>c.metrics.durationSeconds)),technicalPass:candidates.filter(c=>c.metrics.technicalPass).length,out:roomRoot});
}
await writeFile(path.join(outRoot,'lab-summary.json'),JSON.stringify({schemaVersion:1,bars,count,rooms:summary},null,2)+'\n');
console.log('Music Lab ready:',JSON.stringify(summary));

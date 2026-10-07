(()=>{
  'use strict';
  const CONTRACT_VERSION='spoken-library/v1';
  const STORAGE_KEY='afterlight:spoken:v1';
  const MAX_QUEUE=100;
  const runtimeFiles=new Map();
  let activeItemId=null;
  let lastObservedMediaTime=null;
  let lastPersistAt=0;

  const $=id=>document.getElementById(id);
  const audio=$('spokenAudio');
  const emptyState=()=>({version:1,contract:CONTRACT_VERSION,items:[],queue:[],currentItemId:null,playbackRate:1,sleepEndsAt:null,rewindSeconds:30,rewindAfterSleep:true,shouldRewindAfterSleep:false});

  function loadState(){
    let value;
    try{value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{}
    if(!value||value.version!==1||!Array.isArray(value.items))value=emptyState();
    value.queue=Array.isArray(value.queue)?value.queue.filter(id=>typeof id==='string').slice(0,MAX_QUEUE):[];
    value.playbackRate=Number.isFinite(value.playbackRate)?Math.min(3,Math.max(.5,value.playbackRate)):1;
    value.rewindSeconds=Number.isFinite(value.rewindSeconds)?Math.min(120,Math.max(0,value.rewindSeconds)):30;
    value.rewindAfterSleep=value.rewindAfterSleep!==false;
    value.shouldRewindAfterSleep=!!value.shouldRewindAfterSleep;
    value.items=value.items.map(item=>({...item,status:'needs_relink',progress:Number.isFinite(item.progress)?Math.max(0,item.progress):0,duration:Number.isFinite(item.duration)?Math.max(0,item.duration):0,listenedSeconds:Number.isFinite(item.listenedSeconds)?Math.max(0,item.listenedSeconds):0,transcript:item.transcript&&Array.isArray(item.transcript.segments)?item.transcript:null}));
    return value;
  }
  let state=loadState();

  function persist(force=false){
    const now=Date.now();
    if(!force&&now-lastPersistAt<2500)return;
    lastPersistAt=now;
    const safe={...state,items:state.items.map(item=>({...item,status:'needs_relink'}))};
    localStorage.setItem(STORAGE_KEY,JSON.stringify(safe));
  }
  function formatClock(seconds){
    const n=Math.max(0,Number(seconds)||0),h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=Math.floor(n%60);
    return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
  }
  function formatListened(seconds){
    const mins=Math.floor((Number(seconds)||0)/60);
    if(mins<60)return `${mins} min`;
    return `${Math.floor(mins/60)}h ${mins%60}m`;
  }
  async function metadataFingerprint(file){
    const canonical=[file.name,file.size,file.lastModified,file.type||'unknown'].join('|');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  const makeId=fingerprint=>`spoken_${fingerprint.slice(0,20)}`;
  function revokeItemUrl(id){const url=runtimeFiles.get(id);if(url){URL.revokeObjectURL(url);runtimeFiles.delete(id)}}
  function bindFile(item,file){
    revokeItemUrl(item.id);
    const url=URL.createObjectURL(file);
    runtimeFiles.set(item.id,url);
    Object.assign(item,{status:'ready',filename:file.name,size:file.size,lastModified:file.lastModified});
    return url;
  }
  const currentItem=()=>state.items.find(item=>item.id===state.currentItemId)||null;

  async function importAudio(file){
    if(!file)throw new Error('Choose an audio file first.');
    if(!(file.type||'').startsWith('audio/')&&!/\.(mp3|m4b|m4a|aac|flac|ogg|opus|wav)$/i.test(file.name))throw new Error('That file does not look like supported audio.');
    const fingerprint=await metadataFingerprint(file);
    let item=state.items.find(candidate=>candidate.metadataFingerprint===fingerprint);
    if(!item){
      item={id:makeId(fingerprint),schema:CONTRACT_VERSION,type:'audiobook',title:file.name.replace(/\.[^.]+$/,''),creator:'',filename:file.name,size:file.size,lastModified:file.lastModified,metadataFingerprint:fingerprint,duration:0,progress:0,listenedSeconds:0,status:'ready',addedAt:Date.now(),transcript:null};
      state.items.unshift(item);
    }
    bindFile(item,file);
    state.currentItemId=item.id;
    persist(true);
    selectItem(item.id,{autoplay:false});
    render();
    return item;
  }
  function selectItem(id,{autoplay=false}={}){
    const item=state.items.find(candidate=>candidate.id===id);
    if(!item)return;
    state.currentItemId=id;activeItemId=id;lastObservedMediaTime=null;
    const url=runtimeFiles.get(id);
    if(!url){item.status='needs_relink';audio.removeAttribute('src');audio.load();persist(true);render();return}
    const wasPaused=audio.paused;
    audio.src=url;audio.playbackRate=state.playbackRate;
    audio.addEventListener('loadedmetadata',()=>{
      item.duration=Number.isFinite(audio.duration)?audio.duration:item.duration;
      const max=Math.max(0,(audio.duration||0)-1);
      if(item.progress>1&&item.progress<max)audio.currentTime=Math.min(item.progress,max);
      persist(true);render();if(autoplay||!wasPaused)audio.play().catch(()=>{});
    },{once:true});
    render();
  }
  async function relinkItem(item,file){
    const fingerprint=await metadataFingerprint(file);
    if(fingerprint!==item.metadataFingerprint)throw new Error('This file does not match the saved item fingerprint.');
    bindFile(item,file);persist(true);selectItem(item.id,{autoplay:false});render();
  }
  function updateMetadata(id,patch){
    const item=state.items.find(candidate=>candidate.id===id);if(!item)return;
    if(typeof patch.title==='string')item.title=patch.title.trim().slice(0,180)||item.title;
    if(typeof patch.creator==='string')item.creator=patch.creator.trim().slice(0,180);
    if(['audiobook','podcast_episode'].includes(patch.type))item.type=patch.type;
    persist(true);render();
  }
  function removeItem(id){
    revokeItemUrl(id);state.items=state.items.filter(item=>item.id!==id);state.queue=state.queue.filter(itemId=>itemId!==id);
    if(state.currentItemId===id){state.currentItemId=null;activeItemId=null;audio.pause();audio.removeAttribute('src');audio.load()}
    persist(true);render();
  }
  function addToQueue(id,{front=false}={}){
    if(!state.items.some(item=>item.id===id))return;
    state.queue=state.queue.filter(itemId=>itemId!==id);if(front)state.queue.unshift(id);else state.queue.push(id);state.queue=state.queue.slice(0,MAX_QUEUE);persist(true);renderQueue();
  }
  function removeFromQueue(index){if(index<0||index>=state.queue.length)return;state.queue.splice(index,1);persist(true);renderQueue()}
  function moveQueue(index,delta){
    const target=index+delta;if(index<0||target<0||index>=state.queue.length||target>=state.queue.length)return;
    [state.queue[index],state.queue[target]]=[state.queue[target],state.queue[index]];persist(true);renderQueue();
  }
  async function playNext(){
    while(state.queue.length){
      const id=state.queue.shift(),item=state.items.find(candidate=>candidate.id===id);if(!item)continue;
      state.currentItemId=id;persist(true);selectItem(id,{autoplay:true});
      if(!runtimeFiles.has(id))status(`“${item.title}” needs its local file relinked before it can play.`);return;
    }
    status('Up Next is empty.');
  }

  function parseTimestamp(raw){
    const parts=String(raw||'').trim().replace(',', '.').split(':').map(Number);
    if(parts.some(n=>!Number.isFinite(n))||parts.length<2||parts.length>3)return NaN;
    return parts.length===3?parts[0]*3600+parts[1]*60+parts[2]:parts[0]*60+parts[1];
  }
  function validateTimedSegments(segments){
    let previousEnd=-1;
    return segments.map((segment,index)=>{
      const start=Number(segment.start),end=Number(segment.end);
      if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)throw new Error(`Transcript cue ${index+1} has an invalid time range.`);
      if(start<previousEnd)throw new Error(`Transcript cue ${index+1} overlaps the previous cue.`);
      previousEnd=end;
      const text=String(segment.text||'').trim();if(!text)throw new Error(`Transcript cue ${index+1} is empty.`);
      return {start,end,text};
    });
  }
  function parseCueBlocks(text,kind){
    const normalized=String(text||'').replace(/\r/g,'').trim(),blocks=normalized.split(/\n{2,}/).map(block=>block.trim()).filter(Boolean),segments=[];
    for(const block of blocks){
      const lines=block.split('\n').map(line=>line.trimEnd());if(kind==='vtt'&&lines[0]==='WEBVTT')continue;
      const timingIndex=lines.findIndex(line=>line.includes('-->'));if(timingIndex<0)continue;
      const [rawStart,rawEndWithSettings]=lines[timingIndex].split('-->').map(value=>value.trim());
      const start=parseTimestamp(rawStart),end=parseTimestamp(rawEndWithSettings.split(/\s+/)[0]);
      const cueText=lines.slice(timingIndex+1).join(' ').replace(/<[^>]*>/g,'').trim();segments.push({start,end,text:cueText});
    }
    if(!segments.length)throw new Error(`No timed cues found in ${kind.toUpperCase()} transcript.`);
    return validateTimedSegments(segments);
  }
  const parseWebVtt=text=>parseCueBlocks(text,'vtt');
  const parseSrt=text=>parseCueBlocks(text,'srt');
  function parsePlainText(text){
    const segments=String(text||'').replace(/\r/g,'').split('\n').map(line=>line.trim()).filter(Boolean).map(text=>({start:null,end:null,text}));
    if(!segments.length)throw new Error('Transcript is empty.');return segments;
  }
  function parseTranscript(fileName,text){
    const lower=String(fileName||'').toLowerCase();
    if(lower.endsWith('.vtt')||String(text).trimStart().startsWith('WEBVTT'))return {format:'webvtt',timed:true,segments:parseWebVtt(text)};
    if(lower.endsWith('.srt')||/^\s*\d+\s*\n\s*\d{1,2}:\d{2}/m.test(String(text)))return {format:'srt',timed:true,segments:parseSrt(text)};
    return {format:'plain',timed:false,segments:parsePlainText(text)};
  }
  async function importTranscript(item,file){
    if(!item)throw new Error('Choose a library item first.');if(!file)throw new Error('Choose a transcript file.');if(file.size>5_000_000)throw new Error('Transcript is too large for the local Phase A importer.');
    const text=await file.text(),parsed=parseTranscript(file.name,text);
    item.transcript={sourceName:file.name,importedAt:Date.now(),format:parsed.format,timed:parsed.timed,syncConfidence:parsed.timed?'source-timed':'untimed',segments:parsed.segments};persist(true);renderTranscript();
  }
  function activeTranscriptIndex(item,time){
    const segments=item?.transcript?.segments;if(!item?.transcript?.timed||!Array.isArray(segments))return -1;
    let lo=0,hi=segments.length-1;while(lo<=hi){const mid=(lo+hi)>>1,segment=segments[mid];if(time<segment.start)hi=mid-1;else if(time>=segment.end)lo=mid+1;else return mid}return -1;
  }

  function renderTranscript(){
    const host=$('transcriptList'),item=currentItem();host.replaceChildren();
    if(!item?.transcript){const empty=document.createElement('p');empty.className='empty';empty.textContent='Import WebVTT, SRT, or plain text. Timed cues become seekable.';host.appendChild(empty);$('transcriptMeta').textContent='No transcript';return}
    const t=item.transcript;$('transcriptMeta').textContent=`${t.format.toUpperCase()} · ${t.timed?'timed':'untimed'} · ${t.syncConfidence}`;
    t.segments.forEach((segment,index)=>{
      const button=document.createElement('button');button.type='button';button.className='transcript-line';button.dataset.segment=String(index);button.disabled=!t.timed;
      const time=document.createElement('span');time.className='cue-time';time.textContent=t.timed?formatClock(segment.start):'—';const copy=document.createElement('span');copy.textContent=segment.text;button.append(time,copy);
      if(t.timed)button.addEventListener('click',()=>{if(!runtimeFiles.has(item.id))return status('Relink the local audio file before seeking.');audio.currentTime=segment.start;audio.play().catch(()=>{})});host.appendChild(button);
    });updateTranscriptHighlight();
  }
  function updateTranscriptHighlight(){
    const item=currentItem(),index=activeTranscriptIndex(item,audio.currentTime||0);
    document.querySelectorAll('.transcript-line').forEach((node,i)=>{const active=i===index;node.classList.toggle('active',active);if(active&&document.visibilityState==='visible')node.scrollIntoView({block:'nearest',behavior:'smooth'})});
  }
  function renderShelf(){
    const host=$('shelfList');host.replaceChildren();$('shelfCount').textContent=`${state.items.length} item${state.items.length===1?'':'s'}`;
    if(!state.items.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='Your shelf is empty. Add a local audiobook or podcast episode.';host.appendChild(empty);return}
    for(const item of state.items){
      const card=document.createElement('article');card.className='shelf-item'+(item.id===state.currentItemId?' selected':'');
      const top=document.createElement('button');top.type='button';top.className='shelf-main';top.addEventListener('click',()=>selectItem(item.id));
      const badge=document.createElement('span');badge.className='type-badge';badge.textContent=item.type==='podcast_episode'?'Podcast':'Book';
      const title=document.createElement('strong');title.textContent=item.title;const creator=document.createElement('small');creator.textContent=item.creator||item.filename||'Local audio';const progress=document.createElement('small');progress.textContent=item.status==='ready'?`${formatClock(item.progress)} listened · ready`:`${formatClock(item.progress)} listened · relink needed`;top.append(badge,title,creator,progress);
      const actions=document.createElement('div');actions.className='shelf-actions';
      const next=document.createElement('button');next.type='button';next.textContent='Up Next';next.addEventListener('click',()=>addToQueue(item.id));
      const relink=document.createElement('label');relink.className='mini-file';relink.textContent='Relink';const input=document.createElement('input');input.type='file';input.accept='audio/*,.mp3,.m4b,.m4a,.aac,.flac,.ogg,.opus,.wav';input.addEventListener('change',async()=>{try{await relinkItem(item,input.files?.[0])}catch(error){status(error.message,true)}input.value=''});relink.appendChild(input);
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.addEventListener('click',()=>removeItem(item.id));actions.append(next,relink,remove);card.append(top,actions);host.appendChild(card);
    }
  }
  function renderQueue(){
    const host=$('queueList');host.replaceChildren();$('queueCount').textContent=`${state.queue.length} queued`;
    if(!state.queue.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='Nothing queued.';host.appendChild(empty);return}
    state.queue.forEach((id,index)=>{
      const item=state.items.find(candidate=>candidate.id===id);if(!item)return;const row=document.createElement('div');row.className='queue-row';const copy=document.createElement('div');const title=document.createElement('strong');title.textContent=item.title;const meta=document.createElement('small');meta.textContent=item.status==='ready'?'Ready':'Needs relink';copy.append(title,meta);const controls=document.createElement('div');
      for(const [label,handler] of [['↑',()=>moveQueue(index,-1)],['↓',()=>moveQueue(index,1)],['Play',()=>{state.queue.splice(index,1);persist(true);selectItem(id,{autoplay:true});renderQueue()}],['×',()=>removeFromQueue(index)]]){const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.addEventListener('click',handler);controls.appendChild(btn)}
      row.append(copy,controls);host.appendChild(row);
    });
  }
  function renderCurrent(){
    const item=currentItem(),has=!!item;$('currentTitle').textContent=item?.title||'Nothing selected';$('currentCreator').textContent=item?.creator||'Add local audio to begin.';$('relinkState').textContent=item?(item.status==='ready'?'Local file linked':'Local file needs relinking'):'No item';$('titleInput').value=item?.title||'';$('creatorInput').value=item?.creator||'';$('typeInput').value=item?.type||'audiobook';$('titleInput').disabled=!has;$('creatorInput').disabled=!has;$('typeInput').disabled=!has;$('transcriptInput').disabled=!has;$('addCurrentToQueue').disabled=!has;if(item&&runtimeFiles.has(item.id)&&activeItemId!==item.id)selectItem(item.id);$('rateInput').value=String(state.playbackRate);$('rewindAfterSleep').checked=state.rewindAfterSleep;
  }
  function renderStats(){const total=state.items.reduce((sum,item)=>sum+(item.listenedSeconds||0),0),completed=state.items.filter(item=>item.duration>0&&item.progress>=item.duration-5).length;$('statListened').textContent=formatListened(total);$('statItems').textContent=String(state.items.length);$('statCompleted').textContent=String(completed)}
  function renderSleep(){const label=$('sleepStatus');label.textContent=state.sleepEndsAt&&state.sleepEndsAt>Date.now()?`Sleep in ${Math.max(1,Math.ceil((state.sleepEndsAt-Date.now())/60000))} min`:'Sleep timer off'}
  function render(){renderShelf();renderCurrent();renderQueue();renderTranscript();renderStats();renderSleep()}
  function status(message,isError=false){const node=$('statusMessage');node.textContent=message||'';node.classList.toggle('error',!!isError)}
  function persistProgress(force=false){const item=currentItem();if(!item||activeItemId!==item.id)return;if(Number.isFinite(audio.currentTime))item.progress=Math.max(0,audio.currentTime);if(Number.isFinite(audio.duration))item.duration=Math.max(0,audio.duration);persist(force)}
  function observeListening(){
    const item=currentItem(),now=audio.currentTime;if(!item||audio.paused||!Number.isFinite(now)){lastObservedMediaTime=now;return}
    if(Number.isFinite(lastObservedMediaTime)){const delta=now-lastObservedMediaTime,maxDelta=Math.max(3,5*audio.playbackRate);if(delta>0&&delta<=maxDelta)item.listenedSeconds=(item.listenedSeconds||0)+delta}lastObservedMediaTime=now;
  }
  function setSleep(minutes){const n=Number(minutes);state.sleepEndsAt=Number.isFinite(n)&&n>0?Date.now()+n*60000:null;state.shouldRewindAfterSleep=false;persist(true);renderSleep()}
  function checkSleep(){if(state.sleepEndsAt&&Date.now()>=state.sleepEndsAt){state.sleepEndsAt=null;state.shouldRewindAfterSleep=true;audio.pause();persist(true);renderSleep();status('Sleep timer paused playback.')}else renderSleep()}

  function installEvents(){
    $('audioInput').addEventListener('change',async event=>{const file=event.target.files?.[0];try{await importAudio(file);status('Added locally. Nothing was uploaded.')}catch(error){status(error.message,true)}event.target.value=''});
    $('transcriptInput').addEventListener('change',async event=>{const file=event.target.files?.[0];try{await importTranscript(currentItem(),file);status('Transcript imported locally.')}catch(error){status(error.message,true)}event.target.value=''});
    $('titleInput').addEventListener('change',event=>updateMetadata(state.currentItemId,{title:event.target.value}));$('creatorInput').addEventListener('change',event=>updateMetadata(state.currentItemId,{creator:event.target.value}));$('typeInput').addEventListener('change',event=>updateMetadata(state.currentItemId,{type:event.target.value}));$('addCurrentToQueue').addEventListener('click',()=>state.currentItemId&&addToQueue(state.currentItemId));$('playNext').addEventListener('click',()=>playNext());
    $('rateInput').addEventListener('change',event=>{const rate=Math.min(3,Math.max(.5,Number(event.target.value)||1));state.playbackRate=rate;audio.playbackRate=rate;persist(true);status(`Playback speed ${rate}×`)});$('sleepInput').addEventListener('change',event=>setSleep(event.target.value));$('rewindAfterSleep').addEventListener('change',event=>{state.rewindAfterSleep=event.target.checked;persist(true)});
    audio.addEventListener('loadedmetadata',()=>{audio.playbackRate=state.playbackRate;render()});
    audio.addEventListener('timeupdate',()=>{observeListening();persistProgress(false);updateTranscriptHighlight();renderStats()});audio.addEventListener('seeking',()=>{lastObservedMediaTime=null});
    audio.addEventListener('play',()=>{const item=currentItem();if(state.shouldRewindAfterSleep&&state.rewindAfterSleep&&item)audio.currentTime=Math.max(0,audio.currentTime-state.rewindSeconds);state.shouldRewindAfterSleep=false;lastObservedMediaTime=audio.currentTime;persist(true)});
    audio.addEventListener('pause',()=>{persistProgress(true);lastObservedMediaTime=null});audio.addEventListener('ended',()=>{persistProgress(true);playNext()});window.addEventListener('pagehide',()=>persistProgress(true));setInterval(checkSleep,1000);
  }

  window.__afterlightSpoken={version:1,contract:CONTRACT_VERSION,storageKey:STORAGE_KEY,metadataFingerprint,parseWebVtt,parseSrt,parsePlainText,parseTranscript,validateTimedSegments,getState:()=>JSON.parse(JSON.stringify(state))};
  installEvents();render();checkSleep();
})();
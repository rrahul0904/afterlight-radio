export const BROADCAST_ITEM_STATES=Object.freeze(['planned','ready','handed','airing','played','skipped','removed']);

const TERMINAL=new Set(['played','skipped','removed']);
const TRANSITIONS=Object.freeze({
  planned:new Set(['ready','skipped','removed']),
  ready:new Set(['handed','skipped','removed']),
  handed:new Set(['airing','skipped']),
  airing:new Set(['played']),
  played:new Set(),
  skipped:new Set(),
  removed:new Set()
});

function stableHash(input){
  let h=2166136261>>>0;
  for(const ch of String(input)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
}
function boundedInt(value,fallback,min,max){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):fallback;
}
function normalizeTrack(track){
  const id=String(track?.id||'').trim();
  const room=String(track?.room||'').trim();
  const title=String(track?.title||'').trim();
  if(!id||!room||!title)return null;
  return Object.freeze({
    id,
    room,
    roomName:String(track?.roomName||room).trim(),
    title,
    track:Number(track?.track)||null,
    durationSeconds:Number(track?.durationSeconds)||0,
    style:String(track?.style||'').trim(),
    generator:String(track?.generator||'').trim()
  });
}

export function planFirstPartyTracks(catalog,options={}){
  const tracks=(Array.isArray(catalog)?catalog:[]).map(normalizeTrack).filter(Boolean);
  if(!tracks.length)throw new Error('First-party catalog is empty');
  const room=String(options.room||'').trim();
  const pool=room?tracks.filter(track=>track.room===room):tracks;
  if(!pool.length)throw new Error('No first-party tracks match the requested room');
  const count=boundedInt(options.count,12,1,250);
  const repetitionWindow=boundedInt(options.repetitionWindow,Math.min(6,Math.max(0,pool.length-1)),0,Math.max(0,pool.length-1));
  const seed=String(options.seed||'afterlight-broadcast-v1');
  const chosen=[];
  const cycleUsed=new Set();
  for(let ordinal=0;ordinal<count;ordinal++){
    if(cycleUsed.size>=pool.length)cycleUsed.clear();
    const recent=new Set(chosen.slice(-repetitionWindow).map(item=>item.sourceId));
    let available=pool.filter(track=>!recent.has(track.id)&&!cycleUsed.has(track.id));
    if(!available.length)available=pool.filter(track=>!recent.has(track.id));
    const candidates=available
      .map(track=>({track,score:stableHash(seed+':'+ordinal+':'+track.id)}))
      .sort((a,b)=>a.score-b.score||a.track.id.localeCompare(b.track.id));
    const picked=(candidates[0]||{track:pool[stableHash(seed+':fallback:'+ordinal)%pool.length]}).track;
    cycleUsed.add(picked.id);
    chosen.push(Object.freeze({
      ordinal,
      kind:'track',
      sourceId:picked.id,
      room:picked.room,
      title:picked.title,
      durationSeconds:picked.durationSeconds,
      state:'planned',
      selectionReason:Object.freeze({
        policy:'deterministic-first-party-v1',
        seed,
        room:room||null,
        repetitionWindow,
        score:stableHash(seed+':'+ordinal+':'+picked.id)
      })
    }));
  }
  return Object.freeze(chosen);
}

export function transitionBroadcastItem(item,nextState,context={}){
  if(context.writer!=='director')throw new Error('Only the director may mutate broadcast item state');
  const current=String(item?.state||'');
  const next=String(nextState||'');
  if(!BROADCAST_ITEM_STATES.includes(current)||!BROADCAST_ITEM_STATES.includes(next))throw new Error('Unknown broadcast item state');
  if(TERMINAL.has(current)||!TRANSITIONS[current].has(next))throw new Error('Invalid broadcast item transition: '+current+' -> '+next);
  const now=String(context.now||new Date().toISOString());
  const patch={state:next,updatedAt:now};
  if(next==='airing')patch.startedAt=now;
  if(next==='played'||next==='skipped')patch.endedAt=now;
  return Object.freeze({...item,...patch});
}

export function isTerminalBroadcastItem(item){return TERMINAL.has(String(item?.state||''))}

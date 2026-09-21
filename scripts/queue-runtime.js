(()=>{
  const KEY='afterlight-radio:queue:v1';
  const HISTORY_LIMIT=40;
  const VALID_REPEAT=new Set(['off','one','all']);
  let dialog=null;
  let lastRecordedSource='';

  function readState(){
    let value={};
    try{value=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
    const history=Array.isArray(value.history)?value.history.filter(x=>x&&typeof x.source==='string'&&x.source.startsWith('/audio/')&&typeof x.room==='string'&&/^[a-z0-9-]+$/.test(x.room)&&Number.isInteger(x.track)&&x.track>=0&&x.track<3).slice(0,HISTORY_LIMIT):[];
    const shuffleOrders=value.shuffleOrders&&typeof value.shuffleOrders==='object'?value.shuffleOrders:{};
    return {
      shuffle:!!value.shuffle,
      repeat:VALID_REPEAT.has(value.repeat)?value.repeat:'all',
      shuffleOrders,
      history
    };
  }

  let state=readState();

  function saveState(){
    state.history=state.history.slice(0,HISTORY_LIMIT);
    localStorage.setItem(KEY,JSON.stringify(state));
  }

  function room(){
    try{return R[i]||null}catch{return null}
  }

  function roomSlug(){
    return room()?.slug||location.pathname.split('/').filter(Boolean).at(-1)||'rooftop';
  }

  function hash(text){
    let h=2166136261>>>0;
    for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
    return h>>>0;
  }

  function deterministicShuffle(slug){
    const values=[0,1,2];
    let seed=hash('afterlight:'+slug);
    for(let n=values.length-1;n>0;n--){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const j=seed%(n+1);
      [values[n],values[j]]=[values[j],values[n]];
    }
    return values;
  }

  function validOrder(order){
    return Array.isArray(order)&&order.length===3&&new Set(order).size===3&&order.every(x=>Number.isInteger(x)&&x>=0&&x<3);
  }

  function orderFor(slug=roomSlug()){
    if(!state.shuffle)return [0,1,2];
    const saved=state.shuffleOrders[slug];
    if(validOrder(saved))return [...saved];
    const created=deterministicShuffle(slug);
    state.shuffleOrders[slug]=created;
    saveState();
    return [...created];
  }

  function queueSnapshot(){
    const currentRoom=room();
    if(!currentRoom)return [];
    return orderFor(currentRoom.slug).map((trackIndex,position)=>({
      position,
      track:trackIndex,
      current:trackIndex===t,
      title:currentRoom.tracks[trackIndex],
      room:currentRoom.slug,
      source:'/audio/'+currentRoom.slug+'/'+(trackIndex+1)+'.wav'
    }));
  }

  function notify(message){
    try{if(typeof toast==='function')return toast(message)}catch{}
    console.info('[Afterlight queue]',message);
  }

  const originalTrack=typeof track==='function'?track:null;

  function targetForStep(step,{wrap=true}={}){
    const order=orderFor();
    let position=order.indexOf(t);
    if(position<0)position=0;
    const next=position+step;
    if(next>=0&&next<order.length)return order[next];
    if(!wrap)return null;
    return order[(next%order.length+order.length)%order.length];
  }

  function selectTrack(target){
    if(!originalTrack||!Number.isInteger(target)||target<0||target>2)return;
    const delta=target-t;
    if(delta===0)return;
    return originalTrack(delta);
  }

  if(originalTrack){
    track=function(direction){
      const step=Number(direction)>=0?1:-1;
      const target=targetForStep(step,{wrap:true});
      return selectTrack(target);
    };
  }

  async function continueAfterEnd(){
    const currentRoom=room();
    if(!currentRoom)return;
    if(state.repeat==='one'){
      try{
        audio.currentTime=0;
        await audio.play();
        playing=true;
        syncPlay();
        if(typeof trackEvent==='function')trackEvent('queue_repeat_one',{room:currentRoom.slug,track:t});
      }catch{
        await window.__afterlightAudio?.startFallback?.();
      }
      return;
    }

    const target=targetForStep(1,{wrap:state.repeat==='all'});
    if(target===null){
      playing=false;
      syncPlay();
      const status=document.getElementById('status');
      if(status)status.textContent='QUEUE FINISHED · TAP PLAY';
      if(typeof trackEvent==='function')trackEvent('queue_finished',{room:currentRoom.slug});
      return;
    }

    t=target;
    render(false);
    try{
      await audio.play();
      playing=true;
      syncPlay();
      if(typeof trackEvent==='function')trackEvent('play',{room:currentRoom.slug,track:t,continuous:true,queue:true});
    }catch{
      await window.__afterlightAudio?.startFallback?.();
    }
  }

  audio.onended=()=>{continueAfterEnd()};

  function recordHistory(){
    try{
      if(!audio.currentSrc)return;
      const source=new URL(audio.currentSrc,location.href).pathname;
      if(source===lastRecordedSource)return;
      lastRecordedSource=source;
      const currentRoom=room();
      if(!currentRoom)return;
      state.history.unshift({
        id:crypto.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now(),
        room:currentRoom.slug,
        roomName:currentRoom.name,
        track:t,
        title:currentRoom.tracks[t],
        source,
        startedAt:Date.now()
      });
      saveState();
      renderDialog();
    }catch{}
  }

  audio.addEventListener('playing',recordHistory);
  audio.addEventListener('loadedmetadata',()=>{
    try{
      const source=new URL(audio.currentSrc,location.href).pathname;
      if(source!==lastRecordedSource)lastRecordedSource='';
    }catch{}
  });

  function setShuffle(enabled){
    state.shuffle=!!enabled;
    if(state.shuffle&&!validOrder(state.shuffleOrders[roomSlug()])){
      state.shuffleOrders[roomSlug()]=deterministicShuffle(roomSlug());
    }
    saveState();
    updateControls();
    renderDialog();
    if(typeof trackEvent==='function')trackEvent('queue_shuffle_changed',{enabled:state.shuffle});
  }

  function cycleRepeat(){
    state.repeat=state.repeat==='all'?'one':state.repeat==='one'?'off':'all';
    saveState();
    updateControls();
    renderDialog();
    if(typeof trackEvent==='function')trackEvent('queue_repeat_changed',{mode:state.repeat});
  }

  function createStyles(){
    if(document.getElementById('afterlightQueueStyles'))return;
    const style=document.createElement('style');
    style.id='afterlightQueueStyles';
    style.textContent=`
      .queue-dialog{width:min(560px,calc(100vw - 28px));max-height:min(78vh,720px);border:0;border-radius:18px;padding:0;background:#171512;color:#f7efe5;box-shadow:0 28px 80px rgba(0,0,0,.46)}
      .queue-dialog::backdrop{background:rgba(7,6,5,.62);backdrop-filter:blur(8px)}
      .queue-shell{padding:22px}.queue-head{display:flex;align-items:center;justify-content:space-between;gap:14px}.queue-head h2{margin:0;font-size:24px}
      .queue-close{border:1px solid rgba(255,255,255,.2);background:transparent;color:inherit;border-radius:999px;width:40px;height:40px;cursor:pointer}
      .queue-modes{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.queue-mode{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:inherit;border-radius:999px;padding:9px 13px;cursor:pointer}
      .queue-mode.active{background:#f1dfc6;color:#1e1914}.queue-list,.queue-history{display:grid;gap:8px;margin-top:10px}
      .queue-row{display:grid;grid-template-columns:32px 1fr auto;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.055)}
      .queue-row.current{outline:1px solid rgba(241,223,198,.7)}.queue-row button{border:0;background:transparent;color:inherit;text-align:left;cursor:pointer;padding:0}
      .queue-kicker{font-size:10px;text-transform:uppercase;letter-spacing:.14em;opacity:.62;margin-top:22px}.queue-empty{opacity:.66;font-size:13px;padding:10px 0}
      .queue-time{font-size:11px;opacity:.55;white-space:nowrap}
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(value){
    return String(value??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
  }

  function formatTime(value){
    try{return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(value))}catch{return ''}
  }

  function renderDialog(){
    if(!dialog)return;
    const queue=queueSnapshot();
    const list=dialog.querySelector('#queueList');
    if(list){
      list.innerHTML=queue.map(item=>`
        <div class="queue-row ${item.current?'current':''}">
          <span>${item.position+1}</span>
          <button type="button" data-queue-track="${item.track}"><strong>${escapeHtml(item.title)}</strong><br><small>${item.current?'Playing now':room()?.name||''}</small></button>
          <span class="queue-time">${item.current?'Now':''}</span>
        </div>`).join('');
      list.querySelectorAll('[data-queue-track]').forEach(btn=>btn.addEventListener('click',()=>{
        selectTrack(Number(btn.dataset.queueTrack));
        dialog.close();
      }));
    }
    const history=dialog.querySelector('#queueHistory');
    if(history){
      history.innerHTML=state.history.length?state.history.slice(0,10).map(item=>`
        <div class="queue-row">
          <span>↺</span>
          <button type="button" data-history-room="${item.room}" data-history-track="${item.track}"><strong>${escapeHtml(item.title)}</strong><br><small>${escapeHtml(item.roomName||item.room)}</small></button>
          <span class="queue-time">${formatTime(item.startedAt)}</span>
        </div>`).join(''):'<div class="queue-empty">Nothing played yet on this device.</div>';
      history.querySelectorAll('[data-history-room]').forEach(btn=>btn.addEventListener('click',()=>{
        const roomIndex=R.findIndex(x=>x.slug===btn.dataset.historyRoom);
        if(roomIndex<0)return;
        if(roomIndex!==i){
          i=roomIndex;
          t=Number(btn.dataset.historyTrack)||0;
          render(true);
          source(false);
        }else{
          selectTrack(Number(btn.dataset.historyTrack));
        }
        dialog.close();
      }));
    }
    updateControls();
  }

  function updateControls(){
    const shuffle=document.getElementById('queueShuffle');
    const repeat=document.getElementById('queueRepeat');
    if(shuffle){
      shuffle.textContent=state.shuffle?'Shuffle · On':'Shuffle · Off';
      shuffle.classList.toggle('active',state.shuffle);
      shuffle.setAttribute('aria-pressed',String(state.shuffle));
    }
    if(repeat){
      const label=state.repeat==='all'?'Repeat · All':state.repeat==='one'?'Repeat · One':'Repeat · Off';
      repeat.textContent=label;
      repeat.classList.toggle('active',state.repeat!=='off');
      repeat.dataset.mode=state.repeat;
    }
  }

  function installDialog(){
    if(document.getElementById('queueDialog')){dialog=document.getElementById('queueDialog');return}
    createStyles();
    dialog=document.createElement('dialog');
    dialog.id='queueDialog';
    dialog.className='queue-dialog';
    dialog.innerHTML=`
      <div class="queue-shell">
        <div class="queue-head"><div><span class="queue-kicker">Current room</span><h2>Listening queue</h2></div><button id="queueClose" class="queue-close" aria-label="Close queue">×</button></div>
        <div class="queue-modes"><button id="queueShuffle" class="queue-mode" type="button"></button><button id="queueRepeat" class="queue-mode" type="button"></button></div>
        <div id="queueList" class="queue-list"></div>
        <div class="queue-kicker">Recent on this device</div>
        <div id="queueHistory" class="queue-history"></div>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#queueClose').onclick=()=>dialog.close();
    dialog.querySelector('#queueShuffle').onclick=()=>setShuffle(!state.shuffle);
    dialog.querySelector('#queueRepeat').onclick=cycleRepeat;
    renderDialog();
  }

  function installButton(){
    const tools=document.querySelector('.room-tools');
    if(!tools||document.getElementById('queueBtn'))return;
    const button=document.createElement('button');
    button.id='queueBtn';
    button.type='button';
    button.className='pill';
    button.textContent='Queue';
    button.onclick=()=>{renderDialog();dialog.showModal()};
    tools.appendChild(button);
  }

  const trackNode=document.getElementById('track');
  if(trackNode)new MutationObserver(()=>renderDialog()).observe(trackNode,{childList:true,subtree:true,characterData:true});

  installDialog();
  installButton();

  window.__afterlightQueue={
    version:1,
    storageKey:KEY,
    getState:()=>JSON.parse(JSON.stringify(state)),
    getQueue:queueSnapshot,
    setShuffle,
    cycleRepeat,
    selectTrack
  };
})();
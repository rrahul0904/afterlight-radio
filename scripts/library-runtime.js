(()=>{
  const CACHE_NAME='afterlight-offline-v1';
  const MEMORY_KEY='afterlight-radio:playback-memory:v1';
  const MAX_MEMORY_AGE_MS=1000*60*60*24*30;
  let button=null;
  let lastPersistedAt=0;
  let restoredSource='';

  const currentSlug=()=>{
    try{
      if(typeof R!=='undefined'&&typeof i!=='undefined'&&R[i]?.slug)return R[i].slug;
    }catch{}
    const parts=location.pathname.split('/').filter(Boolean);
    return parts.at(-1)||'rooftop';
  };

  const currentRoom=()=>{
    try{
      if(typeof R!=='undefined'&&typeof i!=='undefined')return R[i]||null;
    }catch{}
    return null;
  };

  const roomUrls=slug=>[
    '/'+slug+'/',
    '/audio/'+slug+'/1.wav',
    '/audio/'+slug+'/2.wav',
    '/audio/'+slug+'/3.wav'
  ];

  const notify=message=>{
    try{if(typeof toast==='function')return toast(message)}catch{}
    console.info('[Afterlight library]',message);
  };

  const canAccessCurrentRoom=()=>{
    try{
      const room=currentRoom();
      if(room&&typeof premiumGate==='function')return !premiumGate(room);
    }catch{}
    return true;
  };

  async function registration(){
    if(!('serviceWorker' in navigator))throw new Error('Offline playback is not supported in this browser');
    await navigator.serviceWorker.register('/offline-worker.js',{scope:'/'});
    return navigator.serviceWorker.ready;
  }

  async function activeWorker(){
    const reg=await registration();
    return navigator.serviceWorker.controller||reg.active||reg.waiting||reg.installing;
  }

  async function send(type,payload={}){
    const worker=await activeWorker();
    if(!worker)throw new Error('Offline worker is not ready');
    const requestId=crypto.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        navigator.serviceWorker.removeEventListener('message',onMessage);
        reject(new Error('Offline worker did not respond'));
      },20000);
      const onMessage=event=>{
        const data=event.data||{};
        if(data.requestId!==requestId)return;
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('message',onMessage);
        if(data.ok)resolve(data);
        else reject(new Error(data.error||'Offline request failed'));
      };
      navigator.serviceWorker.addEventListener('message',onMessage);
      worker.postMessage({type,requestId,...payload});
    });
  }

  async function isRoomOffline(slug=currentSlug()){
    if(!('caches' in window))return false;
    const cache=await caches.open(CACHE_NAME);
    for(const url of roomUrls(slug)){
      const match=await cache.match(url,{ignoreSearch:false});
      if(!match)return false;
    }
    return true;
  }

  async function refreshButton(){
    if(!button)return;
    const saved=await isRoomOffline().catch(()=>false);
    button.textContent=saved?'✓ Offline':'Save offline';
    button.setAttribute('aria-pressed',String(saved));
    button.dataset.saved=String(saved);
  }

  async function saveCurrentRoom(){
    if(!canAccessCurrentRoom())return false;
    if(button){button.disabled=true;button.textContent='Saving…'}
    try{
      const slug=currentSlug();
      await send('CACHE_URLS',{urls:roomUrls(slug)});
      notify('Saved for offline listening');
      if(typeof trackEvent==='function')trackEvent('offline_room_saved',{room:slug});
      return true;
    }catch(error){
      notify(error.message||'Could not save offline');
      return false;
    }finally{
      if(button)button.disabled=false;
      await refreshButton();
    }
  }

  async function removeCurrentRoom(){
    const slug=currentSlug();
    if(button){button.disabled=true;button.textContent='Removing…'}
    try{
      await send('REMOVE_URLS',{urls:roomUrls(slug)});
      notify('Offline copy removed');
      if(typeof trackEvent==='function')trackEvent('offline_room_removed',{room:slug});
      return true;
    }catch(error){
      notify(error.message||'Could not remove offline copy');
      return false;
    }finally{
      if(button)button.disabled=false;
      await refreshButton();
    }
  }

  function installButton(){
    const tools=document.querySelector('.room-tools');
    if(!tools||document.getElementById('offlineRoom'))return;
    button=document.createElement('button');
    button.id='offlineRoom';
    button.className='pill';
    button.type='button';
    button.textContent='Save offline';
    button.setAttribute('aria-label','Save this room for offline listening');
    button.onclick=async()=>{
      const saved=await isRoomOffline().catch(()=>false);
      if(saved)await removeCurrentRoom();
      else await saveCurrentRoom();
    };
    tools.appendChild(button);
    refreshButton();
  }

  function readMemory(){
    try{
      const value=JSON.parse(localStorage.getItem(MEMORY_KEY)||'null');
      if(!value||typeof value!=='object')return null;
      if(!Number.isFinite(value.position)||value.position<0)return null;
      if(!value.source||!value.savedAt||Date.now()-value.savedAt>MAX_MEMORY_AGE_MS)return null;
      return value;
    }catch{return null}
  }

  function writeMemory(force=false){
    try{
      if(typeof audio==='undefined'||!audio.currentSrc)return;
      const now=Date.now();
      if(!force&&now-lastPersistedAt<4000)return;
      lastPersistedAt=now;
      const source=new URL(audio.currentSrc,location.href).pathname;
      const position=Number(audio.currentTime||0);
      const duration=Number(audio.duration||0);
      localStorage.setItem(MEMORY_KEY,JSON.stringify({
        source,
        position,
        duration:Number.isFinite(duration)?duration:0,
        room:currentSlug(),
        savedAt:now
      }));
    }catch{}
  }

  function restoreMemory(){
    try{
      if(typeof audio==='undefined'||!audio.currentSrc||!Number.isFinite(audio.duration))return;
      const source=new URL(audio.currentSrc,location.href).pathname;
      if(restoredSource===source)return;
      restoredSource=source;
      const memory=readMemory();
      if(!memory||memory.source!==source)return;
      if(memory.position<5||memory.position>=audio.duration-5)return;
      audio.currentTime=Math.min(memory.position,audio.duration-5);
      notify('Resumed where you left off');
    }catch{}
  }

  function bindPlaybackMemory(){
    try{
      if(typeof audio==='undefined')return;
      audio.addEventListener('timeupdate',()=>writeMemory(false));
      audio.addEventListener('pause',()=>writeMemory(true));
      audio.addEventListener('ended',()=>writeMemory(true));
      audio.addEventListener('loadedmetadata',restoreMemory);
      window.addEventListener('pagehide',()=>writeMemory(true));
    }catch{}
  }

  function observeRoomChanges(){
    let slug=currentSlug();
    const observer=new MutationObserver(()=>{
      const next=currentSlug();
      if(next===slug)return;
      slug=next;
      restoredSource='';
      refreshButton();
    });
    const title=document.getElementById('track');
    if(title)observer.observe(title,{childList:true,subtree:true,characterData:true});
  }

  const providerContract=Object.freeze({
    version:1,
    normalizedTrack:['id','title','artist','album','duration','artwork','streamUrl','provider','providerTrackId'],
    supportedProviderKinds:['afterlight','jellyfin','emby','navidrome'],
    credentialPolicy:'server-side-only',
    externalProvidersEnabled:false
  });

  window.__afterlightLibrary={
    version:1,
    cacheName:CACHE_NAME,
    providerContract,
    roomUrls,
    isRoomOffline,
    saveCurrentRoom,
    removeCurrentRoom,
    readPlaybackMemory:readMemory
  };

  registration().catch(()=>{});
  installButton();
  bindPlaybackMemory();
  observeRoomChanges();
})();
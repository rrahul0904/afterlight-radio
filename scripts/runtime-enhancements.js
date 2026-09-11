(()=>{
  const setStatus=text=>{const el=document.getElementById('status');if(el)el.textContent=text};
  const currentRoom=()=>R[i];
  const updateMediaMetadata=()=>{
    if(!('mediaSession' in navigator)||!('MediaMetadata' in window))return;
    const room=currentRoom();
    if(!room)return;
    navigator.mediaSession.metadata=new MediaMetadata({
      title:room.tracks[t%3],
      artist:'Afterlight',
      album:room.name
    });
    navigator.mediaSession.playbackState=playing&&!audio.paused?'playing':'paused';
  };
  const updatePosition=()=>{
    if(!('mediaSession' in navigator)||typeof navigator.mediaSession.setPositionState!=='function')return;
    if(!Number.isFinite(audio.duration)||audio.duration<=0||!Number.isFinite(audio.currentTime))return;
    try{
      navigator.mediaSession.setPositionState({
        duration:audio.duration,
        playbackRate:audio.playbackRate||1,
        position:Math.min(audio.currentTime,audio.duration)
      });
    }catch{}
  };
  if('mediaSession' in navigator){
    const actions={
      play:()=>{if(!playing)toggle()},
      pause:()=>{if(playing)toggle()},
      nexttrack:()=>track(1),
      previoustrack:()=>track(-1)
    };
    for(const [action,handler] of Object.entries(actions)){
      try{navigator.mediaSession.setActionHandler(action,handler)}catch{}
    }
  }

  const billingButton=document.getElementById('manageBilling');
  if(billingButton){
    const originalBillingAction=billingButton.onclick;
    billingButton.onclick=()=>{
      if(apiConfig?.billingEnabled&&apiConfig?.portalEnabled===false){
        location.assign('/support/?topic='+encodeURIComponent('Subscription cancellation'));
        return;
      }
      return originalBillingAction?.();
    };
    loadApiConfig().then(()=>{
      if(apiConfig?.billingEnabled&&apiConfig?.portalEnabled===false)billingButton.textContent='Billing support';
    }).catch(()=>{});
  }

  const trackNode=document.getElementById('track');
  if(trackNode)new MutationObserver(updateMediaMetadata).observe(trackNode,{childList:true,subtree:true,characterData:true});
  audio.addEventListener('loadedmetadata',()=>{updateMediaMetadata();updatePosition()});
  audio.addEventListener('durationchange',updatePosition);
  audio.addEventListener('timeupdate',updatePosition);
  audio.addEventListener('play',()=>{updateMediaMetadata();if('mediaSession' in navigator)navigator.mediaSession.playbackState='playing'});
  audio.addEventListener('pause',()=>{if('mediaSession' in navigator)navigator.mediaSession.playbackState='paused'});
  audio.addEventListener('waiting',()=>setStatus('BUFFERING · KEEP THIS TAB OPEN'));
  audio.addEventListener('stalled',()=>setStatus('NETWORK SLOW · RETRYING AUDIO'));
  audio.addEventListener('canplay',()=>{if(!playing)setStatus('SOUND READY · TAP PLAY')});
  audio.addEventListener('error',()=>{
    playing=false;
    syncPlay();
    setStatus('AUDIO UNAVAILABLE · TRY AGAIN');
    trackEvent('audio_error',{room:currentRoom()?.slug||null,track:t,code:audio.error?.code||null});
    toast('Audio could not load · try again');
  });
  updateMediaMetadata();
})();

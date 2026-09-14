(()=>{
  if(typeof audio==='undefined')return;

  const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
  const originalPlay=$('play')?.onclick;
  let ctx=null,master=null,timer=null,fallbackPlaying=false;

  const roomProfiles={
    roma:[53,'minor'],window:[55,'major'], 'long-way-home':[50,'dorian'],
    'two-hundred':[48,'minor'],'one-more-log':[48,'major'],rooftop:[57,'major'],
    friends:[55,'dorian'],backroom:[52,'minor'],headspace:[55,'major'],
    'last-bus':[48,'minor'],momentum:[57,'major'],between:[50,'dorian']
  };
  const scales={major:[0,2,4,7,9,11],minor:[0,2,3,5,7,10],dorian:[0,2,3,5,7,9,10]};
  const midi=n=>440*Math.pow(2,(n-69)/12);

  function stopFallback(){
    fallbackPlaying=false;
    if(timer){clearTimeout(timer);timer=null}
    if(master){try{master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(0,ctx.currentTime,.06)}catch{}}
    playing=false;
    syncPlay();
  }

  function scheduleBar(){
    if(!fallbackPlaying||!ctx||!master)return;
    const room=R[i],profile=roomProfiles[room.slug]||[57,'major'],root=profile[0],scale=scales[profile[1]],beat=60/(room.bpm||70),now=ctx.currentTime+.04;
    const progression=[0,4,3,5],degree=progression[Math.floor(Date.now()/(beat*4000))%progression.length];
    const notes=[0,2,4].map(step=>midi(root+scale[(degree+step)%scale.length]+12*Math.floor((degree+step)/scale.length)));
    notes.forEach((freq,k)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
      osc.type=k===0?'triangle':'sine';osc.frequency.value=freq*(k===1?1.002:k===2?.998:1);
      filter.type='lowpass';filter.frequency.value=1300;filter.Q.value=.35;
      gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.035/(k+1),now+.45);gain.gain.exponentialRampToValueAtTime(.0008,now+beat*3.8);
      osc.connect(filter);filter.connect(gain);gain.connect(master);osc.start(now);osc.stop(now+beat*4);
    });
    for(let b=0;b<4;b++){
      const bass=ctx.createOscillator(),g=ctx.createGain(),when=now+b*beat,f=midi(root-12+scale[(degree+(b%2?4:0))%scale.length]);
      bass.type='sine';bass.frequency.value=f;g.gain.setValueAtTime(.055,when);g.gain.exponentialRampToValueAtTime(.001,when+beat*.75);bass.connect(g);g.connect(master);bass.start(when);bass.stop(when+beat);
      if(room.bpm>65){const click=ctx.createOscillator(),cg=ctx.createGain();click.type='sine';click.frequency.value=b%2?880:660;cg.gain.setValueAtTime(.008,when);cg.gain.exponentialRampToValueAtTime(.0001,when+.08);click.connect(cg);cg.connect(master);click.start(when);click.stop(when+.1)}
    }
    timer=setTimeout(scheduleBar,beat*4000-100);
  }

  async function startFallback(){
    if(!AudioContextCtor){if(typeof toast==='function')toast('Audio is unavailable in this browser');return}
    if(!ctx){ctx=new AudioContextCtor();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination)}
    if(ctx.state==='suspended')await ctx.resume();
    const v=muted?0:(+$('volume').value/100)*.42;
    master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(v,ctx.currentTime,.08);
    fallbackPlaying=true;playing=true;syncPlay();
    $('status').textContent='NOW PLAYING · LIVE RADIO';
    scheduleBar();
    if(typeof trackEvent==='function')trackEvent('play',{room:R[i].slug,track:t,fallback:true});
    if(typeof toast==='function')toast('Audio on');
  }

  async function assetAvailable(){
    const src=audio.currentSrc||audio.src;
    if(!src)return false;
    try{
      const r=await fetch(src,{method:'GET',headers:{Range:'bytes=0-63'},cache:'no-store'});
      return r.ok||r.status===206;
    }catch{return false}
  }

  // Prefer the generated room recordings. If a deployment ever loses those
  // assets, fail over to an audible Web Audio arrangement instead of silently
  // showing a working player with no music.
  audio.loop=false;
  audio.onended=()=>{
    t=(t+1)%3;
    render(false);
    audio.play().then(()=>{
      playing=true;
      syncPlay();
      if(typeof trackEvent==='function')trackEvent('play',{room:R[i].slug,track:t,continuous:true});
    }).catch(()=>startFallback());
  };
  audio.addEventListener('error',()=>{if(playing&&!fallbackPlaying)startFallback()});

  if($('play')&&originalPlay){
    $('play').onclick=async()=>{
      if(fallbackPlaying){stopFallback();return}
      if(playing){originalPlay();return}
      if(await assetAvailable()){originalPlay();return}
      await startFallback();
    };
  }
  $('volume')?.addEventListener('input',()=>{if(master&&ctx)master.gain.setTargetAtTime(muted?0:(+$('volume').value/100)*.42,ctx.currentTime,.05)});
  $('mute')?.addEventListener('click',()=>{if(master&&ctx)master.gain.setTargetAtTime(muted?0:(+$('volume').value/100)*.42,ctx.currentTime,.05)});

  window.__afterlightAudio={assetAvailable,startFallback,stopFallback,get fallbackPlaying(){return fallbackPlaying}};
})();

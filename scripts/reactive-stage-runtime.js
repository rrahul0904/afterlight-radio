(()=>{
  'use strict';

  if(typeof audio==='undefined')return;

  const STORAGE_KEY='afterlight:reactive-stage:v1';
  const PRESETS=['halo','drift','pulse'];
  const LABELS={halo:'Halo',drift:'Drift',pulse:'Pulse'};
  const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
  const reducedQuery=window.matchMedia?.('(prefers-reduced-motion: reduce)');

  let prefs={enabled:false,preset:'halo'};
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
    prefs={enabled:!!saved.enabled,preset:PRESETS.includes(saved.preset)?saved.preset:'halo'};
  }catch{}

  let canvas=null,ctx2d=null,raf=0,frame=0;
  let audioCtx=null,sourceNode=null,analyser=null,freq=null;
  let localUrl=null,localName='';
  let particles=[];

  const reduced=()=>!!reducedQuery?.matches;
  const lowPower=()=>reduced()||innerWidth<620||(Number(navigator.deviceMemory)||8)<=4;
  const particleCount=()=>lowPower()?360:1100;
  const save=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(prefs))}catch{}};
  const toast=text=>{
    const node=document.getElementById('toast');
    if(!node)return;
    node.textContent=text;
    node.classList.add('show');
    clearTimeout(node.__reactiveStageToast);
    node.__reactiveStageToast=setTimeout(()=>node.classList.remove('show'),1600);
  };
  const seeded=(index)=>{
    let x=(index+1)*0x9e3779b1;
    x^=x<<13;x^=x>>>17;x^=x<<5;
    return (x>>>0)/4294967295;
  };

  function ensureCanvas(){
    if(canvas)return canvas;
    const scene=document.getElementById('scene')||document.querySelector('.scene');
    if(!scene)return null;
    canvas=document.createElement('canvas');
    canvas.id='afterlightReactiveStage';
    canvas.className='afterlight-reactive-stage';
    canvas.setAttribute('aria-hidden','true');
    scene.appendChild(canvas);
    ctx2d=canvas.getContext('2d',{alpha:true});
    resize();
    return canvas;
  }

  function resize(){
    if(!canvas)return;
    const dpr=Math.min(devicePixelRatio||1,lowPower()?1.25:2);
    const w=Math.max(1,canvas.clientWidth||innerWidth);
    const h=Math.max(1,canvas.clientHeight||innerHeight);
    canvas.width=Math.round(w*dpr);
    canvas.height=Math.round(h*dpr);
    ctx2d?.setTransform(dpr,0,0,dpr,0,0);
    particles=Array.from({length:particleCount()},(_,index)=>({
      x:seeded(index*3+1),
      y:seeded(index*3+2),
      phase:seeded(index*3+3)*Math.PI*2,
      size:.45+seeded(index*5+7)*1.55
    }));
  }

  function injectStyle(){
    if(document.getElementById('afterlightReactiveStageStyle'))return;
    const style=document.createElement('style');
    style.id='afterlightReactiveStageStyle';
    style.textContent=`
      .afterlight-reactive-stage{position:absolute;inset:0;z-index:3;width:100%;height:100%;pointer-events:none!important;user-select:none!important;-webkit-user-select:none!important;opacity:0;transition:opacity .35s ease;mix-blend-mode:screen}
      body[data-reactive-stage="true"] .afterlight-reactive-stage{opacity:.88}
      #reactiveStageBtn.active{background:var(--cream);color:var(--black)}
      #localSongInput{position:fixed!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
      @media(prefers-reduced-motion:reduce){.afterlight-reactive-stage{transition:none!important;opacity:.42!important}}
    `;
    document.head.appendChild(style);
  }

  async function ensureAnalyser(){
    if(analyser){if(audioCtx?.state==='suspended')await audioCtx.resume();return true}
    if(!AudioContextCtor){toast('Reactive audio is unavailable in this browser');return false}
    try{
      audioCtx=new AudioContextCtor();
      sourceNode=audioCtx.createMediaElementSource(audio);
      analyser=audioCtx.createAnalyser();
      analyser.fftSize=256;
      analyser.smoothingTimeConstant=.82;
      freq=new Uint8Array(analyser.frequencyBinCount);
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      if(audioCtx.state==='suspended')await audioCtx.resume();
      return true;
    }catch{
      toast('Reactive stage could not attach to this player');
      return false;
    }
  }

  function energy(){
    if(!analyser||!freq||audio.paused)return {bass:.05,mid:.04,high:.03,all:.04};
    analyser.getByteFrequencyData(freq);
    const avg=(a,b)=>{
      let sum=0,count=0;
      for(let i=a;i<Math.min(b,freq.length);i++){sum+=freq[i];count++}
      return count?sum/(count*255):0;
    };
    const bass=avg(0,10),mid=avg(10,38),high=avg(38,96);
    return {bass,mid,high,all:(bass+mid+high)/3};
  }

  function draw(){
    raf=0;
    if(!prefs.enabled||document.hidden||!ctx2d||!canvas)return;
    const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;
    ctx2d.clearRect(0,0,w,h);
    const e=energy();
    const now=performance.now()/1000;
    const motion=reduced()?0:1;
    const cx=w/2,cy=h/2;
    ctx2d.globalCompositeOperation='lighter';

    for(let index=0;index<particles.length;index++){
      const p=particles[index];
      let x=p.x*w,y=p.y*h,alpha=.08+e.all*.72,size=p.size+e.high*2.2;
      if(prefs.preset==='halo'){
        const a=p.phase+now*(.025+e.mid*.24)*motion;
        const radius=(.1+p.x*.46)*Math.min(w,h)*(1+e.bass*.18);
        x=cx+Math.cos(a)*radius*(w>h?1.3:1);
        y=cy+Math.sin(a)*radius;
        alpha=.07+e.mid*.82;
      }else if(prefs.preset==='drift'){
        x=((p.x*w)+(Math.sin(p.phase+now*.16)*70*motion)+w)%w;
        y=((p.y*h)+(now*(9+e.bass*35)*motion))%h;
        alpha=.06+e.high*.9;
      }else{
        const band=(index%64)/63;
        x=band*w;
        const wave=Math.sin(p.phase+now*(.7+e.mid*2.4)*motion);
        y=cy+wave*(40+e.bass*h*.24)+(p.y-.5)*h*.36;
        alpha=.06+e.bass*.9;
        size=p.size+e.bass*3.2;
      }
      ctx2d.fillStyle=`rgba(255,238,205,${Math.min(.9,alpha)})`;
      ctx2d.beginPath();
      ctx2d.arc(x,y,Math.max(.35,size),0,Math.PI*2);
      ctx2d.fill();
    }
    frame++;
    raf=requestAnimationFrame(draw);
  }

  function schedule(){
    if(raf)cancelAnimationFrame(raf);
    raf=0;
    if(prefs.enabled&&!document.hidden)raf=requestAnimationFrame(draw);
  }

  async function setEnabled(value,{announce=true}={}){
    prefs.enabled=Boolean(value);
    save();
    ensureCanvas();
    document.body.dataset.reactiveStage=String(prefs.enabled);
    const button=document.getElementById('reactiveStageBtn');
    if(button){
      button.classList.toggle('active',prefs.enabled);
      button.setAttribute('aria-pressed',String(prefs.enabled));
      button.textContent=prefs.enabled?'Reactive · on':'Reactive stage';
    }
    if(prefs.enabled)await ensureAnalyser();
    schedule();
    if(announce)toast(prefs.enabled?'Reactive stage on':'Reactive stage off');
  }

  function setPreset(preset,{announce=true}={}){
    if(!PRESETS.includes(preset))return;
    prefs.preset=preset;save();
    const button=document.getElementById('reactivePresetBtn');
    if(button){button.textContent=`Stage · ${LABELS[preset]}`;button.setAttribute('aria-label',`Reactive stage look: ${LABELS[preset]}`)}
    if(announce)toast(`Stage look · ${LABELS[preset]}`);
  }

  function nextPreset(){
    const index=PRESETS.indexOf(prefs.preset);
    setPreset(PRESETS[(index+1)%PRESETS.length]);
  }

  function clearLocal({restore=false}={}){
    const prior=localUrl;
    localUrl=null;localName='';
    const button=document.getElementById('localSongBtn');
    if(button)button.textContent='Local song';
    if(restore&&typeof source==='function')source(false);
    if(prior)queueMicrotask(()=>URL.revokeObjectURL(prior));
  }

  function loadLocalFile(file){
    if(!file||!String(file.type||'').startsWith('audio/')){toast('Choose an audio file');return false}
    clearLocal();
    localUrl=URL.createObjectURL(file);
    localName=String(file.name||'Local song').slice(0,120);
    audio.pause();
    if(typeof playing!=='undefined')playing=false;
    audio.src=localUrl;
    audio.load();
    const track=document.getElementById('track');
    const status=document.getElementById('status');
    if(track)track.textContent=localName;
    if(status)status.textContent='LOCAL AUDITION · TAP PLAY';
    if(typeof syncPlay==='function')syncPlay();
    if(track)track.textContent=localName;
    if(status)status.textContent='LOCAL AUDITION · TAP PLAY';
    const button=document.getElementById('localSongBtn');
    if(button)button.textContent='Room track';
    toast('Local audition loaded · stays on this device');
    return true;
  }

  function openLocalPicker(){
    if(localUrl){clearLocal({restore:true});toast('Back to the room track');return}
    document.getElementById('localSongInput')?.click();
  }

  function ensureControls(){
    const tools=document.querySelector('.room-tools');
    if(!tools)return;
    if(!document.getElementById('reactiveStageBtn')){
      const button=document.createElement('button');
      button.id='reactiveStageBtn';button.type='button';button.className='pill';button.textContent='Reactive stage';
      button.setAttribute('aria-pressed','false');
      button.addEventListener('click',()=>setEnabled(!prefs.enabled));
      tools.appendChild(button);
    }
    if(!document.getElementById('reactivePresetBtn')){
      const button=document.createElement('button');
      button.id='reactivePresetBtn';button.type='button';button.className='pill';
      button.addEventListener('click',nextPreset);tools.appendChild(button);
    }
    if(!document.getElementById('localSongBtn')){
      const button=document.createElement('button');
      button.id='localSongBtn';button.type='button';button.className='pill';button.textContent='Local song';
      button.title='Audition a local audio file without uploading it';
      button.addEventListener('click',openLocalPicker);tools.appendChild(button);
    }
    if(!document.getElementById('localSongInput')){
      const input=document.createElement('input');
      input.id='localSongInput';input.type='file';input.accept='audio/*';input.tabIndex=-1;
      input.addEventListener('change',()=>{const file=input.files?.[0];if(file)loadLocalFile(file);input.value=''});
      document.body.appendChild(input);
    }
    setPreset(prefs.preset,{announce:false});
  }

  function init(){
    injectStyle();ensureCanvas();ensureControls();
    document.body.dataset.reactiveStage=String(prefs.enabled);
    window.addEventListener('resize',resize,{passive:true});
    document.addEventListener('visibilitychange',schedule);
    reducedQuery?.addEventListener?.('change',()=>{resize();schedule()});
    audio.addEventListener('loadstart',()=>{
      if(localUrl&&audio.src!==localUrl)clearLocal();
    });
    audio.addEventListener('play',()=>{if(prefs.enabled)ensureAnalyser().then(schedule)});
    audio.addEventListener('pause',schedule);
    const title=document.getElementById('title');
    if(title)new MutationObserver(()=>{ensureControls();if(localUrl)clearLocal()}).observe(title,{childList:true,subtree:true,characterData:true});
    setEnabled(prefs.enabled,{announce:false});
    window.__afterlightReactiveStage={
      setEnabled,setPreset,nextPreset,loadLocalFile,clearLocal,
      getState:()=>({enabled:prefs.enabled,preset:prefs.preset,reducedMotion:reduced(),lowPower:lowPower(),analyserReady:!!analyser,frames:frame,localActive:!!localUrl,localName:localName||null,particleCount:particles.length})
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();

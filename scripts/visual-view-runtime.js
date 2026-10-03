(()=>{
  'use strict';

  const STORAGE_KEY='afterlight:visual-preferences:v1';
  const VIEW_IDS=['original','closer','soft-glow','after-dark'];
  const VIEW_LABELS={original:'Original view',closer:'Closer view','soft-glow':'Soft glow','after-dark':'After dark'};
  const MODES=['default','focus','canvas'];
  const DEFAULTS={mode:'default',autoHide:false,viewByRoom:{}};

  const clampPrefs=value=>{
    const input=value&&typeof value==='object'?value:{};
    const mode=MODES.includes(input.mode)?input.mode:DEFAULTS.mode;
    const autoHide=typeof input.autoHide==='boolean'?input.autoHide:DEFAULTS.autoHide;
    const viewByRoom={};
    if(input.viewByRoom&&typeof input.viewByRoom==='object'){
      for(const [key,view] of Object.entries(input.viewByRoom)){
        if(typeof key==='string'&&key.length<120&&VIEW_IDS.includes(view))viewByRoom[key]=view;
      }
    }
    return {mode,autoHide,viewByRoom};
  };

  const loadPrefs=()=>{
    try{return clampPrefs(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'))}
    catch{return {...DEFAULTS,viewByRoom:{}}}
  };
  let prefs=loadPrefs();
  let idleTimer=0;

  const savePrefs=()=>{
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(prefs))}catch{}
  };
  const roomKey=()=>{
    const title=document.getElementById('title')?.textContent?.trim();
    return title||location.pathname||'default';
  };
  const paintedScene=()=>document.getElementById('paintedScene');
  const toast=text=>{
    const node=document.getElementById('toast');
    if(!node)return;
    node.textContent=text;
    node.classList.add('show');
    clearTimeout(node.__afterlightVisualToastTimer);
    node.__afterlightVisualToastTimer=setTimeout(()=>node.classList.remove('show'),1900);
  };

  function applyDisplayMode(){
    document.body.dataset.displayMode=prefs.mode;
    document.body.dataset.autoHide=String(prefs.autoHide);
    const modeInputs=document.querySelectorAll('input[name="afterlightDisplayMode"]');
    modeInputs.forEach(input=>{input.checked=input.value===prefs.mode});
    const autoHide=document.getElementById('afterlightAutoHide');
    if(autoHide)autoHide.checked=prefs.autoHide;
    scheduleIdle();
  }

  function currentView(){
    const stored=prefs.viewByRoom[roomKey()];
    return VIEW_IDS.includes(stored)?stored:'original';
  }

  function applyView(view,{announce=false}={}){
    const safe=VIEW_IDS.includes(view)?view:'original';
    const scene=paintedScene();
    if(scene){
      scene.dataset.afterlightView=safe;
      scene.setAttribute('aria-hidden','true');
    }
    const overlay=document.getElementById('afterlightViewOverlay');
    if(overlay)overlay.dataset.afterlightView=safe;
    const button=document.getElementById('anotherViewBtn');
    if(button){
      button.dataset.view=safe;
      button.setAttribute('aria-label',`Another view. Current: ${VIEW_LABELS[safe]}. Music keeps playing.`);
      button.title='Change only the view — music keeps playing';
    }
    if(announce)toast(`${VIEW_LABELS[safe]} · music keeps playing`);
  }

  function setView(view,{announce=true}={}){
    const safe=VIEW_IDS.includes(view)?view:'original';
    prefs.viewByRoom[roomKey()]=safe;
    savePrefs();
    applyView(safe,{announce});
  }

  function nextView(){
    const current=currentView();
    const index=VIEW_IDS.indexOf(current);
    setView(VIEW_IDS[(index+1)%VIEW_IDS.length]);
  }

  function scheduleIdle(){
    window.clearTimeout(idleTimer);
    document.body.classList.remove('visual-idle');
    if(!prefs.autoHide)return;
    idleTimer=window.setTimeout(()=>document.body.classList.add('visual-idle'),5000);
  }

  function noteActivity(){scheduleIdle()}

  function setMode(mode){
    if(!MODES.includes(mode))return;
    prefs.mode=mode;
    savePrefs();
    applyDisplayMode();
    toast(mode==='canvas'?'Canvas mode':mode==='focus'?'Focus mode':'Default display');
  }

  function setAutoHide(enabled){
    prefs.autoHide=Boolean(enabled);
    savePrefs();
    applyDisplayMode();
  }

  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement){await document.exitFullscreen?.();return}
      if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
      else toast('Fullscreen is not available in this browser');
    }catch{toast('Fullscreen could not be opened')}
  }

  function injectStyle(){
    if(document.getElementById('afterlightVisualViewStyle'))return;
    const style=document.createElement('style');
    style.id='afterlightVisualViewStyle';
    style.textContent=`
      .painted-scene{pointer-events:none!important;user-select:none!important;-webkit-user-select:none!important;-webkit-user-drag:none!important;transition:opacity .45s ease,filter .65s ease!important}
      .painted-scene svg{pointer-events:none!important;user-select:none!important;-webkit-user-select:none!important;-webkit-user-drag:none!important;transition:transform .7s cubic-bezier(.2,.75,.2,1),filter .7s ease!important;transform-origin:center center}
      .painted-scene[data-afterlight-view="closer"] svg{transform:scale(1.115) translate3d(-1.4%,.8%,0)!important;filter:saturate(.94) contrast(1.04) brightness(.96)!important}
      .painted-scene[data-afterlight-view="soft-glow"] svg{transform:scale(1.045)!important;filter:saturate(.78) contrast(.96) brightness(1.07) sepia(.08)!important}
      .painted-scene[data-afterlight-view="after-dark"] svg{transform:scale(1.065) translate3d(1%,-.5%,0)!important;filter:saturate(.72) contrast(1.12) brightness(.72) hue-rotate(-5deg)!important}
      .afterlight-view-overlay{position:absolute;inset:0;z-index:1;pointer-events:none!important;user-select:none!important;-webkit-user-select:none!important;opacity:0;transition:opacity .65s ease;background:transparent}
      .afterlight-view-overlay[data-afterlight-view="soft-glow"]{opacity:1;background:radial-gradient(circle at 62% 35%,rgba(255,222,170,.16),transparent 34%),linear-gradient(180deg,rgba(255,247,228,.04),rgba(26,17,15,.14))}
      .afterlight-view-overlay[data-afterlight-view="after-dark"]{opacity:1;background:linear-gradient(180deg,rgba(7,12,21,.18),rgba(4,7,13,.34)),radial-gradient(ellipse at center,transparent 30%,rgba(0,0,0,.24) 100%)}
      #anotherViewBtn:after{content:' ↻';opacity:.58}
      .afterlight-display-dialog{width:min(520px,calc(100vw - 28px));border:0;border-radius:18px;padding:0;background:#eee6d8;color:#201c17;box-shadow:0 30px 110px rgba(0,0,0,.5)}
      .afterlight-display-dialog::backdrop{background:rgba(8,7,6,.7);backdrop-filter:blur(7px)}
      .afterlight-display-panel{padding:28px}.afterlight-display-panel h2{font:400 clamp(30px,5vw,46px)/.98 Georgia,serif;margin:7px 0 8px;letter-spacing:-.04em}.afterlight-display-panel p{margin:0 0 22px;color:#6c6257;font-size:12px;line-height:1.55}
      .afterlight-display-group{display:grid;gap:8px;margin:18px 0}.afterlight-display-choice{display:flex;gap:11px;align-items:flex-start;border:1px solid #d2c7b7;background:#f8f2e7;padding:13px;cursor:pointer}.afterlight-display-choice strong{display:block;font-size:11px}.afterlight-display-choice small{display:block;margin-top:3px;color:#766c60;line-height:1.35}.afterlight-display-choice input{margin-top:2px}
      .afterlight-display-row{display:flex;align-items:center;justify-content:space-between;gap:14px;border-top:1px solid #d5cab9;padding:16px 0;font-size:11px}.afterlight-display-row label{font-weight:650}.afterlight-display-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.afterlight-display-actions button{height:40px;padding:0 14px;border:1px solid #201c17;background:#201c17;color:#f7f0e5;border-radius:999px;cursor:pointer;font-size:9px;letter-spacing:.08em}.afterlight-display-actions button.secondary{background:transparent;color:#201c17}.afterlight-shortcuts{margin-top:18px!important;font-size:10px!important;color:#817669!important}
      body[data-auto-hide="true"].visual-idle .top,body[data-auto-hide="true"].visual-idle .room-nav,body[data-auto-hide="true"].visual-idle .foot,body[data-auto-hide="true"].visual-idle .room-tools,body[data-auto-hide="true"].visual-idle .story{opacity:0!important;pointer-events:none!important;transition:opacity .35s ease}
      body[data-display-mode="focus"].visual-idle .copy{opacity:0!important;pointer-events:none!important;transition:opacity .35s ease}
      body[data-display-mode="canvas"].visual-idle .top,body[data-display-mode="canvas"].visual-idle .copy,body[data-display-mode="canvas"].visual-idle .player,body[data-display-mode="canvas"].visual-idle .room-nav,body[data-display-mode="canvas"].visual-idle .foot{opacity:0!important;pointer-events:none!important;transition:opacity .35s ease}
      @media(prefers-reduced-motion:reduce){.painted-scene,.painted-scene svg,.afterlight-view-overlay,.top,.copy,.player,.room-nav,.foot,.room-tools,.story{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay(){
    const scene=document.getElementById('scene')||document.querySelector('.scene');
    if(!scene||document.getElementById('afterlightViewOverlay'))return;
    const overlay=document.createElement('div');
    overlay.id='afterlightViewOverlay';
    overlay.className='afterlight-view-overlay';
    overlay.setAttribute('aria-hidden','true');
    scene.appendChild(overlay);
  }

  function ensureButtons(){
    const tools=document.querySelector('.room-tools');
    if(!tools)return;
    if(!document.getElementById('anotherViewBtn')){
      const button=document.createElement('button');
      button.id='anotherViewBtn';
      button.type='button';
      button.className='pill';
      button.textContent='Another view';
      button.addEventListener('click',nextView);
      tools.appendChild(button);
    }
    if(!document.getElementById('displaySettingsBtn')){
      const button=document.createElement('button');
      button.id='displaySettingsBtn';
      button.type='button';
      button.className='pill';
      button.textContent='Display';
      button.setAttribute('aria-label','Display settings');
      button.addEventListener('click',openSettings);
      tools.appendChild(button);
    }
  }

  function ensureDialog(){
    if(document.getElementById('afterlightDisplayDialog'))return;
    const dialog=document.createElement('dialog');
    dialog.id='afterlightDisplayDialog';
    dialog.className='afterlight-display-dialog';
    dialog.innerHTML=`<div class="afterlight-display-panel">
      <span class="kicker">Display settings</span>
      <h2>How much interface?</h2>
      <p>Choose a calm default, a focused listening view, or a clean canvas. Moving the pointer or using the keyboard always brings controls back.</p>
      <div class="afterlight-display-group" role="radiogroup" aria-label="Display mode">
        <label class="afterlight-display-choice"><input type="radio" name="afterlightDisplayMode" value="default"><span><strong>Default</strong><small>Room information and listening controls stay available.</small></span></label>
        <label class="afterlight-display-choice"><input type="radio" name="afterlightDisplayMode" value="focus"><span><strong>Focus</strong><small>After idle, keep the player and artwork; hide room copy and navigation.</small></span></label>
        <label class="afterlight-display-choice"><input type="radio" name="afterlightDisplayMode" value="canvas"><span><strong>Canvas</strong><small>After idle, leave only the room artwork. Activity restores everything.</small></span></label>
      </div>
      <div class="afterlight-display-row"><label for="afterlightAutoHide">Hide after 5 seconds</label><input id="afterlightAutoHide" type="checkbox"></div>
      <div class="afterlight-display-actions"><button id="afterlightFullscreen" type="button">Fullscreen</button><button id="afterlightDisplayClose" class="secondary" type="button">Done</button></div>
      <p class="afterlight-shortcuts">Keyboard: <strong>V</strong> = another view · <strong>D</strong> = display settings</p>
    </div>`;
    document.body.appendChild(dialog);
    dialog.querySelectorAll('input[name="afterlightDisplayMode"]').forEach(input=>input.addEventListener('change',event=>setMode(event.target.value)));
    dialog.querySelector('#afterlightAutoHide').addEventListener('change',event=>setAutoHide(event.target.checked));
    dialog.querySelector('#afterlightFullscreen').addEventListener('click',toggleFullscreen);
    dialog.querySelector('#afterlightDisplayClose').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
  }

  function openSettings(){
    ensureDialog();
    applyDisplayMode();
    const dialog=document.getElementById('afterlightDisplayDialog');
    if(dialog&&!dialog.open)dialog.showModal();
  }

  function handleKey(event){
    const target=event.target;
    if(target&&(/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)||target.isContentEditable))return;
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key.toLowerCase()==='v'){event.preventDefault();nextView()}
    else if(event.key.toLowerCase()==='d'){event.preventDefault();openSettings()}
    noteActivity();
  }

  function bindActivity(){
    for(const name of ['pointermove','pointerdown','touchstart','wheel'])window.addEventListener(name,noteActivity,{passive:true});
    window.addEventListener('keydown',handleKey);
  }

  function observeRoom(){
    const title=document.getElementById('title');
    if(!title)return;
    new MutationObserver(()=>{
      ensureOverlay();
      ensureButtons();
      requestAnimationFrame(()=>applyView(currentView()));
      scheduleIdle();
    }).observe(title,{childList:true,subtree:true,characterData:true});
  }

  function init(){
    injectStyle();
    ensureOverlay();
    ensureButtons();
    ensureDialog();
    bindActivity();
    observeRoom();
    applyDisplayMode();
    applyView(currentView());
    window.__afterlightVisualViews={
      nextView,
      setView,
      setMode,
      setAutoHide,
      openSettings,
      getState:()=>({mode:prefs.mode,autoHide:prefs.autoHide,view:currentView(),room:roomKey()})
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();

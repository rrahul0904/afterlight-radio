import { chromium, firefox, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base=process.env.BASE_URL||'https://afterlight-radio.vercel.app';
const targets=[
  ['chromium-desktop',chromium,{viewport:{width:1440,height:900}}],
  ['firefox-desktop',firefox,{viewport:{width:1440,height:900}}],
  ['webkit-desktop',webkit,{viewport:{width:1440,height:900}}],
  ['chromium-mobile',chromium,{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],
  ['webkit-mobile',webkit,{viewport:{width:390,height:844},isMobile:true,hasTouch:true}]
];
const shotDir='test-artifacts/screenshots';
await mkdir(shotDir,{recursive:true});

function expectedSignedOutNoise(message){
  return /failed to load resource:.*\b401\b/i.test(message)||/\/api\/me due to access control checks/i.test(message);
}

async function playbackState(page){
  return page.evaluate(()=>({
    bodyPlaying:document.body.classList.contains('is-playing'),
    status:document.querySelector('#status')?.textContent||'',
    toast:document.querySelector('#toast')?.textContent||'',
    paused:audio.paused,
    ended:audio.ended,
    currentTime:audio.currentTime,
    duration:Number.isFinite(audio.duration)?audio.duration:null,
    readyState:audio.readyState,
    networkState:audio.networkState,
    currentSrc:audio.currentSrc,
    error:audio.error?{code:audio.error.code,message:audio.error.message}:null,
    wavSupport:audio.canPlayType('audio/wav')
  }));
}

async function sceneState(page){
  return page.evaluate(()=>{
    const host=document.querySelector('#paintedScene'),svg=host?.querySelector('svg');
    return {
      room:host?.dataset.room||null,
      label:svg?.getAttribute('aria-label')||null,
      preserveAspectRatio:svg?.getAttribute('preserveAspectRatio')||null,
      width:svg?.getBoundingClientRect().width||0,
      height:svg?.getBoundingClientRect().height||0
    };
  });
}

let failed=false;
for(const [name,type,contextOptions] of targets){
  const browser=await type.launch({headless:true});
  const context=await browser.newContext(contextOptions);
  const page=await context.newPage();
  const errors=[];
  let deliberateOffline=false;
  const expectedOfflineNoise=message=>deliberateOffline&&/Failed to load resource: net::ERR_(?:INTERNET_DISCONNECTED|FAILED)/i.test(message);
  page.on('pageerror',e=>{if(!expectedSignedOutNoise(e.message)&&!expectedOfflineNoise(e.message))errors.push('pageerror: '+e.message)});
  page.on('console',m=>{if(m.type()==='error'&&!expectedSignedOutNoise(m.text())&&!expectedOfflineNoise(m.text()))errors.push('console: '+m.text())});
  try{
    let r=await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:20000});
    if(!r?.ok())throw new Error('home status '+r?.status());
    await page.locator('.brand').first().waitFor({state:'visible',timeout:8000});
    const body=(await page.locator('body').innerText()).toLowerCase();
    if(!body.includes('afterlight'))throw new Error('brand missing on home');
    await page.locator('#homeGrid .home-card[data-room="rooftop"]').waitFor({state:'visible',timeout:5000});
    const homeAccount=page.locator('#homeAccount');
    await homeAccount.waitFor({state:'visible',timeout:5000});
    if(name.includes('mobile')){
      const box=await homeAccount.boundingBox();
      if(!box||box.width<40||box.height<40)throw new Error('mobile discovery account touch target is too small '+JSON.stringify(box));
    }
    await page.screenshot({path:`${shotDir}/${name}-discovery.png`,fullPage:true});
    await homeAccount.click();
    await page.locator('#googleAuthMain').waitFor({state:'visible',timeout:5000});
    await page.locator('#accountClose').click();

    r=await page.goto(base+'/rooftop/',{waitUntil:'domcontentloaded',timeout:20000});
    if(!r?.ok())throw new Error('rooftop status '+r?.status());
    await page.locator('#play').waitFor({state:'visible',timeout:8000});
    await page.locator('#paintedScene svg').waitFor({state:'visible',timeout:8000});
    let scene=await sceneState(page);
    if(scene.room!=='rooftop'||scene.label!=='Rooftop at sundown'||scene.width<300||scene.height<300)throw new Error('rooftop artwork failed '+JSON.stringify(scene));
    if(name.includes('mobile')&&scene.preserveAspectRatio!=='xMidYMid slice')throw new Error('mobile artwork is not full-bleed '+JSON.stringify(scene));
    await page.screenshot({path:`${shotDir}/${name}-rooftop.png`,fullPage:true});
    const account=page.locator('#accountBtn');
    await account.waitFor({state:'visible',timeout:5000});
    if(name.includes('mobile')){
      const box=await account.boundingBox();
      if(!box||box.width<40||box.height<40)throw new Error('mobile account touch target is too small '+JSON.stringify(box));
    }
    await account.click();
    await page.locator('#googleAuthMain').waitFor({state:'visible',timeout:5000});
    if(!(await page.locator('#googleAuthMain').innerText()).includes('Continue with Google'))throw new Error('main Google auth button copy missing');
    await page.screenshot({path:`${shotDir}/${name}-auth-modal.png`,fullPage:true});
    await page.locator('#accountClose').click();

    await page.locator('#focusModeBtn').waitFor({state:'visible',timeout:5000});
    await page.locator('#focusModeBtn').click();
    await page.locator('#focusRoomDialog').waitFor({state:'visible',timeout:5000});
    await page.locator('#todoInput').fill('Browser linked todo');
    await page.locator('#todoAdd').click();
    await page.locator('[data-todo-use]').first().click();
    if((await page.locator('#focusTask').inputValue())!=='Browser linked todo')throw new Error('todo did not populate focus task');
    const todoBefore=await page.evaluate(()=>{
      const state=JSON.parse(localStorage.getItem('afterlight-radio:focus-room:v1')||'{}');
      return state.todos?.[0]||null;
    });
    if(!todoBefore?.id||todoBefore.title!=='Browser linked todo'||todoBefore.completedAt)throw new Error('todo did not persist locally '+JSON.stringify(todoBefore));
    await page.locator('#focusStartOpen').click();
    await page.waitForTimeout(1200);
    const focusRunning=await page.evaluate(()=>({
      active:document.querySelector('#focusModeBtn')?.classList.contains('active'),
      stored:JSON.parse(localStorage.getItem('afterlight-radio:focus-active:v1')||'null'),
      state:JSON.parse(localStorage.getItem('afterlight-radio:focus-room:v1')||'{}')
    }));
    if(!focusRunning.active||!focusRunning.stored||focusRunning.stored.task!=='Browser linked todo'||focusRunning.stored.todoId!==todoBefore.id||focusRunning.stored.focusedSeconds<=0){
      throw new Error('focus session did not persist todo linkage locally '+JSON.stringify(focusRunning));
    }
    await page.locator('#ambientBrown').fill('35');
    const ambient=await page.evaluate(()=>JSON.parse(localStorage.getItem('afterlight-radio:focus-room:v1')||'{}').ambient?.brown);
    if(Math.abs((ambient||0)-0.35)>.01)throw new Error('ambient mix did not persist locally '+ambient);
    await page.screenshot({path:`${shotDir}/${name}-focus-mode.png`,fullPage:true});
    await page.locator('#focusFinish').click();
    await page.locator('[data-todo-toggle]').first().click();
    const focusDone=await page.evaluate(()=>({
      active:localStorage.getItem('afterlight-radio:focus-active:v1'),
      state:JSON.parse(localStorage.getItem('afterlight-radio:focus-room:v1')||'{}')
    }));
    if(focusDone.active||!focusDone.state.sessions?.length||focusDone.state.sessions[0].task!=='Browser linked todo'||focusDone.state.sessions[0].todoId!==todoBefore.id||!focusDone.state.todos?.[0]?.completedAt){
      throw new Error('focus/todo linkage did not finish into local history '+JSON.stringify(focusDone));
    }
    await page.locator('#focusTask').fill('Unlinked follow-up');
    await page.locator('#focusStartOpen').click();
    await page.waitForTimeout(200);
    const followUp=await page.evaluate(()=>JSON.parse(localStorage.getItem('afterlight-radio:focus-active:v1')||'null'));
    if(!followUp||followUp.todoId!==null)throw new Error('completed todo leaked into later focus session '+JSON.stringify(followUp));
    await page.locator('#focusFinish').click();
    await page.locator('#focusRoomClose').click();

    r=await page.goto(base+'/window/',{waitUntil:'domcontentloaded',timeout:20000});
    if(!r?.ok())throw new Error('window status '+r?.status());
    await page.locator('#paintedScene svg').waitFor({state:'visible',timeout:8000});
    scene=await sceneState(page);
    if(scene.room!=='window'||scene.label!=='Rainy window seat')throw new Error('window artwork failed '+JSON.stringify(scene));
    if(name.includes('mobile')&&scene.preserveAspectRatio!=='xMidYMid slice')throw new Error('window mobile artwork is not full-bleed '+JSON.stringify(scene));
    await page.screenshot({path:`${shotDir}/${name}-window.png`,fullPage:true});

    r=await page.goto(base+'/rooftop/',{waitUntil:'domcontentloaded',timeout:20000});
    if(!r?.ok())throw new Error('rooftop return status '+r?.status());
    await page.locator('#play').waitFor({state:'visible',timeout:8000});
    const wav=await page.evaluate(async()=>{const r=await fetch('/audio/rooftop/1.wav',{method:'GET'});return {status:r.status,type:r.headers.get('content-type'),bytes:(await r.arrayBuffer()).byteLength}});
    if(![200,206].includes(wav.status)||!/^audio\//i.test(wav.type||'')||wav.bytes<1000000)throw new Error('WAV failed '+JSON.stringify(wav));
    const support=await page.evaluate(()=>audio.canPlayType('audio/wav'));
    if(!support)throw new Error('browser reports no WAV support');
    await page.locator('#play').click({timeout:8000});
    try{
      await page.waitForFunction(()=>document.body.classList.contains('is-playing')&&!audio.paused&&audio.currentTime>0,{timeout:6000});
    }catch{
      throw new Error('Play control did not enter playing state: '+JSON.stringify(await playbackState(page)));
    }

    await page.locator('#queueBtn').click();
    await page.locator('#queueDialog').waitFor({state:'visible',timeout:5000});
    await page.locator('#queueShuffle').click();
    await page.locator('#queueRepeat').click();
    const queueState=await page.evaluate(()=>window.__afterlightQueue?.getState());
    if(!queueState?.shuffle||queueState.repeat!=='one'||!queueState.history?.length)throw new Error('queue state/history did not persist locally '+JSON.stringify(queueState));
    await page.locator('#queueClose').click();

    if(name==='chromium-desktop'){
      await page.locator('#libraryBtn').click();
      await page.locator('#libraryBrowser').waitFor({state:'visible',timeout:5000});
      const catalogCount=await page.evaluate(()=>window.__afterlightCatalog?.count);
      if(catalogCount!==36)throw new Error('owned catalog should contain 36 tracks, got '+catalogCount);
      await page.locator('#librarySearch').fill('orange parapet');
      const libraryRows=page.locator('#libraryResults [data-library-track]');
      if(await libraryRows.count()!==1)throw new Error('library search did not narrow to one owned track');
      if(!(await libraryRows.first().innerText()).includes('Orange on the parapet'))throw new Error('library search returned the wrong track');
      await page.locator('#libraryClose').click();

      await page.locator('#offlineRoom').click();
      await page.waitForFunction(()=>document.querySelector('#offlineRoom')?.getAttribute('aria-pressed')==='true',{timeout:20000});
      const packageState=await page.evaluate(async()=>({
        saved:await window.__afterlightLibrary?.isRoomOffline(),
        packageUrls:window.__afterlightLibrary?.offlinePackageUrls('rooftop')||[],
        shellUrls:window.__afterlightLibrary?.shellUrls||[]
      }));
      if(!packageState.saved)throw new Error('room did not report offline after explicit save');
      if(packageState.packageUrls.length<12||packageState.shellUrls.length<8)throw new Error('offline package is missing runtime shell assets '+JSON.stringify(packageState));

      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:8000});
      const cdp=await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
      deliberateOffline=true;
      await context.setOffline(true);
      try{
        const offlineNav=await page.goto(base+'/rooftop/',{waitUntil:'domcontentloaded',timeout:12000});
        if(!offlineNav?.ok())throw new Error('offline cold navigation status '+offlineNav?.status());
        await page.locator('#queueBtn').waitFor({state:'visible',timeout:5000});
        await page.locator('#libraryBtn').waitFor({state:'visible',timeout:5000});
        const offlineRuntime=await page.evaluate(async()=>{
          let networkProbeFailed=false;
          try{await fetch('/__offline_probe__?t='+Date.now(),{cache:'no-store'})}catch{networkProbeFailed=true}
          const shell=await fetch('/library-browser.js?v=offline2',{cache:'reload'});
          const range=await fetch('/audio/rooftop/1.wav',{headers:{Range:'bytes=100-199'},cache:'reload'});
          return {
            networkProbeFailed,
            controlled:!!navigator.serviceWorker.controller,
            shellStatus:shell.status,
            shellBytes:(await shell.arrayBuffer()).byteLength,
            rangeStatus:range.status,
            rangeLength:(await range.arrayBuffer()).byteLength,
            contentRange:range.headers.get('content-range'),
            catalog:window.__afterlightCatalog?.count||0,
            queue:!!window.__afterlightQueue
          };
        });
        if(!offlineRuntime.networkProbeFailed||!offlineRuntime.controlled||offlineRuntime.shellStatus!==200||offlineRuntime.shellBytes<1000||offlineRuntime.catalog!==36||!offlineRuntime.queue){
          throw new Error('cold offline runtime shell failed '+JSON.stringify(offlineRuntime));
        }
        if(offlineRuntime.rangeStatus!==206||offlineRuntime.rangeLength!==100||offlineRuntime.contentRange!=='bytes 100-199/1755472'){
          throw new Error('cold offline cached range playback failed '+JSON.stringify(offlineRuntime));
        }
      }finally{
        await context.setOffline(false);
        deliberateOffline=false;
        await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});
      }
    }

    if(name==='firefox-desktop'){
      await page.waitForTimeout(12000);
      const sustained=await playbackState(page);
      if(!sustained.bodyPlaying||sustained.paused||sustained.currentTime<=0)throw new Error('Firefox did not sustain playback: '+JSON.stringify(sustained));
      if(/MediaSink|audio output|AudioSink/i.test(sustained.error?.message||'')&&!/CHECK AUDIO OUTPUT/.test(sustained.status)){
        throw new Error('Firefox output-sink error was not surfaced correctly: '+JSON.stringify(sustained));
      }
    }

    r=await page.goto(base+'/account/',{waitUntil:'domcontentloaded',timeout:20000});
    if(!r?.ok())throw new Error('account status '+r?.status());
    if((await page.title())!=='Your Afterlight')throw new Error('account title mismatch: '+await page.title());
    await page.locator('#signedOut').waitFor({state:'attached',timeout:8000});
    await page.locator('#signedIn').waitFor({state:'attached',timeout:8000});
    await page.locator('#loginForm').waitFor({state:'attached',timeout:8000});
    await page.locator('#googleAuthAccount').waitFor({state:'visible',timeout:5000});
    await page.screenshot({path:`${shotDir}/${name}-account.png`,fullPage:true});

    let oauthPayload=null;
    await page.route('**/api/auth/sign-in/social',async route=>{
      try{oauthPayload=route.request().postDataJSON()}catch{}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({url:base+'/account/?oauth=google-test'})});
    });
    await page.locator('#googleAuthAccount').click();
    await page.waitForURL('**/account/?oauth=google-test',{timeout:8000,waitUntil:'domcontentloaded'});
    if(oauthPayload?.provider!=='google'||oauthPayload?.callbackURL!=='/account/')throw new Error('Google OAuth initiation payload mismatch '+JSON.stringify(oauthPayload));

    if(errors.length)throw new Error(errors.join(' | '));
    console.log('PASS',name,'discovery auth','artwork',scene.room,'Google OAuth','WAV',wav.status,wav.bytes+' bytes');
  }catch(error){
    failed=true;console.error('FAIL',name,error.message);
    try{await page.screenshot({path:`${shotDir}/${name}-failure.png`,fullPage:true})}catch{}
  }finally{await context.close();await browser.close()}
}
if(failed)process.exit(1);

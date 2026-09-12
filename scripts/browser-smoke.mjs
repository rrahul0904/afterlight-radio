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
  page.on('pageerror',e=>{if(!expectedSignedOutNoise(e.message))errors.push('pageerror: '+e.message)});
  page.on('console',m=>{if(m.type()==='error'&&!expectedSignedOutNoise(m.text()))errors.push('console: '+m.text())});
  try{
    let r=await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:20000});
    if(!r?.ok())throw new Error('home status '+r?.status());
    await page.locator('.brand').first().waitFor({state:'visible',timeout:8000});
    const body=(await page.locator('body').innerText()).toLowerCase();
    if(!body.includes('afterlight'))throw new Error('brand missing on home');

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
    await page.waitForURL('**/account/?oauth=google-test',{timeout:8000});
    if(oauthPayload?.provider!=='google'||oauthPayload?.callbackURL!=='/account/')throw new Error('Google OAuth initiation payload mismatch '+JSON.stringify(oauthPayload));

    if(errors.length)throw new Error(errors.join(' | '));
    console.log('PASS',name,'artwork',scene.room,'Google OAuth','WAV',wav.status,wav.bytes+' bytes');
  }catch(error){
    failed=true;console.error('FAIL',name,error.message);
    try{await page.screenshot({path:`${shotDir}/${name}-failure.png`,fullPage:true})}catch{}
  }finally{await context.close();await browser.close()}
}
if(failed)process.exit(1);

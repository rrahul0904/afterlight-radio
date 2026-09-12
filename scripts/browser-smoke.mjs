import { chromium, firefox, webkit } from 'playwright';

const base=process.env.BASE_URL||'https://afterlight-radio.vercel.app';
const targets=[
  ['chromium-desktop',chromium,{viewport:{width:1440,height:900}}],
  ['firefox-desktop',firefox,{viewport:{width:1440,height:900}}],
  ['webkit-desktop',webkit,{viewport:{width:1440,height:900}}],
  ['chromium-mobile',chromium,{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],
  ['webkit-mobile',webkit,{viewport:{width:390,height:844},isMobile:true,hasTouch:true}]
];

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
    const wav=await page.evaluate(async()=>{const r=await fetch('/audio/rooftop/1.wav',{method:'GET'});return {status:r.status,type:r.headers.get('content-type'),bytes:(await r.arrayBuffer()).byteLength}});
    if(![200,206].includes(wav.status)||!/^audio\//i.test(wav.type||'')||wav.bytes<500000)throw new Error('WAV failed '+JSON.stringify(wav));
    const support=await page.evaluate(()=>audio.canPlayType('audio/wav'));
    if(!support)throw new Error('browser reports no WAV support');
    await page.locator('#play').click({timeout:8000});
    try{
      await page.waitForFunction(()=>document.body.classList.contains('is-playing')&&!audio.paused,{timeout:6000});
    }catch{
      throw new Error('Play control did not enter playing state: '+JSON.stringify(await playbackState(page)));
    }

    if(name==='firefox-desktop'){
      await page.waitForTimeout(12000);
      const sustained=await playbackState(page);
      if(!sustained.bodyPlaying||sustained.paused)throw new Error('Firefox did not sustain playback: '+JSON.stringify(sustained));
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

    if(errors.length)throw new Error(errors.join(' | '));
    console.log('PASS',name,'WAV',wav.status,wav.bytes+' bytes');
  }catch(error){
    failed=true;console.error('FAIL',name,error.message);
  }finally{await context.close();await browser.close()}
}
if(failed)process.exit(1);

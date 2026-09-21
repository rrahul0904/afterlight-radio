import { chromium } from 'playwright';

const base=(process.env.BASE_URL||'').replace(/\/$/,'');
if(!base)throw new Error('BASE_URL is required');

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const page=await context.newPage();

try{
  const response=await page.goto(base+'/rooftop/',{waitUntil:'domcontentloaded',timeout:30000});
  if(!response?.ok())throw new Error('hosted rooftop status '+response?.status());

  await page.locator('#offlineRoom').waitFor({state:'visible',timeout:10000});
  await page.locator('#offlineRoom').click();
  await page.waitForFunction(()=>document.querySelector('#offlineRoom')?.getAttribute('aria-pressed')==='true',{timeout:30000});

  const packageState=await page.evaluate(async()=>({
    saved:await window.__afterlightLibrary?.isRoomOffline(),
    packageUrls:window.__afterlightLibrary?.offlinePackageUrls('rooftop')||[],
    catalog:window.__afterlightCatalog?.count||0,
    queue:!!window.__afterlightQueue
  }));
  if(!packageState.saved||packageState.packageUrls.length<12||packageState.catalog!==36||!packageState.queue){
    throw new Error('hosted offline package incomplete '+JSON.stringify(packageState));
  }

  await page.evaluate(()=>{
    localStorage.setItem('afterlight-radio:playback-memory:v1',JSON.stringify({
      source:'/audio/rooftop/1.wav',
      position:8,
      duration:27,
      room:'rooftop',
      savedAt:Date.now()
    }));
  });

  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:10000});

  const cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await context.setOffline(true);

  try{
    const offline=await page.goto(base+'/rooftop/',{waitUntil:'domcontentloaded',timeout:15000});
    if(!offline?.ok())throw new Error('hosted cold-offline navigation status '+offline?.status());

    await page.locator('#libraryBtn').waitFor({state:'visible',timeout:8000});
    await page.locator('#queueBtn').waitFor({state:'visible',timeout:8000});

    const state=await page.evaluate(async()=>{
      const shell=await fetch('/library-browser.js',{cache:'reload'});
      const range=await fetch('/audio/rooftop/1.wav',{headers:{Range:'bytes=100-199'},cache:'reload'});
      await new Promise(resolve=>{
        if(Number.isFinite(audio.duration)&&audio.duration>0)return resolve();
        const done=()=>{audio.removeEventListener('loadedmetadata',done);resolve()};
        audio.addEventListener('loadedmetadata',done,{once:true});
        setTimeout(done,5000);
      });
      return {
        online:navigator.onLine,
        controlled:!!navigator.serviceWorker.controller,
        shellStatus:shell.status,
        shellBytes:(await shell.arrayBuffer()).byteLength,
        rangeStatus:range.status,
        rangeLength:(await range.arrayBuffer()).byteLength,
        contentRange:range.headers.get('content-range'),
        catalog:window.__afterlightCatalog?.count||0,
        queue:!!window.__afterlightQueue,
        resumedAt:Number(audio.currentTime||0),
        duration:Number.isFinite(audio.duration)?audio.duration:0
      };
    });

    if(state.online||!state.controlled||state.shellStatus!==200||state.shellBytes<1000||state.catalog!==36||!state.queue){
      throw new Error('hosted cold-offline shell failed '+JSON.stringify(state));
    }
    if(state.rangeStatus!==206||state.rangeLength!==100||!/bytes 100-199\//.test(state.contentRange||'')){
      throw new Error('hosted cached range failed '+JSON.stringify(state));
    }
    if(state.duration<=0||state.resumedAt<7){
      throw new Error('hosted playback resume failed '+JSON.stringify(state));
    }

    console.log('PASS hosted cold-offline exact deployment',JSON.stringify(state));
  }finally{
    await context.setOffline(false);
    await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});
  }
}finally{
  await context.close();
  await browser.close();
}

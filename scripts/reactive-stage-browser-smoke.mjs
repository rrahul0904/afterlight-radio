import { chromium, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const shotDir='test-artifacts/screenshots';
await mkdir(shotDir,{recursive:true});

const targets=[
  ['chromium-reactive-stage',chromium,{viewport:{width:1440,height:900}}],
  ['webkit-mobile-reactive-stage',webkit,{viewport:{width:390,height:844},isMobile:true,hasTouch:true}]
];

function wavBuffer(){
  const rate=8000,samples=rate/4,dataBytes=samples*2;
  const b=Buffer.alloc(44+dataBytes);
  b.write('RIFF',0);b.writeUInt32LE(36+dataBytes,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);
  b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);
  b.write('data',36);b.writeUInt32LE(dataBytes,40);
  for(let i=0;i<samples;i++)b.writeInt16LE(Math.round(Math.sin(i/12)*8000),44+i*2);
  return b;
}

let failed=false;
for(const [name,type,contextOptions] of targets){
  const browser=await type.launch({headless:true});
  const context=await browser.newContext(contextOptions);
  const page=await context.newPage();
  const errors=[];
  const requests=[];
  page.on('pageerror',error=>errors.push('pageerror: '+error.message));
  page.on('console',message=>{if(message.type()==='error'&&!/\b401\b/.test(message.text()))errors.push('console: '+message.text())});
  page.on('request',request=>requests.push({url:request.url(),postData:request.postData()||''}));

  try{
    const response=await page.goto(base+'/rooftop/',{waitUntil:'domcontentloaded',timeout:20000});
    if(!response?.ok())throw new Error('rooftop status '+response?.status());
    await page.locator('#play').waitFor({state:'visible',timeout:8000});
    await page.locator('#reactiveStageBtn').waitFor({state:'visible',timeout:8000});
    await page.locator('#reactivePresetBtn').waitFor({state:'visible',timeout:8000});
    await page.locator('#localSongBtn').waitFor({state:'visible',timeout:8000});

    const decorative=await page.evaluate(()=>{
      const canvas=document.getElementById('afterlightReactiveStage');
      const style=getComputedStyle(canvas);
      return {pointer:style.pointerEvents,select:style.userSelect,aria:canvas.getAttribute('aria-hidden')};
    });
    if(decorative.pointer!=='none'||decorative.select!=='none'||decorative.aria!=='true')throw new Error('canvas input/a11y contract failed '+JSON.stringify(decorative));

    await page.locator('#play').click();
    await page.waitForFunction(()=>!audio.paused&&audio.currentTime>0,{timeout:8000});
    const before=await page.evaluate(()=>({src:audio.currentSrc||audio.src,time:audio.currentTime,paused:audio.paused}));

    await page.locator('#reactiveStageBtn').click();
    await page.waitForFunction(()=>window.__afterlightReactiveStage?.getState().analyserReady===true,{timeout:5000});
    await page.waitForFunction(()=>window.__afterlightReactiveStage?.getState().frames>2,{timeout:5000});
    const active=await page.evaluate(()=>({state:window.__afterlightReactiveStage.getState(),src:audio.currentSrc||audio.src,time:audio.currentTime,paused:audio.paused,body:document.body.dataset.reactiveStage}));
    if(active.body!=='true'||!active.state.enabled||active.src!==before.src||active.paused||active.time<=before.time)throw new Error('stage toggle changed playback '+JSON.stringify({before,active}));

    const presetBefore=active.state.preset;
    await page.locator('#reactivePresetBtn').click();
    const presetAfter=await page.evaluate(()=>window.__afterlightReactiveStage.getState().preset);
    if(presetAfter===presetBefore)throw new Error('preset did not change');
    const afterPreset=await page.evaluate(()=>({src:audio.currentSrc||audio.src,time:audio.currentTime,paused:audio.paused}));
    if(afterPreset.src!==before.src||afterPreset.paused||afterPreset.time<=active.time)throw new Error('preset changed playback '+JSON.stringify(afterPreset));

    const privateName='PRIVATE-LOCAL-SONG-NEVER-SEND.wav';
    const requestIndex=requests.length;
    await page.locator('#localSongInput').setInputFiles({name:privateName,mimeType:'audio/wav',buffer:wavBuffer()});
    await page.waitForFunction(()=>window.__afterlightReactiveStage?.getState().localActive===true,{timeout:3000});
    const local=await page.evaluate(()=>({state:window.__afterlightReactiveStage.getState(),src:audio.src,track:document.getElementById('track')?.textContent,status:document.getElementById('status')?.textContent}));
    if(!local.src.startsWith('blob:')||local.track!==privateName||!local.state.localActive||local.state.localName!==privateName)throw new Error('local audition contract failed '+JSON.stringify(local));
    const leaked=requests.slice(requestIndex).some(request=>request.url.includes(privateName)||request.postData.includes(privateName));
    if(leaked)throw new Error('private local filename appeared in network request');

    await page.locator('#localSongBtn').click();
    await page.waitForFunction(()=>window.__afterlightReactiveStage?.getState().localActive===false,{timeout:3000});
    await page.waitForFunction(()=>/\/audio\/rooftop\/1\.wav$/.test(audio.src),{timeout:3000});

    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>window.__afterlightReactiveStage?.getState().reducedMotion===true,{timeout:2000});
    const reduced=await page.evaluate(()=>({state:window.__afterlightReactiveStage.getState(),transition:getComputedStyle(document.getElementById('afterlightReactiveStage')).transitionDuration}));
    if(!reduced.state.lowPower||!reduced.transition.split(',').every(value=>value.trim()==='0s'))throw new Error('reduced-motion contract failed '+JSON.stringify(reduced));

    await page.screenshot({path:`${shotDir}/${name}.png`,fullPage:true});
    if(errors.length)throw new Error('browser console errors: '+errors.join(' | '));
    console.log(name+' reactive stage OK');
  }catch(error){
    failed=true;
    console.error(name+' FAILED:',error?.stack||error);
  }finally{
    await browser.close();
  }
}

if(failed)process.exit(1);

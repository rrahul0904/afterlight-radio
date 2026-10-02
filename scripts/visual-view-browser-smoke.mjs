import { chromium, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const shotDir='test-artifacts/screenshots';
await mkdir(shotDir,{recursive:true});

const targets=[
  ['chromium-visual-view',chromium,{viewport:{width:1440,height:900}}],
  ['webkit-mobile-visual-view',webkit,{viewport:{width:390,height:844},isMobile:true,hasTouch:true}]
];

const playback=page=>page.evaluate(()=>({
  src:audio.currentSrc,
  time:audio.currentTime,
  paused:audio.paused,
  ended:audio.ended,
  view:document.getElementById('paintedScene')?.dataset.afterlightView||null,
  mode:document.body.dataset.displayMode||null,
  idle:document.body.classList.contains('visual-idle')
}));

let failed=false;
for(const [name,type,contextOptions] of targets){
  const browser=await type.launch({headless:true});
  const context=await browser.newContext(contextOptions);
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push('pageerror: '+error.message));
  page.on('console',message=>{
    if(message.type()==='error'&&!/\b401\b/.test(message.text()))errors.push('console: '+message.text());
  });
  try{
    const response=await page.goto(base+'/rooftop/',{waitUntil:'domcontentloaded',timeout:20000});
    if(!response?.ok())throw new Error('rooftop status '+response?.status());
    await page.locator('#play').waitFor({state:'visible',timeout:8000});
    await page.locator('#paintedScene svg').waitFor({state:'visible',timeout:8000});
    await page.locator('#anotherViewBtn').waitFor({state:'visible',timeout:8000});
    await page.locator('#displaySettingsBtn').waitFor({state:'visible',timeout:8000});

    const pointerContract=await page.evaluate(()=>{
      const painted=document.getElementById('paintedScene');
      const overlay=document.getElementById('afterlightViewOverlay');
      const paintedStyle=getComputedStyle(painted);
      const overlayStyle=getComputedStyle(overlay);
      return {
        paintedPointer:paintedStyle.pointerEvents,
        paintedSelect:paintedStyle.userSelect,
        overlayPointer:overlayStyle.pointerEvents,
        overlaySelect:overlayStyle.userSelect
      };
    });
    if(pointerContract.paintedPointer!=='none'||pointerContract.overlayPointer!=='none'||pointerContract.paintedSelect!=='none'||pointerContract.overlaySelect!=='none'){
      throw new Error('decorative view layer intercepts input '+JSON.stringify(pointerContract));
    }

    await page.locator('#play').click();
    await page.waitForFunction(()=>!audio.paused&&audio.currentTime>0,{timeout:8000});
    const before=await playback(page);
    if(!before.src||before.paused)throw new Error('playback did not start '+JSON.stringify(before));

    await page.locator('#anotherViewBtn').click();
    await page.waitForFunction(()=>document.getElementById('paintedScene')?.dataset.afterlightView==='closer',{timeout:3000});
    await page.waitForTimeout(450);
    const after=await playback(page);
    if(after.src!==before.src||after.paused!==before.paused||after.ended||after.time<=before.time){
      throw new Error('view change altered playback continuity '+JSON.stringify({before,after}));
    }
    const toast=await page.locator('#toast').innerText();
    if(!/music keeps playing/i.test(toast))throw new Error('view continuity copy missing: '+toast);

    await page.keyboard.press('v');
    await page.waitForFunction(()=>document.getElementById('paintedScene')?.dataset.afterlightView==='soft-glow',{timeout:3000});
    const keyboardView=await playback(page);
    if(keyboardView.src!==before.src||keyboardView.paused)throw new Error('V shortcut altered playback '+JSON.stringify(keyboardView));

    await page.keyboard.press('d');
    await page.locator('#afterlightDisplayDialog').waitFor({state:'visible',timeout:3000});
    await page.locator('input[name="afterlightDisplayMode"][value="focus"]').check();
    await page.locator('#afterlightAutoHide').check();
    await page.locator('#afterlightDisplayClose').click();
    await page.waitForFunction(()=>document.body.classList.contains('visual-idle'),{timeout:6500});
    const focusIdle=await page.evaluate(()=>({
      idle:document.body.classList.contains('visual-idle'),
      mode:document.body.dataset.displayMode,
      copyOpacity:getComputedStyle(document.querySelector('.copy')).opacity,
      playerOpacity:getComputedStyle(document.querySelector('.player')).opacity
    }));
    if(!focusIdle.idle||focusIdle.mode!=='focus'||focusIdle.copyOpacity!=='0'||focusIdle.playerOpacity==='0'){
      throw new Error('focus idle contract failed '+JSON.stringify(focusIdle));
    }
    await page.mouse.move(25,25);
    await page.waitForFunction(()=>!document.body.classList.contains('visual-idle'),{timeout:2000});

    await page.keyboard.press('d');
    await page.locator('input[name="afterlightDisplayMode"][value="canvas"]').check();
    const viewBeforeInputKey=await page.evaluate(()=>document.getElementById('paintedScene')?.dataset.afterlightView);
    await page.locator('#afterlightAutoHide').focus();
    await page.keyboard.press('v');
    const viewAfterInputKey=await page.evaluate(()=>document.getElementById('paintedScene')?.dataset.afterlightView);
    if(viewAfterInputKey!==viewBeforeInputKey)throw new Error('shortcut hijacked input focus');
    await page.locator('#afterlightDisplayClose').click();
    await page.waitForFunction(()=>document.body.classList.contains('visual-idle'),{timeout:6500});
    const canvasIdle=await page.evaluate(()=>({
      mode:document.body.dataset.displayMode,
      playerOpacity:getComputedStyle(document.querySelector('.player')).opacity,
      topOpacity:getComputedStyle(document.querySelector('.top')).opacity
    }));
    if(canvasIdle.mode!=='canvas'||canvasIdle.playerOpacity!=='0'||canvasIdle.topOpacity!=='0'){
      throw new Error('canvas idle contract failed '+JSON.stringify(canvasIdle));
    }
    await page.screenshot({path:`${shotDir}/${name}-canvas.png`,fullPage:true});
    await page.mouse.move(50,50);
    await page.waitForFunction(()=>!document.body.classList.contains('visual-idle'),{timeout:2000});

    await page.emulateMedia({reducedMotion:'reduce'});
    const reduced=await page.evaluate(()=>({
      sceneTransition:getComputedStyle(document.getElementById('paintedScene')).transitionDuration,
      overlayTransition:getComputedStyle(document.getElementById('afterlightViewOverlay')).transitionDuration
    }));
    if(!reduced.sceneTransition.split(',').every(value=>value.trim()==='0s')||!reduced.overlayTransition.split(',').every(value=>value.trim()==='0s')){
      throw new Error('reduced-motion transition still active '+JSON.stringify(reduced));
    }

    const finalPlayback=await playback(page);
    if(finalPlayback.src!==before.src||finalPlayback.paused||finalPlayback.ended||finalPlayback.time<=after.time){
      throw new Error('display interactions altered playback '+JSON.stringify({before,after,finalPlayback}));
    }

    await page.evaluate(()=>localStorage.setItem('afterlight:visual-preferences:v1','{broken-json'));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#anotherViewBtn').waitFor({state:'visible',timeout:8000});
    const fallback=await page.evaluate(()=>window.__afterlightVisualViews?.getState());
    if(!fallback||fallback.mode!=='default'||fallback.autoHide!==false)throw new Error('malformed preference fallback failed '+JSON.stringify(fallback));

    if(errors.length)throw new Error('browser console errors: '+errors.join(' | '));
    console.log(name+' visual-view continuity OK');
  }catch(error){
    failed=true;
    console.error(name+' FAILED:',error?.stack||error);
  }finally{
    await browser.close();
  }
}

if(failed)process.exit(1);

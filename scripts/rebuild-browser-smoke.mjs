import { chromium, webkit } from 'playwright';

const base=(process.env.BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');

for(const [name,launcher] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await launcher.launch({headless:true});
  const page=await browser.newPage({viewport:{width:name==='webkit'?390:1280,height:name==='webkit'?844:900}});
  const failures=[];
  page.on('pageerror',error=>failures.push(`pageerror:${error.message}`));
  page.on('console',message=>{if(message.type()==='error')failures.push(`console:${message.text()}`)});
  await page.goto(`${base}/rebuild/?room=rooftop&track=1&view=0`,{waitUntil:'networkidle'});
  if(await page.locator('text=Nobody wants to go in.').count()!==1)throw new Error(`${name}: rooftop scene missing`);
  if(await page.locator('[data-room-choice]').count()!==4)throw new Error(`${name}: expected four flagship rooms`);
  if(await page.locator('#app').getAttribute('data-phase')!=='evening')throw new Error(`${name}: initial semantic evening view missing`);
  if(!(await page.locator('#view-state').textContent())?.includes('music keeps playing'))throw new Error(`${name}: visual-only continuity copy missing`);

  const before=await page.locator('#audio').getAttribute('src');
  await page.click('#another-view');
  const after=await page.locator('#audio').getAttribute('src');
  if(before!==after)throw new Error(`${name}: Another view changed audio source`);
  if(!page.url().includes('view=1'))throw new Error(`${name}: view state not reflected in URL`);
  if(await page.locator('#app').getAttribute('data-phase')!=='night')throw new Error(`${name}: Another view did not advance to night`);
  if(!(await page.locator('#view-state').textContent())?.startsWith('Night view'))throw new Error(`${name}: night view label missing`);

  await page.click('#another-view');
  if(await page.locator('#app').getAttribute('data-phase')!=='day')throw new Error(`${name}: second visual change did not advance to day`);
  if((await page.locator('#audio').getAttribute('src'))!==before)throw new Error(`${name}: day view changed audio source`);

  await page.click('[data-room-choice="window"]');
  await page.waitForFunction(()=>document.querySelector('#app')?.dataset.room==='window');
  const windowSource=await page.locator('#audio').getAttribute('src');
  if(!windowSource?.includes('/audio/window/1.wav'))throw new Error(`${name}: room-local music source not selected`);
  if(await page.locator('#app').getAttribute('data-phase')!=='evening')throw new Error(`${name}: room change did not reset visual state cleanly`);
  await page.click('#next');
  const nextSource=await page.locator('#audio').getAttribute('src');
  if(!nextSource?.includes('/audio/window/2.wav'))throw new Error(`${name}: next escaped room-local pool`);
  if(!page.url().includes('room=window')||!page.url().includes('track=2'))throw new Error(`${name}: exact room/track deep-link state missing`);
  for(const forbidden of ['Sign in','Upgrade','Dashboard']){
    if(await page.getByText(forbidden,{exact:true}).count())throw new Error(`${name}: leaked ${forbidden} into listening surface`);
  }
  if(failures.length)throw new Error(`${name}: ${failures.join(' | ')}`);
  await browser.close();
  console.log(`source-first rebuild browser smoke: ${name} PASS`);
}

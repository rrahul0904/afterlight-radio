import { chromium, webkit } from 'playwright';

const base=(process.env.BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const clearedCatalog=`window.AFTERLIGHT_REBUILD_CATALOG=${JSON.stringify({
  version:3,mode:'stage-a',
  rooms:{
    rooftop:{label:'ROOFTOP · TEST',title:'Nobody wants to go in.',copy:'Test rooftop.',mix:'sunset soul',tracks:[{id:'r1',title:'Cleared Rooftop',artist:'Test Artist',provider:'cleared',source:'/audio/curated/rooftop/test.wav',license:'CC BY 4.0 reviewed',attribution:'Test credit',mixWithAmbienceAllowed:false,mixWithPresenterAllowed:false}]},
    window:{label:'WINDOW · TEST',title:'Stay until your stop.',copy:'Test window.',mix:'rainy jazz',tracks:[{id:'w1',title:'Cleared Window',artist:'Window Artist',provider:'cleared',source:'/audio/curated/window/test.wav',license:'CC0 reviewed',attribution:'Window provenance',mixWithAmbienceAllowed:true,mixWithPresenterAllowed:false}]},
    headspace:{label:'HEADSPACE · TEST',title:'A little room in your head.',copy:'Test headspace.',mix:'focus piano',tracks:[{id:'h1',title:'Cleared Headspace',artist:'Head Artist',provider:'cleared',source:'/audio/curated/headspace/test.wav',license:'CC0 reviewed',mixWithAmbienceAllowed:true,mixWithPresenterAllowed:false}]},
    'last-bus':{label:'LAST BUS · TEST',title:'Home through the glass.',copy:'Test bus.',mix:'night ambient',tracks:[{id:'l1',title:'Cleared Last Bus',artist:'Bus Artist',provider:'cleared',source:'/audio/curated/last-bus/test.wav',license:'CC0 reviewed',mixWithAmbienceAllowed:true,mixWithPresenterAllowed:false}]}
  },providerContract:{cleared:{kind:'html-audio',rights:'receipt-bound-cleared-master'}}
})};`;

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
  if(await page.locator('#app').getAttribute('data-catalog-mode')!=='demo')throw new Error(`${name}: empty production manifest should render demo catalog mode`);
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

  const clearedPage=await browser.newPage({viewport:{width:name==='webkit'?390:1280,height:name==='webkit'?844:900}});
  const clearedFailures=[];
  clearedPage.on('pageerror',error=>clearedFailures.push(`pageerror:${error.message}`));
  await clearedPage.route('**/rebuild/catalog.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:clearedCatalog}));
  await clearedPage.route('**/audio/curated/**',route=>route.fulfill({status:200,contentType:'audio/wav',body:Buffer.from('RIFF----WAVEfmt ')}));
  await clearedPage.goto(`${base}/rebuild/?room=rooftop&track=1&view=0`,{waitUntil:'domcontentloaded'});
  await clearedPage.waitForFunction(()=>document.querySelector('#app')?.dataset.catalogMode==='stage-a');
  if(!(await clearedPage.locator('#audio').getAttribute('src'))?.includes('/audio/curated/rooftop/test.wav'))throw new Error(`${name}: cleared catalog did not select curated source`);
  if(!(await clearedPage.locator('#track-subtitle').textContent())?.includes('Test Artist'))throw new Error(`${name}: cleared track artist credit missing`);
  if(!(await clearedPage.locator('#track-subtitle').textContent())?.includes('CC BY 4.0 reviewed'))throw new Error(`${name}: cleared track license label missing`);
  if(!(await clearedPage.locator('#track-subtitle').getAttribute('title'))?.includes('Test credit'))throw new Error(`${name}: cleared attribution receipt not exposed`);
  if(!(await clearedPage.locator('#ambience').isDisabled()))throw new Error(`${name}: ambience stayed enabled when mixing rights were false`);
  await clearedPage.click('#another-view');
  if(!(await clearedPage.locator('#audio').getAttribute('src'))?.includes('/audio/curated/rooftop/test.wav'))throw new Error(`${name}: cleared audio changed on visual-only transition`);
  await clearedPage.click('[data-room-choice="window"]');
  await clearedPage.waitForFunction(()=>document.querySelector('#app')?.dataset.room==='window');
  if(await clearedPage.locator('#ambience').isDisabled())throw new Error(`${name}: ambience stayed disabled when window mixing rights were true`);
  if(clearedFailures.length)throw new Error(`${name} cleared-catalog: ${clearedFailures.join(' | ')}`);
  await clearedPage.close();

  await browser.close();
  console.log(`source-first rebuild browser smoke: ${name} PASS`);
}

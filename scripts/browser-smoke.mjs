import { chromium, firefox, webkit } from 'playwright';

const base=process.env.BASE_URL||'https://afterlight-radio.vercel.app';
const targets=[
  ['chromium-desktop',chromium,{viewport:{width:1440,height:900}}],
  ['firefox-desktop',firefox,{viewport:{width:1440,height:900}}],
  ['webkit-desktop',webkit,{viewport:{width:1440,height:900}}],
  ['chromium-mobile',chromium,{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],
  ['webkit-mobile',webkit,{viewport:{width:390,height:844},isMobile:true,hasTouch:true}]
];

let failed=false;
for(const [name,type,contextOptions] of targets){
  const browser=await type.launch({headless:true});
  const context=await browser.newContext(contextOptions);
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
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
    if(wav.status!==200||wav.bytes<500000)throw new Error('WAV failed '+JSON.stringify(wav));
    await page.locator('#play').click({timeout:8000});
    await page.waitForTimeout(900);
    const playing=await page.evaluate(()=>document.body.classList.contains('is-playing'));
    if(!playing)throw new Error('Play control did not enter playing state');

    r=await page.goto(base+'/account/',{waitUntil:'domcontentloaded',timeout:20000});
    if(!r?.ok())throw new Error('account status '+r?.status());
    await page.locator('body').waitFor({state:'visible',timeout:8000});
    if(!(await page.locator('body').innerText()).includes('Your Afterlight'))throw new Error('account portal copy missing');

    if(errors.length)throw new Error(errors.join(' | '));
    console.log('PASS',name,wav.bytes+' bytes');
  }catch(error){
    failed=true;console.error('FAIL',name,error.message);
  }finally{await context.close();await browser.close()}
}
if(failed)process.exit(1);

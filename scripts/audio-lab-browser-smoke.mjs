import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const base=(process.env.BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const expectedRooms=['rooftop','window','headspace','last-bus'];

async function run(browserType,label,viewport){
  const browser=await browserType.launch({headless:true});
  try{
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    const external=[];
    page.on('request',request=>{
      try{const url=new URL(request.url());if(url.origin!==new URL(base).origin)external.push(request.url())}catch{}
    });
    const response=await page.goto(`${base}/audio-lab/`,{waitUntil:'networkidle'});
    assert.equal(response?.status(),200,`${label}: Audio Lab route failed`);
    assert.match(await page.title(),/Afterlight Audio Lab/,`${label}: title missing`);
    const cards=page.locator('.card');
    assert.equal(await cards.count(),4,`${label}: expected four flagship cards`);
    const manifest=await page.evaluate(()=>fetch('/audio-lab/manifest.json',{cache:'no-store'}).then(r=>r.json()));
    assert.deepEqual(manifest.rooms.map(room=>room.room),expectedRooms,`${label}: flagship manifest drifted`);
    assert.equal(manifest.blinded,true,`${label}: manifest must stay blinded`);
    for(const room of manifest.rooms){
      for(const version of ['A','B']){
        const audio=await context.request.get(`${base}${room.files[version]}`,{headers:{Range:'bytes=0-127'}});
        assert.ok([200,206].includes(audio.status()),`${label}: ${room.room} ${version} audio unreachable (${audio.status()})`);
        assert.ok((await audio.body()).length>=128,`${label}: ${room.room} ${version} response too small`);
      }
    }
    const first=cards.first();
    await first.locator('[data-preferred]').selectOption('A');
    await first.locator('[data-decision]').selectOption('shortlist');
    await first.locator('[data-comments]').fill('browser smoke review');
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('afterlight-audio-lab-review-v1')||'{}'));
    assert.equal(stored.rooftop?.preferred,'A',`${label}: preference did not stay in local storage`);
    assert.equal(stored.rooftop?.decision,'shortlist',`${label}: decision did not stay in local storage`);
    assert.deepEqual(external,[],`${label}: Audio Lab made cross-origin requests: ${external.join(', ')}`);
    console.log(`PASS ${label}: blind Audio Lab route, four rooms, local review state, same-origin-only network`);
    await context.close();
  } finally {
    await browser.close();
  }
}

await run(chromium,'chromium-desktop',{width:1440,height:900});
await run(webkit,'webkit-mobile',{width:390,height:844});

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4173';
const root=process.cwd();
const audioFixture=path.join(root,'public','audio','rooftop','1.wav');
const artifactDir=path.join(root,'test-artifacts','spoken');
const transcriptFixture=path.join(artifactDir,'sample.srt');
await mkdir(artifactDir,{recursive:true});
await writeFile(transcriptFixture,`1\n00:00:00,000 --> 00:00:01,500\nFirst timed sentence.\n\n2\n00:00:01,500 --> 00:00:03,500\nSecond timed sentence.\n`);

async function desktopFlow(){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const postLoadRequests=[];
  page.on('request',request=>postLoadRequests.push(request.url()));
  await page.goto(base+'/spoken/',{waitUntil:'networkidle'});
  postLoadRequests.length=0;

  await page.locator('#audioInput').setInputFiles(audioFixture);
  await page.waitForFunction(()=>window.__afterlightSpoken?.getState().items[0]?.status==='ready');
  await page.waitForFunction(()=>Number.isFinite(document.getElementById('spokenAudio')?.duration)&&document.getElementById('spokenAudio').duration>6);
  let state=await page.evaluate(()=>window.__afterlightSpoken.getState());
  if(state.items.length!==1||state.items[0].schema!=='spoken-library/v1')throw new Error('Local audio was not normalized into spoken-library/v1');
  if(state.items[0].filename!=='1.wav')throw new Error('Unexpected local fixture identity');

  await page.locator('#titleInput').fill('Local Test Chapter');
  await page.locator('#titleInput').blur();
  await page.locator('#creatorInput').fill('Afterlight QA');
  await page.locator('#creatorInput').blur();
  await page.locator('#typeInput').selectOption('podcast_episode');

  await page.locator('#transcriptInput').setInputFiles(transcriptFixture);
  await page.waitForFunction(()=>window.__afterlightSpoken?.getState().items[0]?.transcript?.segments?.length===2);
  await page.locator('.transcript-line').nth(1).click();
  const seeked=await page.locator('#spokenAudio').evaluate(audio=>audio.currentTime);
  if(Math.abs(seeked-1.5)>.35)throw new Error('Timed transcript click did not seek audio');

  const malformedRejected=await page.evaluate(()=>{
    try{window.__afterlightSpoken.parseSrt('1\n00:00:02,000 --> 00:00:01,000\nBad cue');return false}catch{return true}
  });
  if(!malformedRejected)throw new Error('Malformed transcript range was accepted');
  const overlapRejected=await page.evaluate(()=>{
    try{window.__afterlightSpoken.validateTimedSegments([{start:0,end:2,text:'a'},{start:1,end:3,text:'b'}]);return false}catch{return true}
  });
  if(!overlapRejected)throw new Error('Overlapping transcript cues were accepted');

  await page.locator('#addCurrentToQueue').click();
  state=await page.evaluate(()=>window.__afterlightSpoken.getState());
  if(state.queue.length!==1)throw new Error('Up Next did not persist current item');

  await page.locator('#spokenAudio').evaluate(audio=>{audio.pause();audio.currentTime=5;audio.dispatchEvent(new Event('pause'))});
  await page.waitForFunction(()=>window.__afterlightSpoken.getState().items[0].progress>=4.5);
  const progressBefore=await page.evaluate(()=>window.__afterlightSpoken.getState().items[0].progress);

  const unexpectedRequests=postLoadRequests.filter(url=>!url.startsWith('blob:'));
  if(unexpectedRequests.length!==0)throw new Error('Local audio/transcript import unexpectedly caused non-blob requests: '+unexpectedRequests.join(', '));
  if(!postLoadRequests.some(url=>url.startsWith('blob:')))throw new Error('Local object-URL playback was not observed');
  await page.screenshot({path:path.join(artifactDir,'desktop.png'),fullPage:true});

  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__afterlightSpoken?.getState().items[0]?.status==='needs_relink');
  state=await page.evaluate(()=>window.__afterlightSpoken.getState());
  if(state.items[0].title!=='Local Test Chapter'||state.items[0].creator!=='Afterlight QA'||state.items[0].type!=='podcast_episode')throw new Error('Local metadata did not survive reload');
  if(state.queue.length!==1)throw new Error('Queue did not survive reload');
  if(state.items[0].progress<4.5)throw new Error('Progress did not survive reload');
  const srcAfterReload=await page.locator('#spokenAudio').getAttribute('src');
  if(srcAfterReload)throw new Error('Reload falsely retained a durable local media URL');

  const relinkInput=page.locator('.shelf-item input[type=file]').first();
  await relinkInput.setInputFiles(audioFixture);
  await page.waitForFunction(()=>window.__afterlightSpoken.getState().items[0].status==='ready');
  await page.waitForFunction(expected=>Math.abs(document.getElementById('spokenAudio').currentTime-expected)<.5,progressBefore);
  await browser.close();
}

async function mobileSurface(){
  const browser=await webkit.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
  await page.goto(base+'/spoken/',{waitUntil:'networkidle'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
  if(overflow)throw new Error('Spoken mobile surface has horizontal overflow');
  if(!await page.locator('#audioInput').isVisible())throw new Error('Mobile local-audio onboarding is not visible');
  await page.screenshot({path:path.join(artifactDir,'mobile-webkit.png'),fullPage:true});
  await browser.close();
}

await desktopFlow();
await mobileSurface();
console.log('Afterlight Spoken Chromium flow + WebKit mobile smoke passed');

import fs from 'node:fs';
import { chromium } from 'playwright';

const base=process.env.BASE_URL||'https://afterlight-radio.vercel.app';
const axeSource=fs.readFileSync('node_modules/axe-core/axe.min.js','utf8');
const pages=[
  ['home','/'],
  ['rooftop','/rooftop/'],
  ['account','/account/'],
  ['support','/support/'],
  ['privacy','/privacy/'],
  ['terms','/terms/']
];
const viewports=[
  ['desktop',{width:1440,height:900}],
  ['mobile',{width:390,height:844,isMobile:true,hasTouch:true}]
];

let failed=false;
const browser=await chromium.launch({headless:true});
for(const [viewportName,contextOptions] of viewports){
  const context=await browser.newContext(contextOptions);
  for(const [pageName,path] of pages){
    const page=await context.newPage();
    try{
      const response=await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:20000});
      if(!response?.ok())throw new Error('HTTP '+response?.status());
      await page.addScriptTag({content:axeSource});
      const result=await page.evaluate(async()=>await window.axe.run(document,{resultTypes:['violations'],runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
      const blocking=result.violations.filter(v=>['critical','serious'].includes(v.impact));
      if(blocking.length){
        failed=true;
        console.error(`FAIL ${viewportName}/${pageName}`);
        for(const violation of blocking){
          console.error(`  ${violation.impact} ${violation.id}: ${violation.help}`);
          for(const node of violation.nodes.slice(0,5))console.error('   ',node.target.join(' -> '),'-',node.failureSummary?.replace(/\s+/g,' '));
        }
      }else{
        console.log(`PASS ${viewportName}/${pageName} (${result.violations.length} non-blocking violations)`);
      }
    }catch(error){
      failed=true;
      console.error(`FAIL ${viewportName}/${pageName}: ${error.message}`);
    }finally{
      await page.close();
    }
  }
  await context.close();
}
await browser.close();
if(failed)process.exit(1);

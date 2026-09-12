const TARGET='https://br-proud-breeze-axhwv7rx-afterlightweb.compute.c-4.us-east-2.aws.neon.tech';
const NEON_AUTH_ORIGIN='https://ep-bitter-cake-axu59msq.neonauth.c-4.us-east-2.aws.neon.tech';

async function read(path,init){
  const response=await fetch(TARGET+path,init);
  const type=response.headers.get('content-type')||'';
  const body=type.includes('audio/')?new Uint8Array(await response.arrayBuffer()):await response.text();
  return {response,body,type};
}

async function check(){
  const results={};
  let x=await read('/');
  results.home=x.response.ok&&String(x.body).includes('Afterlight')&&String(x.body).includes('/runtime-enhancements.js')&&String(x.body).includes('/mobile-visual-polish.js');

  x=await read('/rooftop/');
  results.room=x.response.ok&&String(x.body).includes('Nobody wants to go in')&&String(x.body).includes('/audio-continuity.js');

  x=await read('/runtime-enhancements.js');
  results.runtime=x.response.ok&&String(x.body).includes('googleAuthMain')&&String(x.body).includes('paintedScene')&&String(x.body).includes('Rooftop at sundown');

  x=await read('/mobile-visual-polish.js');
  results.mobile=x.response.ok&&String(x.body).includes('display:inline-flex!important')&&String(x.body).includes('xMidYMid slice');

  x=await read('/account/');
  results.account=x.response.ok&&String(x.body).includes('Your Afterlight')&&String(x.body).includes('/account-enhancements.js');

  x=await read('/api/health');
  let health={};try{health=JSON.parse(String(x.body))}catch{}
  results.api=x.response.ok&&health.ok===true;

  x=await read('/api/auth/sign-in/social',{
    method:'POST',
    headers:{Origin:TARGET,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({provider:'google',callbackURL:'/account/'})
  });
  let oauth={};try{oauth=JSON.parse(String(x.body))}catch{}
  let oauthUrl;try{oauthUrl=new URL(oauth.url)}catch{}
  results.google=x.response.ok&&oauth.redirect===true&&oauthUrl?.origin===NEON_AUTH_ORIGIN&&oauthUrl?.pathname.includes('/afterlight/auth/sign-in/social/init')&&!!oauthUrl?.searchParams.get('token');

  x=await read('/audio/rooftop/1.wav');
  const riff=x.body instanceof Uint8Array&&String.fromCharCode(...x.body.slice(0,4))==='RIFF';
  const wave=x.body instanceof Uint8Array&&String.fromCharCode(...x.body.slice(8,12))==='WAVE';
  results.audio=x.response.ok&&riff&&wave&&x.body.byteLength>1000000;

  const ok=Object.values(results).every(Boolean);
  return {ok,target:TARGET,results,audioBytes:x.body instanceof Uint8Array?x.body.byteLength:0};
}

export default{async fetch(){
  try{
    const report=await check();
    console.log('AFTERLIGHT_E2E',JSON.stringify(report));
    return new Response(JSON.stringify(report),{status:report.ok?200:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
  }catch(error){
    const report={ok:false,target:TARGET,error:error?.message||String(error)};
    console.error('AFTERLIGHT_E2E',JSON.stringify(report));
    return new Response(JSON.stringify(report),{status:503,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
  }
}};

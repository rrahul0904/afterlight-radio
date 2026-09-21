import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';

const ROOT=path.resolve(process.cwd(),'public');
const BACKEND='https://br-proud-breeze-axhwv7rx-afterlightapi.compute.c-4.us-east-2.aws.neon.tech';
const PORT=Number(process.env.PORT||3000);
const RELEASE=(process.env.RAILWAY_GIT_COMMIT_SHA||process.env.AFTERLIGHT_RELEASE_SHA||'development').trim();

const types={
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.wav':'audio/wav',
  '.txt':'text/plain; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.ico':'image/x-icon'
};

function origin(req){
  const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim();
  return proto+'://'+host;
}

function securityHeaders(extra={}){
  return {
    'X-Frame-Options':'DENY',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'strict-origin-when-cross-origin',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy':'same-origin',
    ...extra
  };
}

async function proxyApi(req,res,url){
  const target=new URL(BACKEND+url.pathname+url.search);
  const headers=new Headers({Accept:req.headers.accept||'application/json','X-Afterlight-Origin':origin(req)});
  for(const key of ['cookie','content-type','user-agent','stripe-signature','range','if-range']){
    const value=req.headers[key];
    if(value)headers.set(key,Array.isArray(value)?value.join(', '):String(value));
  }
  const hasBody=!['GET','HEAD'].includes(req.method||'GET');
  try{
    const upstream=await fetch(target,{
      method:req.method,
      headers,
      body:hasBody?req:undefined,
      duplex:hasBody?'half':undefined,
      redirect:'manual'
    });
    res.statusCode=upstream.status;
    for(const [key,value] of upstream.headers){
      const lower=key.toLowerCase();
      if(lower==='set-cookie'||lower==='transfer-encoding')continue;
      res.setHeader(key,value);
    }
    const cookies=upstream.headers.getSetCookie?.()||[];
    if(cookies.length)res.setHeader('Set-Cookie',cookies);
    if(req.method==='HEAD'||!upstream.body)return res.end();
    Readable.fromWeb(upstream.body).pipe(res);
  }catch(error){
    console.error('api proxy failed',error);
    res.writeHead(502,securityHeaders({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}));
    res.end(JSON.stringify({error:'Afterlight backend is temporarily unavailable'}));
  }
}

function safePath(pathname){
  let decoded;
  try{decoded=decodeURIComponent(pathname)}catch{return null}
  if(decoded.includes('\0'))return null;
  let candidate=decoded;
  if(candidate.endsWith('/'))candidate+='index.html';
  else if(!path.posix.extname(candidate))candidate+='/index.html';
  const file=path.resolve(ROOT,'.'+candidate);
  if(file!==ROOT&&!file.startsWith(ROOT+path.sep))return null;
  return file;
}

function parseRange(header,size){
  const match=/^bytes=(\d*)-(\d*)$/.exec(String(header||'').trim());
  if(!match)return null;
  let start=match[1]?Number(match[1]):null,end=match[2]?Number(match[2]):null;
  if(start===null&&end!==null){start=Math.max(0,size-end);end=size-1}
  else{start=start??0;end=end??size-1}
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||start>=size)return null;
  return {start,end:Math.min(end,size-1)};
}

async function staticFile(req,res,url){
  let file=safePath(url.pathname);
  if(!file){
    res.writeHead(400,securityHeaders({'Content-Type':'text/plain; charset=utf-8'}));
    return res.end('Bad request');
  }
  let info;
  try{info=await stat(file)}catch{
    file=path.join(ROOT,'404.html');
    try{info=await stat(file)}catch{
      res.writeHead(404,securityHeaders({'Content-Type':'text/plain; charset=utf-8'}));
      return res.end('Not found');
    }
    res.statusCode=404;
  }
  if(!info.isFile()){
    res.writeHead(404,securityHeaders({'Content-Type':'text/plain; charset=utf-8'}));
    return res.end('Not found');
  }

  const ext=path.extname(file).toLowerCase();
  const audio=ext==='.wav';
  const range=audio?parseRange(req.headers.range,info.size):null;
  const headers=securityHeaders({
    'Content-Type':types[ext]||'application/octet-stream',
    'Accept-Ranges':audio?'bytes':'none',
    'Cache-Control':audio?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate'
  });

  if(req.headers.range&&audio&&!range){
    res.writeHead(416,{...headers,'Content-Range':`bytes */${info.size}`});
    return res.end();
  }
  if(range){
    const length=range.end-range.start+1;
    res.writeHead(206,{...headers,'Content-Length':length,'Content-Range':`bytes ${range.start}-${range.end}/${info.size}`});
    if(req.method==='HEAD')return res.end();
    return createReadStream(file,{start:range.start,end:range.end}).pipe(res);
  }
  res.writeHead(res.statusCode||200,{...headers,'Content-Length':info.size});
  if(req.method==='HEAD')return res.end();
  createReadStream(file).pipe(res);
}

const server=createServer(async(req,res)=>{
  const url=new URL(req.url||'/',origin(req));
  if(url.pathname==='/__railway_health'){
    res.writeHead(200,securityHeaders({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}));
    return res.end(JSON.stringify({ok:true,release:RELEASE}));
  }
  if(url.pathname.startsWith('/api/'))return proxyApi(req,res,url);
  if(!['GET','HEAD'].includes(req.method||'GET')){
    res.writeHead(405,securityHeaders({'Content-Type':'text/plain; charset=utf-8','Allow':'GET, HEAD'}));
    return res.end('Method not allowed');
  }
  return staticFile(req,res,url);
});

server.listen(PORT,'0.0.0.0',()=>console.log(`Afterlight Railway host listening on 0.0.0.0:${PORT} release=${RELEASE}`));

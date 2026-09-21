import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('public');
const port=Number(process.env.PORT||3000);
const backend=(process.env.AFTERLIGHT_BACKEND_URL||'https://br-proud-breeze-axhwv7rx-afterlightapi.compute.c-4.us-east-2.aws.neon.tech').replace(/\/$/,'');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.wav':'audio/wav','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const hopByHop=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailers','transfer-encoding','upgrade']);

function frontendOrigin(req){
  const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
  const host=String(req.headers['x-forwarded-host']||req.headers.host||'localhost:'+port).split(',')[0].trim();
  return proto+'://'+host;
}

async function rawBody(req){
  if(req.method==='GET'||req.method==='HEAD')return undefined;
  const chunks=[];
  for await(const chunk of req)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
  return chunks.length?Buffer.concat(chunks):undefined;
}

async function proxyApi(req,res,url){
  try{
    const target=new URL(backend+url.pathname+url.search);
    const headers=new Headers({Accept:req.headers.accept||'application/json','X-Afterlight-Origin':frontendOrigin(req)});
    for(const key of ['cookie','content-type','user-agent','stripe-signature','range','if-range']){
      const value=req.headers[key];if(value)headers.set(key,Array.isArray(value)?value.join(', '):String(value));
    }
    const body=await rawBody(req);
    const upstream=await fetch(target,{method:req.method,headers,body,duplex:body?'half':undefined,redirect:'manual'});
    res.statusCode=upstream.status;
    const setCookies=upstream.headers.getSetCookie?.()||[];
    for(const [key,value] of upstream.headers){
      const lower=key.toLowerCase();
      if(lower==='set-cookie'||lower==='content-length'||hopByHop.has(lower))continue;
      res.setHeader(key,value);
    }
    if(setCookies.length)res.setHeader('Set-Cookie',setCookies);
    if(req.method==='HEAD'||!upstream.body)return res.end();
    const reader=upstream.body.getReader();
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!res.write(Buffer.from(value)))await new Promise(resolve=>res.once('drain',resolve));
    }
    res.end();
  }catch(error){
    console.error('API proxy error',error);
    res.statusCode=502;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    res.end(JSON.stringify({error:'Afterlight backend is temporarily unavailable'}));
  }
}

function parseRange(header,size){
  const match=/^bytes=(\d*)-(\d*)$/.exec(header||'');
  if(!match)return null;
  let start=match[1]?Number(match[1]):null,end=match[2]?Number(match[2]):null;
  if(start===null&&end!==null){start=Math.max(0,size-end);end=size-1}else{start=start??0;end=end??size-1}
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||start>=size)return false;
  return {start,end:Math.min(end,size-1)};
}

async function serveFile(req,res,file){
  const info=await stat(file);
  if(info.isDirectory())return serveFile(req,res,path.join(file,'index.html'));
  const ext=path.extname(file).toLowerCase(),headers={'Content-Type':types[ext]||'application/octet-stream'};
  if(ext==='.wav'){
    headers['Accept-Ranges']='bytes';
    headers['Cache-Control']='public, max-age=31536000, immutable';
    const range=parseRange(req.headers.range,info.size);
    if(range===false){
      res.writeHead(416,{...headers,'Content-Range':`bytes */${info.size}`});
      return res.end();
    }
    if(range){
      headers['Content-Range']=`bytes ${range.start}-${range.end}/${info.size}`;
      headers['Content-Length']=String(range.end-range.start+1);
      res.writeHead(206,headers);
      if(req.method==='HEAD')return res.end();
      return createReadStream(file,{start:range.start,end:range.end}).pipe(res);
    }
  }else headers['Cache-Control']='public, max-age=300';
  headers['Content-Length']=String(info.size);
  res.writeHead(200,headers);
  if(req.method==='HEAD')return res.end();
  createReadStream(file).pipe(res);
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/healthz'){
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    return res.end(JSON.stringify({ok:true,service:'afterlight-preview'}));
  }
  if(url.pathname.startsWith('/api/'))return proxyApi(req,res,url);
  const pathname=decodeURIComponent(url.pathname);
  if(pathname.includes('\0')||pathname.includes('..')){res.writeHead(400);return res.end('Bad request')}
  let file=path.join(root,pathname.replace(/^\/+/,''));if(pathname.endsWith('/'))file=path.join(file,'index.html');
  try{
    await serveFile(req,res,file);
  }catch{
    if(!path.extname(file)){
      try{return await serveFile(req,res,path.join(file,'index.html'))}catch{}
    }
    try{await serveFile(req,res,path.join(root,'404.html'))}catch{res.writeHead(404);res.end('Not found')}
  }
});
server.listen(port,'0.0.0.0',()=>console.log(`Afterlight preview listening on :${port}`));
const shutdown=()=>server.close(()=>process.exit(0));
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);

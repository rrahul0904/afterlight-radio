const BACKEND='https://br-proud-breeze-axhwv7rx-afterlightapi.compute.c-4.us-east-2.aws.neon.tech';

export const config={api:{bodyParser:false}};

async function rawBody(req){
  if(req.method==='GET'||req.method==='HEAD')return undefined;
  const chunks=[];
  for await(const chunk of req)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
  return chunks.length?Buffer.concat(chunks):undefined;
}

function frontendOrigin(req){
  const proto=(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
  const host=(req.headers['x-forwarded-host']||req.headers.host||'afterlight-radio.vercel.app').split(',')[0].trim();
  return proto+'://'+host;
}

function targetUrl(req){
  const path=req.query?.path;
  let route='/api';
  if(path!==undefined){
    const joined=Array.isArray(path)?path.join('/'):String(path);
    route+='/'+joined;
  }
  const qs=new URLSearchParams();
  for(const [key,value] of Object.entries(req.query||{})){
    if(key==='path')continue;
    if(Array.isArray(value))for(const item of value)qs.append(key,String(item));
    else if(value!==undefined)qs.set(key,String(value));
  }
  return BACKEND+route+(qs.size?'?'+qs.toString():'');
}

function proxyHeaders(req){
  const h=new Headers({Accept:req.headers.accept||'application/json','X-Afterlight-Origin':frontendOrigin(req)});
  for(const key of ['cookie','content-type','user-agent','stripe-signature']){
    const value=req.headers[key];if(value)h.set(key,Array.isArray(value)?value.join(', '):String(value));
  }
  return h;
}

export default async function handler(req,res){
  try{
    const body=await rawBody(req);
    const response=await fetch(targetUrl(req),{method:req.method,headers:proxyHeaders(req),body,duplex:body?'half':undefined,redirect:'manual'});
    res.statusCode=response.status;
    const cookies=response.headers.getSetCookie?.()||[];
    for(const [key,value] of response.headers){
      if(key.toLowerCase()==='set-cookie'||key.toLowerCase()==='content-length')continue;
      res.setHeader(key,value);
    }
    if(cookies.length)res.setHeader('Set-Cookie',cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){
    console.error(error);
    res.statusCode=502;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store');
    res.end(JSON.stringify({error:'Afterlight backend is temporarily unavailable'}));
  }
}

import { handleApi } from '../src/api-core.js';

const PUBLIC_ENV={
  NEON_AUTH_BASE_URL:'https://ep-bitter-cake-axu59msq.neonauth.c-4.us-east-2.aws.neon.tech/afterlight/auth',
  STRIPE_PRODUCT_ID:'prod_VDx8nP5oUjNnCk',
  STRIPE_PRICE_MONTHLY:'price_1UDVEkRB8OGmEnBw7xEw07J0',
  STRIPE_PRICE_ANNUAL:'price_1UDVEmRB8OGmEnBwO1DeztjQ'
};

export const config={api:{bodyParser:false}};

async function rawBody(req){
  if(req.method==='GET'||req.method==='HEAD')return undefined;
  const chunks=[];
  for await(const chunk of req)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
  return chunks.length?Buffer.concat(chunks):undefined;
}

function requestUrl(req){
  const proto=(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();
  const host=req.headers['x-forwarded-host']||req.headers.host;
  const path=req.query?.path;
  if(path!==undefined){
    const joined=Array.isArray(path)?path.join('/'):String(path);
    const qs=new URLSearchParams(req.query);
    qs.delete('path');
    return proto+'://'+host+'/api/'+joined+(qs.size?'?'+qs:'');
  }
  return proto+'://'+host+(req.url||'/api');
}

export default async function handler(req,res){
  try{
    const body=await rawBody(req);
    const headers=new Headers();
    for(const [key,value] of Object.entries(req.headers)){
      if(Array.isArray(value))for(const v of value)headers.append(key,v);
      else if(value!==undefined)headers.set(key,String(value));
    }
    const request=new Request(requestUrl(req),{
      method:req.method,
      headers,
      body,
      duplex:body?'half':undefined
    });
    const env={...PUBLIC_ENV,...process.env};
    const response=await handleApi(request,env);
    res.statusCode=response.status;
    const cookies=response.headers.getSetCookie?.()||[];
    for(const [key,value] of response.headers){
      if(key.toLowerCase()==='set-cookie')continue;
      res.setHeader(key,value);
    }
    if(cookies.length)res.setHeader('Set-Cookie',cookies);
    const bytes=Buffer.from(await response.arrayBuffer());
    res.end(bytes);
  }catch(error){
    console.error(error);
    res.statusCode=500;
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.end(JSON.stringify({error:'Internal server error'}));
  }
}

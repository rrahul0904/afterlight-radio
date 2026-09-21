const CACHE_NAME='afterlight-offline-v1';

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

const sameOriginUrl=raw=>{
  const url=new URL(raw,self.location.origin);
  if(url.origin!==self.location.origin)throw new Error('Only same-origin media can be cached');
  return url;
};

async function cacheUrls(urls){
  const cache=await caches.open(CACHE_NAME);
  for(const raw of urls){
    const url=sameOriginUrl(raw);
    const request=new Request(url.href,{method:'GET',credentials:'same-origin'});
    const response=await fetch(request);
    if(!response.ok)throw new Error('Could not cache '+url.pathname+' ('+response.status+')');
    await cache.put(request,response.clone());
  }
}

async function removeUrls(urls){
  const cache=await caches.open(CACHE_NAME);
  for(const raw of urls){
    const url=sameOriginUrl(raw);
    await cache.delete(new Request(url.href,{method:'GET',credentials:'same-origin'}),{ignoreSearch:false});
  }
}

async function reply(source,payload){
  if(source&&typeof source.postMessage==='function')source.postMessage(payload);
}

self.addEventListener('message',event=>{
  const data=event.data||{};
  const {type,requestId}=data;
  if(type!=='CACHE_URLS'&&type!=='REMOVE_URLS')return;
  event.waitUntil((async()=>{
    try{
      if(!Array.isArray(data.urls)||data.urls.length<1||data.urls.length>20)throw new Error('Invalid offline URL set');
      if(type==='CACHE_URLS')await cacheUrls(data.urls);
      else await removeUrls(data.urls);
      await reply(event.source,{requestId,ok:true,type});
    }catch(error){
      await reply(event.source,{requestId,ok:false,type,error:String(error?.message||error)});
    }
  })());
});

async function rangedResponse(request,cached){
  const range=request.headers.get('range');
  if(!range)return cached;
  const match=/bytes=(\d+)-(\d*)/.exec(range);
  if(!match)return new Response(null,{status:416});
  const body=await cached.arrayBuffer();
  const start=Number(match[1]);
  const requestedEnd=match[2]?Number(match[2]):body.byteLength-1;
  const end=Math.min(requestedEnd,body.byteLength-1);
  if(!Number.isFinite(start)||start<0||start>end||start>=body.byteLength){
    return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+body.byteLength}});
  }
  const headers=new Headers(cached.headers);
  headers.set('Accept-Ranges','bytes');
  headers.set('Content-Range','bytes '+start+'-'+end+'/'+body.byteLength);
  headers.set('Content-Length',String(end-start+1));
  return new Response(body.slice(start,end+1),{status:206,statusText:'Partial Content',headers});
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(url.pathname.startsWith('/audio/')){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      const key=new Request(url.href,{method:'GET',credentials:'same-origin'});
      const cached=await cache.match(key,{ignoreSearch:false});
      if(cached)return rangedResponse(request,cached);
      return fetch(request);
    })());
    return;
  }

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{return await fetch(request)}
      catch{
        const cache=await caches.open(CACHE_NAME);
        return (await cache.match(request,{ignoreSearch:false}))||(await cache.match('/'));
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const key=new Request(url.href,{method:'GET',credentials:'same-origin'});
    const cached=await cache.match(key,{ignoreSearch:false});
    if(cached)return cached;
    return fetch(request);
  })());
});
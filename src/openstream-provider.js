const SENSITIVE_KEY=/key|token|secret|password|authorization/i;
const SAFE_LIBRARY_KEYS=['items','entries','files','library','sources','tracks'];
const SAFE_CHANNEL_KEYS=['channels','items','entries'];

function envValue(env,name){
  if(env&&env[name]!==undefined)return env[name];
  if(typeof process!=='undefined'&&process.env)return process.env[name];
  return undefined;
}
function truthy(value){return /^(1|true|yes|on)$/i.test(String(value||''))}

function blockedHostname(hostname){
  const h=hostname.toLowerCase().replace(/^\[|\]$/g,'');
  if(h==='localhost'||h.endsWith('.localhost')||h==='metadata.google.internal')return true;
  if(h==='::1'||h==='0.0.0.0')return true;
  const m=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if(!m)return false;
  const a=m.slice(1).map(Number);
  if(a.some(n=>n>255))return true;
  return a[0]===10||
    a[0]===127||
    (a[0]===169&&a[1]===254)||
    (a[0]===172&&a[1]>=16&&a[1]<=31)||
    (a[0]===192&&a[1]===168);
}

export function openStreamConfig(env){
  const raw=String(envValue(env,'OPENSTREAM_URL')||'').trim();
  if(!raw)return {enabled:false};
  let base;
  try{base=new URL(raw)}catch{return {enabled:false,error:'invalid_url'}}

  const allowInsecure=truthy(envValue(env,'OPENSTREAM_ALLOW_INSECURE'));
  const allowPrivate=truthy(envValue(env,'OPENSTREAM_ALLOW_PRIVATE'));
  if(!['https:','http:'].includes(base.protocol))return {enabled:false,error:'invalid_protocol'};
  if(base.protocol!=='https:'&&!allowInsecure)return {enabled:false,error:'https_required'};
  if((base.username||base.password||base.search||base.hash))return {enabled:false,error:'invalid_url_shape'};
  if(blockedHostname(base.hostname)&&!allowPrivate)return {enabled:false,error:'private_network_blocked'};

  base.pathname=base.pathname.replace(/\/$/,'');
  return {
    enabled:true,
    base,
    hasListenKey:!!envValue(env,'OPENSTREAM_LISTEN_KEY'),
    hasControlKey:!!envValue(env,'OPENSTREAM_CONTROL_KEY'),
    allowPrivate,
    allowInsecure
  };
}

export function openStreamConfigured(env){return openStreamConfig(env).enabled}

function json(data,status=200,headers={}){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
      ...headers
    }
  });
}

function redactString(value){
  return String(value)
    .replace(/([?&](?:key|token|secret|password)=)[^&#\s]*/gi,'$1[redacted]')
    .replace(/(bearer\s+)[a-z0-9._~+\/-]+/gi,'$1[redacted]');
}

function sanitize(value,depth=0){
  if(depth>8)return null;
  if(value===null||value===undefined||typeof value==='number'||typeof value==='boolean')return value;
  if(typeof value==='string')return redactString(value).slice(0,4096);
  if(Array.isArray(value))return value.slice(0,1000).map(v=>sanitize(v,depth+1));
  if(typeof value==='object'){
    const out={};
    for(const [key,val] of Object.entries(value).slice(0,200)){
      if(SENSITIVE_KEY.test(key)){out[key]='[redacted]';continue}
      out[key]=sanitize(val,depth+1);
    }
    return out;
  }
  return String(value).slice(0,512);
}

function candidates(data,keys){
  if(Array.isArray(data))return data;
  if(!data||typeof data!=='object')return [];
  for(const key of keys)if(Array.isArray(data[key]))return data[key];
  return [];
}

function basename(path){
  const clean=String(path||'').replace(/\\/g,'/');
  return clean.split('/').filter(Boolean).at(-1)||clean||'Untitled';
}
function safeId(value,index){
  const raw=String(value||'').replace(/[^a-zA-Z0-9._:-]/g,'-').slice(0,180);
  return raw||'item-'+index;
}

function normalizeLibrary(data){
  return candidates(data,SAFE_LIBRARY_KEYS).slice(0,1000).map((item,index)=>{
    if(typeof item==='string'){
      return {id:safeId(item,index),name:basename(item),path:item.slice(0,2048),type:/\.m3u8?$/i.test(item)?'playlist':'file'};
    }
    const x=item&&typeof item==='object'?item:{};
    const path=x.relativePath??x.path??x.file??x.source?.path??'';
    const name=x.name??x.title??basename(path);
    return {
      id:safeId(x.id??path??name,index),
      name:String(name||'Untitled').slice(0,300),
      path:String(path||'').slice(0,2048),
      type:String(x.type||(/\.m3u8?$/i.test(String(path))?'playlist':'file')).slice(0,80),
      duration:Number.isFinite(Number(x.duration))?Number(x.duration):null,
      size:Number.isFinite(Number(x.size))?Number(x.size):null,
      metadata:sanitize(x.metadata??x.probe??null)
    };
  });
}

function normalizeChannels(data){
  return candidates(data,SAFE_CHANNEL_KEYS).slice(0,200).map((item,index)=>{
    const x=item&&typeof item==='object'?item:{};
    return {
      id:safeId(x.id??x.channelId??x.name,index),
      name:String(x.name??x.title??x.id??('Channel '+(index+1))).slice(0,300),
      state:String(x.state??x.status??'unknown').slice(0,80),
      source:sanitize(x.source??null),
      listeners:Number.isFinite(Number(x.listeners??x.listenerCount))?Number(x.listeners??x.listenerCount):null
    };
  });
}

async function fetchWithTimeout(url,init={},timeoutMs=8000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...init,signal:controller.signal,redirect:'manual'})}
  finally{clearTimeout(timer)}
}

async function upstreamJson(env,path,authority='public'){
  const config=openStreamConfig(env);
  if(!config.enabled)throw Object.assign(new Error('OpenStream is not configured'),{status:503,code:config.error||'not_configured'});
  const target=new URL(config.base.toString().replace(/\/$/,'')+path);
  if(authority==='listen'){
    const key=envValue(env,'OPENSTREAM_LISTEN_KEY');
    if(!key)throw Object.assign(new Error('OpenStream listen access is not configured'),{status:503,code:'listen_key_missing'});
    target.searchParams.set('key',String(key));
  }
  if(authority==='control'){
    const key=envValue(env,'OPENSTREAM_CONTROL_KEY');
    if(!key)throw Object.assign(new Error('OpenStream control access is not configured'),{status:503,code:'control_key_missing'});
    target.searchParams.set('key',String(key));
  }
  const response=await fetchWithTimeout(target,{headers:{Accept:'application/json'}});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Object.assign(new Error('OpenStream upstream request failed'),{status:502,code:'upstream_'+response.status});
  return data;
}

export function isOpenStreamPath(pathname){
  return String(pathname||'').startsWith('/api/providers/openstream/');
}

export async function handleOpenStreamApi(req,env){
  const url=new URL(req.url);
  const path=url.pathname;
  if(!isOpenStreamPath(path))return json({error:'Not found'},404);
  if(req.method!=='GET')return json({error:'Method not allowed'},405,{Allow:'GET'});

  const config=openStreamConfig(env);
  if(path==='/api/providers/openstream/status'){
    if(!config.enabled)return json({provider:'openstream',enabled:false,reason:config.error||'not_configured'});
    try{
      const [health,capabilities]=await Promise.all([
        upstreamJson(env,'/health','public'),
        upstreamJson(env,'/api/capabilities','public')
      ]);
      return json({
        provider:'openstream',
        enabled:true,
        reachable:true,
        listenConfigured:config.hasListenKey,
        controlConfigured:config.hasControlKey,
        health:sanitize(health),
        capabilities:sanitize(capabilities)
      });
    }catch(error){
      return json({
        provider:'openstream',
        enabled:true,
        reachable:false,
        listenConfigured:config.hasListenKey,
        controlConfigured:config.hasControlKey,
        error:error.code||'upstream_unavailable'
      },502);
    }
  }

  try{
    if(path==='/api/providers/openstream/library'){
      const data=await upstreamJson(env,'/api/library','control');
      const items=normalizeLibrary(data);
      return json({provider:'openstream',count:items.length,items});
    }
    if(path==='/api/providers/openstream/channels'){
      const data=await upstreamJson(env,'/api/channels','listen');
      const channels=normalizeChannels(data);
      return json({provider:'openstream',count:channels.length,channels});
    }
    if(path==='/api/providers/openstream/state'){
      const data=await upstreamJson(env,'/api/state/snapshot','listen');
      return json({provider:'openstream',state:sanitize(data)});
    }
  }catch(error){
    const status=Number(error?.status)||502;
    return json({error:error?.message||'OpenStream request failed',code:error?.code||'openstream_error'},status);
  }
  return json({error:'Not found'},404);
}

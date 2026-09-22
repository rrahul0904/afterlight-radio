import { neon } from '@neondatabase/serverless';

const STRIPE_VERSION='2026-07-29.dahlia';
const ACTIVE=new Set(['active','trialing','past_due']);
const PAYMENT_LINKS={
  monthly:'https://buy.stripe.com/14AbJ3dy88kJaiSdqkdZ600',
  annual:'https://buy.stripe.com/eVqdRb2TucAZ62C1HCdZ601'
};

function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}})}
function configured(env){return {auth:!!env.NEON_AUTH_BASE_URL,data:!!env.DATABASE_URL,checkout:!!(PAYMENT_LINKS.monthly&&PAYMENT_LINKS.annual),webhook:!!env.STRIPE_WEBHOOK_SECRET,portal:!!env.STRIPE_RESTRICTED_KEY,externalLibrary:providerConfigured(env)}}
function appOrigin(req){return req.headers.get('X-Afterlight-Origin')||req.headers.get('Origin')||new URL(req.url).origin}
function originOf(req){return appOrigin(req)}
async function body(req){try{return await req.json()}catch{return {}}}
function db(env){if(!env.DATABASE_URL)throw new Error('Database is not configured');return neon(env.DATABASE_URL)}

function providerConfigured(env){
  return !!(env.NAVIDROME_BASE_URL&&env.NAVIDROME_USERNAME&&env.NAVIDROME_TOKEN&&env.NAVIDROME_SALT);
}
function safeProviderBase(env){
  if(!providerConfigured(env))throw new Error('External music library is not configured');
  const url=new URL(env.NAVIDROME_BASE_URL);
  if(url.protocol!=='https:')throw new Error('External music library must use HTTPS');
  const host=url.hostname.toLowerCase();
  if(host==='localhost'||host.endsWith('.localhost')||host==='127.0.0.1'||host==='::1'||host.startsWith('10.')||host.startsWith('192.168.')||/^172\.(1[6-9]|2\d|3[01])\./.test(host)||host.endsWith('.local')){
    throw new Error('External music library host is not allowed');
  }
  url.pathname=url.pathname.replace(/\/$/,'');
  return url;
}
function providerParams(env){
  return {
    u:String(env.NAVIDROME_USERNAME),
    t:String(env.NAVIDROME_TOKEN),
    s:String(env.NAVIDROME_SALT),
    v:'1.16.1',
    c:String(env.NAVIDROME_CLIENT_NAME||'afterlight-radio').slice(0,64),
    f:'json'
  };
}
function providerUrl(env,endpoint,params={}){
  const base=safeProviderBase(env);
  const url=new URL(base.toString());
  const prefix=base.pathname==='/'?'':base.pathname.replace(/\/$/,'');
  url.pathname=prefix+'/rest/'+endpoint+'.view';
  const all={...providerParams(env),...params};
  for(const [key,value] of Object.entries(all))if(value!==undefined&&value!==null)url.searchParams.set(key,String(value));
  return url;
}
async function providerJson(env,endpoint,params={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  try{
    const response=await fetch(providerUrl(env,endpoint,params),{headers:{Accept:'application/json'},redirect:'error',signal:controller.signal});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw new Error('External library request failed');
    const root=data?.['subsonic-response'];
    if(!root||root.status!=='ok')throw new Error(root?.error?.message||'External library returned an error');
    return root;
  }finally{clearTimeout(timer)}
}
function validProviderId(value){
  const id=String(value||'').trim();
  return id&&id.length<=200&&/^[A-Za-z0-9._:-]+$/.test(id)?id:'';
}
function normalizedProviderTrack(song){
  if(!song?.id)return null;
  const providerTrackId=String(song.id);
  return {
    id:'navidrome:'+providerTrackId,
    title:String(song.title||'Untitled').slice(0,300),
    artist:String(song.artist||'').slice(0,300),
    album:String(song.album||'').slice(0,300),
    duration:Number.isFinite(Number(song.duration))?Number(song.duration):0,
    artwork:song.coverArt?'/api/library/provider/artwork?id='+encodeURIComponent(String(song.coverArt)):'',
    streamUrl:'/api/library/provider/stream?id='+encodeURIComponent(providerTrackId),
    lyricsUrl:'/api/library/provider/lyrics?id='+encodeURIComponent(providerTrackId),
    provider:'navidrome',
    providerTrackId
  };
}
function normalizedProviderLyrics(root,providerTrackId){
  const source=Array.isArray(root?.lyricsList?.structuredLyrics)?root.lyricsList.structuredLyrics:[];
  const tracks=[];
  let remainingLines=4000;
  for(const entry of source.slice(0,8)){
    if(remainingLines<=0)break;
    const rawLines=Array.isArray(entry?.line)?entry.line:[];
    const lines=[];
    for(const line of rawLines.slice(0,remainingLines)){
      const text=String(line?.value??'').slice(0,2000);
      const start=Number(line?.start);
      if(!text&&!Number.isFinite(start))continue;
      lines.push({startMs:Number.isFinite(start)&&start>=0?Math.round(start):null,text});
    }
    remainingLines-=lines.length;
    const offset=Number(entry?.offset);
    const rawLang=String(entry?.lang||'und').trim().slice(0,32);
    tracks.push({
      lang:rawLang==='xxx'?'und':rawLang||'und',
      synced:!!entry?.synced,
      offsetMs:Number.isFinite(offset)?Math.max(-600000,Math.min(600000,Math.round(offset))):0,
      displayArtist:String(entry?.displayArtist||'').slice(0,300),
      displayTitle:String(entry?.displayTitle||'').slice(0,300),
      lines
    });
  }
  return {provider:'navidrome',providerTrackId,tracks,available:tracks.some(track=>track.lines.length>0)};
}
async function providerStatus(req,env){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  if(!providerConfigured(env))return json({enabled:false,provider:'navidrome'},200);
  try{
    const ping=await providerJson(env,'ping');
    return json({enabled:true,provider:'navidrome',reachable:ping.status==='ok'});
  }catch{return json({enabled:true,provider:'navidrome',reachable:false},200)}
}
async function providerSearch(req,env,url){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  if(!providerConfigured(env))return json({error:'External music library is not configured'},503);
  const q=String(url.searchParams.get('q')||'').trim().slice(0,120);
  if(q.length<2)return json({error:'Search query must be at least 2 characters'},400);
  try{
    const root=await providerJson(env,'search3',{query:q,songCount:50,albumCount:0,artistCount:0});
    const songs=Array.isArray(root.searchResult3?.song)?root.searchResult3.song:[];
    const tracks=songs.map(normalizedProviderTrack).filter(Boolean);
    return json({provider:'navidrome',query:q,tracks});
  }catch(error){return json({error:error?.name==='AbortError'?'External music library timed out':'External music library request failed'},502)}
}
async function providerLyrics(req,env,url){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  if(!providerConfigured(env))return json({error:'External music library is not configured'},503);
  const id=validProviderId(url.searchParams.get('id'));
  if(!id)return json({error:'Invalid media id'},400);
  try{
    const root=await providerJson(env,'getLyricsBySongId',{id});
    return json(normalizedProviderLyrics(root,id));
  }catch(error){
    return json({error:error?.name==='AbortError'?'External lyrics request timed out':'External lyrics request failed'},502);
  }
}
async function providerBinary(req,env,url,kind){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  if(!providerConfigured(env))return json({error:'External music library is not configured'},503);
  const id=validProviderId(url.searchParams.get('id'));
  if(!id)return json({error:'Invalid media id'},400);
  const endpoint=kind==='artwork'?'getCoverArt':'stream';
  const headers=new Headers();
  if(kind==='stream'){
    const range=req.headers.get('Range');if(range)headers.set('Range',range);
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const upstream=await fetch(providerUrl(env,endpoint,{id}),{headers,redirect:'error',signal:controller.signal});
    if(!upstream.ok&&upstream.status!==206)return json({error:'External media request failed'},502);
    const out=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    for(const key of ['content-type','content-range','accept-ranges','content-length','etag','last-modified']){
      const value=upstream.headers.get(key);if(value)out.set(key,value);
    }
    return new Response(req.method==='HEAD'?null:upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:out});
  }catch(error){
    return json({error:error?.name==='AbortError'?'External media request timed out':'External media request failed'},502);
  }finally{clearTimeout(timer)}
}

function authHeaders(req,includeContent=false){
  const headers=new Headers({Accept:req.headers.get('Accept')||'application/json'});
  const cookie=req.headers.get('Cookie');if(cookie)headers.set('Cookie',cookie);
  const ua=req.headers.get('User-Agent');if(ua)headers.set('User-Agent',ua);
  headers.set('Origin',appOrigin(req));
  if(includeContent){const type=req.headers.get('Content-Type');if(type)headers.set('Content-Type',type)}
  return headers;
}
async function authProxy(req,env,url){
  if(!env.NEON_AUTH_BASE_URL)return json({error:'Authentication is not configured'},503);
  const suffix=url.pathname.slice('/api/auth'.length)||'/get-session';
  const target=new URL(env.NEON_AUTH_BASE_URL.replace(/\/$/,'')+suffix+url.search);
  const init={method:req.method,headers:authHeaders(req,true),redirect:'manual'};
  if(req.method!=='GET'&&req.method!=='HEAD')init.body=req.body;
  const upstream=await fetch(target,init);
  const outHeaders=new Headers(upstream.headers);outHeaders.set('Cache-Control','no-store');
  const location=outHeaders.get('location');
  if(location&&location.startsWith(env.NEON_AUTH_BASE_URL))outHeaders.set('location',appOrigin(req)+'/api/auth'+location.slice(env.NEON_AUTH_BASE_URL.length));
  return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers:outHeaders});
}
async function authSession(req,env){
  if(!env.NEON_AUTH_BASE_URL)return null;
  const r=await fetch(env.NEON_AUTH_BASE_URL.replace(/\/$/,'')+'/get-session',{headers:authHeaders(req),redirect:'manual'});
  if(!r.ok)return null;const data=await r.json().catch(()=>null);return data?.user?data:null;
}
async function ensureProfile(user,env){
  const sql=db(env);
  await sql`insert into profiles (user_id,email,updated_at) values (${user.id}::uuid,${user.email||null},now()) on conflict (user_id) do update set email=excluded.email,updated_at=now()`;
  const rows=await sql`select user_id,email,stripe_customer_id,created_at,updated_at from profiles where user_id=${user.id}::uuid`;return rows[0];
}
async function subscriptionFor(userId,env){const sql=db(env),rows=await sql`select * from subscriptions where user_id=${userId}::uuid`;return rows[0]||null}
async function preferenceFor(userId,env){const sql=db(env),rows=await sql`select * from user_preferences where user_id=${userId}::uuid`;return rows[0]||null}

function adminEmails(env){
  return new Set(String(env.AFTERLIGHT_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
}
function roleHasAdmin(role){return String(role||'').split(/[\s,]+/).some(x=>x.toLowerCase()==='admin')}
function adminIdentity(user,env){return !!user&&(roleHasAdmin(user.role)||adminEmails(env).has(String(user.email||'').toLowerCase()))}
async function adminForUser(user,env){
  if(adminIdentity(user,env))return true;
  if(!user?.id||!env.DATABASE_URL)return false;
  const sql=db(env),rows=await sql`select email,role,banned from neon_auth."user" where id=${user.id}::uuid limit 1`;
  return !!rows[0]&&!rows[0].banned&&adminIdentity(rows[0],env);
}
async function requireAdmin(req,env){
  const auth=await authSession(req,env);if(!auth?.user)return {response:json({error:'Sign in required'},401)};
  if(!env.DATABASE_URL)return {response:json({error:'Admin data is not configured'},503)};
  const sql=db(env);
  const rows=await sql`select id,name,email,"emailVerified" as email_verified,role,banned,"createdAt" as created_at from neon_auth."user" where id=${auth.user.id}::uuid limit 1`;
  const user=rows[0]||{id:auth.user.id,name:auth.user.name,email:auth.user.email,role:auth.user.role,banned:false};
  if(user.banned)return {response:json({error:'Admin access denied'},403)};
  if(!adminIdentity(user,env))return {response:json({error:'Admin access required'},403)};
  return {auth,user,sql};
}
async function adminSummary(req,env){
  const gate=await requireAdmin(req,env);if(gate.response)return gate.response;
  const rows=await gate.sql`select
    (select count(*) from neon_auth."user")::int as total_users,
    (select count(*) from neon_auth."user" where "emailVerified" is true)::int as verified_users,
    (select count(*) from neon_auth."user" where "createdAt">=now()-interval '7 days')::int as new_users_7d,
    (select count(*) from subscriptions where status in ('active','trialing','past_due'))::int as active_subscriptions,
    (select count(*) from analytics_events where created_at>=now()-interval '24 hours')::int as events_24h,
    (select count(*) from support_requests where status='open')::int as open_support`;
  return json({...rows[0],admin:{id:gate.user.id,email:gate.user.email,role:gate.user.role||'admin'}});
}
async function adminUsers(req,env,url){
  const gate=await requireAdmin(req,env);if(gate.response)return gate.response;
  const q=String(url.searchParams.get('q')||'').trim().slice(0,120).toLowerCase(),pattern='%'+q+'%';
  const limit=Math.max(1,Math.min(100,Number(url.searchParams.get('limit'))||50));
  const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));
  const subscriptionAllowed=new Set(['all','free','active','trialing','past_due','canceled']);
  const verifiedAllowed=new Set(['all','verified','unverified']);
  const accountAllowed=new Set(['all','active','banned']);
  const subscription=subscriptionAllowed.has(url.searchParams.get('subscription'))?url.searchParams.get('subscription'):'all';
  const verified=verifiedAllowed.has(url.searchParams.get('verified'))?url.searchParams.get('verified'):'all';
  const accountState=accountAllowed.has(url.searchParams.get('account_state'))?url.searchParams.get('account_state'):'all';
  const countRows=await gate.sql`
    select count(*)::int as total
    from neon_auth."user" u
    left join subscriptions s on s.user_id=u.id
    where (${q}='' or lower(u.email) like ${pattern} or lower(u.name) like ${pattern} or u.id::text like ${pattern})
      and (${subscription}='all' or coalesce(s.status,'free')=${subscription})
      and (${verified}='all' or (${verified}='verified' and u."emailVerified" is true) or (${verified}='unverified' and u."emailVerified" is false))
      and (${accountState}='all' or (${accountState}='banned' and coalesce(u.banned,false) is true) or (${accountState}='active' and coalesce(u.banned,false) is false))`;
  const users=await gate.sql`
    with activity as (
      select user_id,count(*)::int as event_count,max(created_at) as last_activity
      from analytics_events where user_id is not null group by user_id
    ), support as (
      select user_id,count(*)::int as support_count,count(*) filter(where status='open')::int as open_support
      from support_requests where user_id is not null group by user_id
    )
    select u.id,u.name,u.email,u."emailVerified" as email_verified,u.role,coalesce(u.banned,false) as banned,
      u."createdAt" as created_at,u."updatedAt" as updated_at,
      coalesce(s.status,'free') as subscription_status,s.plan,s.current_period_end,s.cancel_at_period_end,
      (p.stripe_customer_id is not null) as has_billing_profile,
      coalesce(cardinality(pref.favorites),0)::int as favorites_count,pref.last_room,pref.last_track,pref.updated_at as preference_updated_at,
      coalesce(a.event_count,0)::int as event_count,a.last_activity,
      coalesce(sp.support_count,0)::int as support_count,coalesce(sp.open_support,0)::int as open_support
    from neon_auth."user" u
    left join profiles p on p.user_id=u.id
    left join subscriptions s on s.user_id=u.id
    left join user_preferences pref on pref.user_id=u.id
    left join activity a on a.user_id=u.id
    left join support sp on sp.user_id=u.id
    where (${q}='' or lower(u.email) like ${pattern} or lower(u.name) like ${pattern} or u.id::text like ${pattern})
      and (${subscription}='all' or coalesce(s.status,'free')=${subscription})
      and (${verified}='all' or (${verified}='verified' and u."emailVerified" is true) or (${verified}='unverified' and u."emailVerified" is false))
      and (${accountState}='all' or (${accountState}='banned' and coalesce(u.banned,false) is true) or (${accountState}='active' and coalesce(u.banned,false) is false))
    order by u."createdAt" desc,u.id
    limit ${limit} offset ${offset}`;
  return json({total:countRows[0]?.total||0,offset,limit,users});
}

function validBroadcastId(value){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||''))}
function broadcastSchemaMissing(error){const message=String(error?.message||'');return error?.code==='42P01'||message.includes('broadcasts')||message.includes('broadcast_items')||message.includes('broadcast_events')}
async function adminBroadcastStatus(req,env){
  const gate=await requireAdmin(req,env);if(gate.response)return gate.response;
  try{
    const broadcasts=await gate.sql`select id,name,status,brief,active_persona_id,planner_seed,started_at,ended_at,created_at,updated_at from broadcasts order by (status='live') desc,created_at desc limit 1`;
    const broadcast=broadcasts[0]||null;
    if(!broadcast)return json({broadcast:null,nowPlaying:null,next:null,counts:{}});
    const nowRows=await gate.sql`select id,broadcast_id,ordinal,kind,source_id,source_room,title,artist,state,selection_reason,scheduled_for,started_at,ended_at,failure_reason from broadcast_items where broadcast_id=${broadcast.id}::uuid and state in ('airing','handed') order by case state when 'airing' then 0 else 1 end,ordinal limit 1`;
    const nextRows=await gate.sql`select id,broadcast_id,ordinal,kind,source_id,source_room,title,artist,state,selection_reason,scheduled_for from broadcast_items where broadcast_id=${broadcast.id}::uuid and state in ('planned','ready') order by ordinal limit 1`;
    const countRows=await gate.sql`select state,count(*)::int as count from broadcast_items where broadcast_id=${broadcast.id}::uuid group by state order by state`;
    return json({broadcast,nowPlaying:nowRows[0]||null,next:nextRows[0]||null,counts:Object.fromEntries(countRows.map(row=>[row.state,row.count]))});
  }catch(error){if(broadcastSchemaMissing(error))return json({error:'Broadcast schema is not installed'},503);throw error}
}
async function adminBroadcastLineup(req,env,url){
  const gate=await requireAdmin(req,env);if(gate.response)return gate.response;
  const requested=String(url.searchParams.get('broadcast_id')||'').trim();
  if(requested&&!validBroadcastId(requested))return json({error:'Invalid broadcast id'},400);
  try{
    const broadcasts=requested
      ?await gate.sql`select id,name,status,brief,active_persona_id,planner_seed,started_at,ended_at,created_at,updated_at from broadcasts where id=${requested}::uuid limit 1`
      :await gate.sql`select id,name,status,brief,active_persona_id,planner_seed,started_at,ended_at,created_at,updated_at from broadcasts order by (status='live') desc,created_at desc limit 1`;
    const broadcast=broadcasts[0]||null;
    if(!broadcast)return json({broadcast:null,items:[]});
    const items=await gate.sql`select id,broadcast_id,ordinal,kind,source_id,source_room,title,artist,state,selection_reason,scheduled_for,started_at,ended_at,failure_reason,created_at,updated_at from broadcast_items where broadcast_id=${broadcast.id}::uuid order by ordinal limit 250`;
    return json({broadcast,items});
  }catch(error){if(broadcastSchemaMissing(error))return json({error:'Broadcast schema is not installed'},503);throw error}
}



const BROADCAST_CATALOG=[
  ['roma','Pizzeria Roma',['The red booth','Closing time oregano','Receipt under the saucer']],
  ['window','The window seat',['Streetlights in water','Quiet between the buses','Blue room, warm cup']],
  ['long-way-home','The long way home',['Exit nineteen','Windows down','The road after sunset']],
  ['two-hundred','Two hundred to go',['Pump number four','Receipt in the wind','Coffee under neon']],
  ['one-more-log','Just one more log',['Cedar and wool','Snow against the door','Embers talking']],
  ['rooftop','Nobody wants to go in',['Orange on the parapet','Windows turning gold','Last glass before dark']],
  ['friends','A few good friends',['The long story','Glass on stone','Stay for another']],
  ['backroom','The backroom stage',['Before the encore','Red curtain hum','Mic left on']],
  ['headspace','A little headspace',['Margin notes','The second cup','Window open four inches']],
  ['last-bus','The last bus',['Doors closing','Nobody at the platform','Home through glass']],
  ['momentum','A little momentum',['Toast and sunlight','Before everyone wakes','Half a grapefruit']],
  ['between','Somewhere in between',['Room without an address','Almost remembered','Signal through fog']]
].flatMap(([room,roomName,titles])=>titles.map((title,index)=>({id:room+':'+(index+1),room,roomName,title})));
function broadcastHash(input){let h=2166136261>>>0;for(const ch of String(input)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function broadcastPlan(seed,count=12,room=''){
  const pool=room?BROADCAST_CATALOG.filter(track=>track.room===room):BROADCAST_CATALOG;
  if(!pool.length)throw new Error('Unknown broadcast room');
  const wanted=Math.max(1,Math.min(36,Number(count)||12)),recentWindow=Math.min(6,Math.max(0,pool.length-1)),chosen=[],cycle=new Set();
  for(let ordinal=0;ordinal<wanted;ordinal++){
    if(cycle.size>=pool.length)cycle.clear();
    const recent=new Set(chosen.slice(-recentWindow).map(track=>track.id));
    let available=pool.filter(track=>!cycle.has(track.id)&&!recent.has(track.id));
    if(!available.length)available=pool.filter(track=>!recent.has(track.id));
    available.sort((a,b)=>broadcastHash(seed+':'+ordinal+':'+a.id)-broadcastHash(seed+':'+ordinal+':'+b.id)||a.id.localeCompare(b.id));
    const picked=available[0]||pool[broadcastHash(seed+':fallback:'+ordinal)%pool.length];
    cycle.add(picked.id);chosen.push(picked);
  }
  return chosen.map((track,ordinal)=>({ordinal,source_id:track.id,source_room:track.room,title:track.title,selection_reason:{policy:'deterministic-first-party-v1',seed,room:room||null}}));
}
function broadcastCommandId(req){const value=String(req.headers.get('Idempotency-Key')||'').trim();return /^[A-Za-z0-9._:-]{8,128}$/.test(value)?value:''}

async function existingBroadcastCommand(sql,commandId){const rows=await sql`select broadcast_id,event_type,payload from broadcast_events where command_id=${commandId} limit 1`;return rows[0]||null}
async function adminBroadcastStart(req,env){
  const gate=await requireAdmin(req,env);if(gate.response)return gate.response;
  const commandId=broadcastCommandId(req);if(!commandId)return json({error:'Valid Idempotency-Key required'},400);
  let existing;try{existing=await existingBroadcastCommand(gate.sql,commandId)}catch(error){if(broadcastSchemaMissing(error))return json({error:'Broadcast schema is not installed'},503);throw error}if(existing)return json({ok:true,replayed:true,broadcastId:existing.broadcast_id,event:existing.event_type});
  const x=await body(req),name=String(x.name||'Afterlight Broadcast').trim().slice(0,120)||'Afterlight Broadcast',brief=String(x.brief||'').trim().slice(0,1000),seed=String(x.seed||new Date().toISOString().slice(0,10)).slice(0,128),room=String(x.room||'').trim().slice(0,64);
  let plan;try{plan=broadcastPlan(seed,x.count,room)}catch(error){return json({error:error.message},400)}
  try{
    const rows=await gate.sql`
      with created as (
        insert into broadcasts (name,status,brief,planner_seed,started_at,updated_at)
        values (${name},'live',${brief},${seed},now(),now()) returning id,name,status,brief,planner_seed,started_at
      ), inserted as (
        insert into broadcast_items (broadcast_id,ordinal,kind,source_id,source_room,title,state,selection_reason,scheduled_for)
        select created.id,p.ordinal,'track',p.source_id,p.source_room,p.title,'planned',p.selection_reason,now()
        from created cross join jsonb_to_recordset(${JSON.stringify(plan)}::jsonb)
          as p(ordinal integer,source_id text,source_room text,title text,selection_reason jsonb)
        returning id
      ), logged as (
        insert into broadcast_events (broadcast_id,event_type,payload,actor,command_id)
        select created.id,'broadcast.started',jsonb_build_object('count',${plan.length},'seed',${seed},'room',${room||null}),${String(gate.user.id)},${commandId} from created
        returning broadcast_id
      )
      select created.*, (select count(*)::int from inserted) as item_count from created`;
    return json({ok:true,broadcast:rows[0]||null},201);
  }catch(error){
    const replay=await existingBroadcastCommand(gate.sql,commandId);if(replay)return json({ok:true,replayed:true,broadcastId:replay.broadcast_id,event:replay.event_type});
    if(String(error?.message||'').includes('broadcasts_one_live_idx')||error?.code==='23505')return json({error:'A broadcast is already live'},409);
    if(broadcastSchemaMissing(error))return json({error:'Broadcast schema is not installed'},503);throw error;
  }
}
async function adminBroadcastStop(req,env){
  const gate=await requireAdmin(req,env);if(gate.response)return gate.response;
  const commandId=broadcastCommandId(req);if(!commandId)return json({error:'Valid Idempotency-Key required'},400);
  let existing;try{existing=await existingBroadcastCommand(gate.sql,commandId)}catch(error){if(broadcastSchemaMissing(error))return json({error:'Broadcast schema is not installed'},503);throw error}if(existing)return json({ok:true,replayed:true,broadcastId:existing.broadcast_id,event:existing.event_type});
  try{
    const rows=await gate.sql`
      with stopped as (
        update broadcasts set status='ended',ended_at=now(),updated_at=now()
        where id=(select id from broadcasts where status='live' order by started_at desc nulls last,created_at desc limit 1)
        returning id
      ), logged as (
        insert into broadcast_events (broadcast_id,event_type,payload,actor,command_id)
        select id,'broadcast.stopped','{}'::jsonb,${String(gate.user.id)},${commandId} from stopped returning broadcast_id
      )
      select broadcast_id from logged`;
    if(!rows[0])return json({error:'No live broadcast'},404);
    return json({ok:true,broadcastId:rows[0].broadcast_id});
  }catch(error){if(broadcastSchemaMissing(error))return json({error:'Broadcast schema is not installed'},503);throw error}
}
async function adminBroadcastItemCommand(req,env,itemId,action){
  const gate=await requireAdmin(req,env);if(gate.response)return gate.response;
  if(!validBroadcastId(itemId))return json({error:'Invalid broadcast item id'},400);
  const commandId=broadcastCommandId(req);if(!commandId)return json({error:'Valid Idempotency-Key required'},400);
  let existing;try{existing=await existingBroadcastCommand(gate.sql,commandId)}catch(error){if(broadcastSchemaMissing(error))return json({error:'Broadcast schema is not installed'},503);throw error}if(existing)return json({ok:true,replayed:true,broadcastId:existing.broadcast_id,event:existing.event_type});
  const nextState=action==='skip'?'skipped':'removed',eventType='broadcast.item.'+nextState;
  try{
    const rows=await gate.sql`
      with changed as (
        update broadcast_items set state=${nextState},ended_at=now(),updated_at=now()
        where id=${itemId}::uuid and state in ('planned','ready')
        returning id,broadcast_id,state
      ), logged as (
        insert into broadcast_events (broadcast_id,broadcast_item_id,event_type,payload,actor,command_id)
        select broadcast_id,id,${eventType},jsonb_build_object('state',state),${String(gate.user.id)},${commandId} from changed
        returning broadcast_id,broadcast_item_id
      )
      select * from logged`;
    if(!rows[0])return json({error:'Item is not eligible for '+action},409);
    return json({ok:true,...rows[0]});
  }catch(error){if(broadcastSchemaMissing(error))return json({error:'Broadcast schema is not installed'},503);throw error}
}
async function adminBroadcastEvents(req,env,url){
  const gate=await requireAdmin(req,env);if(gate.response)return gate.response;
  const requested=String(url.searchParams.get('broadcast_id')||'').trim();if(requested&&!validBroadcastId(requested))return json({error:'Invalid broadcast id'},400);
  const limit=Math.max(1,Math.min(100,Number(url.searchParams.get('limit'))||25));
  try{
    const broadcasts=requested?await gate.sql`select id from broadcasts where id=${requested}::uuid limit 1`:await gate.sql`select id from broadcasts order by (status='live') desc,created_at desc limit 1`;
    const broadcastId=broadcasts[0]?.id;if(!broadcastId)return json({broadcastId:null,events:[]});
    const events=await gate.sql`select id,broadcast_id,broadcast_item_id,event_type,payload,actor,command_id,created_at from broadcast_events where broadcast_id=${broadcastId}::uuid order by created_at desc,id desc limit ${limit}`;
    return json({broadcastId,events});
  }catch(error){if(broadcastSchemaMissing(error))return json({error:'Broadcast schema is not installed'},503);throw error}
}


async function stripe(env,path,params){
  if(!env.STRIPE_RESTRICTED_KEY)throw new Error('Stripe is not configured');
  const form=new URLSearchParams();for(const [k,v] of Object.entries(params||{}))if(v!==undefined&&v!==null)form.set(k,String(v));
  const r=await fetch('https://api.stripe.com/v1/'+path,{method:'POST',headers:{Authorization:'Bearer '+env.STRIPE_RESTRICTED_KEY,'Stripe-Version':STRIPE_VERSION,'Content-Type':'application/x-www-form-urlencoded'},body:form});
  const data=await r.json();if(!r.ok)throw new Error(data?.error?.message||'Stripe request failed');return data;
}

async function me(req,env){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  const profile=await ensureProfile(auth.user,env),subscription=await subscriptionFor(auth.user.id,env),preferences=await preferenceFor(auth.user.id,env),admin=await adminForUser(auth.user,env);
  const premium=!!subscription&&ACTIVE.has(subscription.status)&&(!subscription.current_period_end||new Date(subscription.current_period_end).getTime()>Date.now());
  return json({user:{id:auth.user.id,email:auth.user.email,name:auth.user.name},profile,subscription,premium,preferences,admin});
}
async function preferences(req,env){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  if(req.method==='GET')return json({preferences:await preferenceFor(auth.user.id,env)});
  const x=await body(req),favorites=Array.isArray(x.favorites)?x.favorites.slice(0,30).map(String):[],favCsv=favorites.join(',');
  const sql=db(env);
  const rows=await sql`insert into user_preferences (user_id,favorites,last_room,last_track,volume,muted,timer_end,updated_at)
    values (${auth.user.id}::uuid,coalesce(string_to_array(${favCsv},','),array[]::text[]),${String(x.last_room||'rooftop').slice(0,64)},${Math.max(0,Math.min(2,Number(x.last_track)||0))},${Math.max(0,Math.min(100,Number(x.volume)||0))},${!!x.muted},${x.timer_end||null}::timestamptz,now())
    on conflict (user_id) do update set favorites=excluded.favorites,last_room=excluded.last_room,last_track=excluded.last_track,volume=excluded.volume,muted=excluded.muted,timer_end=excluded.timer_end,updated_at=now()
    returning *`;
  return json({preferences:rows[0]});
}
async function checkout(req,env){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  const x=await body(req),plan=x.plan==='annual'?'annual':'monthly',base=PAYMENT_LINKS[plan];if(!base)return json({error:'Checkout is not configured'},503);
  const u=new URL(base);u.searchParams.set('client_reference_id',auth.user.id);if(auth.user.email)u.searchParams.set('locked_prefilled_email',auth.user.email);
  return json({url:u.toString(),mode:'payment_link'});
}
async function portal(req,env){
  const auth=await authSession(req,env);if(!auth?.user)return json({error:'Sign in required'},401);
  const profile=await ensureProfile(auth.user,env);if(!profile.stripe_customer_id)return json({error:'No billing account found'},404);
  if(!env.STRIPE_RESTRICTED_KEY)return json({error:'Billing portal is awaiting Stripe account activation'},503);
  const p=await stripe(env,'billing_portal/sessions',{customer:profile.stripe_customer_id,return_url:originOf(req)+'/account/'});return json({url:p.url});
}
async function events(req,env){
  if(!env.DATABASE_URL)return json({accepted:true},202);
  const auth=await authSession(req,env),x=await body(req),allowed=new Set(['page_view','play','pause','favorite','timer_set','upgrade_view','checkout_started','checkout_return','sign_in','sign_up','client_error','offline_room_saved','offline_room_removed','queue_repeat_one','queue_finished','queue_shuffle_changed','queue_repeat_changed','library_opened','library_track_selected']),event=allowed.has(x.event)?x.event:'unknown',sql=db(env);
  await sql`insert into analytics_events (user_id,session_id,event_name,room_slug,properties,created_at) values (${auth?.user?.id||null}::uuid,${String(x.session_id||'').slice(0,128)||null},${event},${x.room_slug?String(x.room_slug).slice(0,64):null},${JSON.stringify(typeof x.properties==='object'&&x.properties?x.properties:{})}::jsonb,now())`;
  return json({accepted:true},202);
}
function hex(bytes){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function safeEq(a,b){if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
async function verifyStripe(raw,signature,secret){
  const pairs=(signature||'').split(',').map(p=>p.split('=',2)),t=pairs.find(p=>p[0]==='t')?.[1],v1=pairs.find(p=>p[0]==='v1')?.[1];if(!t||!v1||Math.abs(Date.now()/1000-Number(t))>300)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(t+'.'+raw));return safeEq(hex(sig),v1);
}
async function resolveUserByCustomer(customer,env){if(!customer)return null;const sql=db(env),rows=await sql`select user_id from profiles where stripe_customer_id=${customer} limit 1`;return rows[0]?.user_id||null}
async function syncSubscription(obj,env){
  let userId=obj.metadata?.user_id||null;if(!userId)userId=await resolveUserByCustomer(typeof obj.customer==='string'?obj.customer:obj.customer?.id,env);if(!userId)return;
  const customer=typeof obj.customer==='string'?obj.customer:obj.customer?.id||null,period=obj.current_period_end?new Date(obj.current_period_end*1000).toISOString():null,sql=db(env);
  await sql`insert into subscriptions (user_id,stripe_customer_id,stripe_subscription_id,plan,status,current_period_end,cancel_at_period_end,updated_at)
    values (${userId}::uuid,${customer},${obj.id},${obj.metadata?.plan||'unknown'},${obj.status},${period}::timestamptz,${!!obj.cancel_at_period_end},now())
    on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,plan=excluded.plan,status=excluded.status,current_period_end=excluded.current_period_end,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now()`;
  if(customer)await sql`insert into profiles (user_id,stripe_customer_id,updated_at) values (${userId}::uuid,${customer},now()) on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,updated_at=now()`;
}
async function webhook(req,env){
  const raw=await req.text(),signature=req.headers.get('Stripe-Signature');if(!env.STRIPE_WEBHOOK_SECRET||!await verifyStripe(raw,signature,env.STRIPE_WEBHOOK_SECRET))return json({error:'Invalid signature'},400);
  const event=JSON.parse(raw),obj=event.data?.object||{};
  if(event.type==='checkout.session.completed'){
    const userId=obj.client_reference_id||obj.metadata?.user_id,customer=typeof obj.customer==='string'?obj.customer:obj.customer?.id,subscription=typeof obj.subscription==='string'?obj.subscription:obj.subscription?.id,plan=obj.metadata?.plan||'unknown';
    if(userId&&customer){
      const sql=db(env);
      await sql`insert into profiles (user_id,stripe_customer_id,updated_at) values (${userId}::uuid,${customer},now()) on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,updated_at=now()`;
      if(subscription)await sql`insert into subscriptions (user_id,stripe_customer_id,stripe_subscription_id,plan,status,updated_at) values (${userId}::uuid,${customer},${subscription},${plan},'active',now()) on conflict (user_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,plan=excluded.plan,status='active',updated_at=now()`;
    }
  }
  if(event.type==='customer.subscription.created'||event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted')await syncSubscription(obj,env);
  return json({received:true});
}
async function support(req,env){
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const x=await body(req),email=String(x.email||'').trim().slice(0,320),message=String(x.message||'').trim().slice(0,5000),subject=String(x.subject||'General').trim().slice(0,120);
  if(!email.includes('@')||message.length<10)return json({error:'Please provide a valid email and a little more detail.'},400);
  const auth=await authSession(req,env),sql=db(env);
  await sql`insert into support_requests (user_id,email,subject,message,status,created_at) values (${auth?.user?.id||null}::uuid,${email},${subject},${message},'open',now())`;
  return json({ok:true},201);
}
async function api(req,env,url){
  if(url.pathname.startsWith('/api/auth/'))return authProxy(req,env,url);
  if(url.pathname==='/api/health')return json({ok:true,configured:configured(env),backend:'neon'});
  if(url.pathname==='/api/ready'){const c=configured(env);let database=false;if(c.data)try{const sql=db(env);const rows=await sql`select 1 as ok`;database=rows?.[0]?.ok===1}catch{}return json({ok:c.auth&&database&&c.checkout&&c.webhook,auth:c.auth,database,checkout:c.checkout,webhook:c.webhook,portal:c.portal,backend:'neon'})}
  if(url.pathname==='/api/config'){const c=configured(env);return json({authEnabled:c.auth,billingEnabled:c.checkout,portalEnabled:c.portal,webhookEnabled:c.webhook,supportEnabled:c.data,externalLibraryEnabled:c.externalLibrary})}
  if(url.pathname==='/api/me'&&req.method==='GET')return me(req,env);
  if(url.pathname==='/api/preferences'&&(req.method==='GET'||req.method==='PUT'))return preferences(req,env);
  if(url.pathname==='/api/checkout'&&req.method==='POST')return checkout(req,env);
  if(url.pathname==='/api/portal'&&req.method==='POST')return portal(req,env);
  if(url.pathname==='/api/events'&&req.method==='POST')return events(req,env);
  if(url.pathname==='/api/admin/summary'&&req.method==='GET')return adminSummary(req,env);
  if(url.pathname==='/api/admin/users'&&req.method==='GET')return adminUsers(req,env,url);
  if(url.pathname==='/api/admin/broadcast/status'&&req.method==='GET')return adminBroadcastStatus(req,env);
  if(url.pathname==='/api/admin/broadcast/lineup'&&req.method==='GET')return adminBroadcastLineup(req,env,url);
  if(url.pathname==='/api/admin/broadcast/events'&&req.method==='GET')return adminBroadcastEvents(req,env,url);
  if(url.pathname==='/api/admin/broadcast/start'&&req.method==='POST')return adminBroadcastStart(req,env);
  if(url.pathname==='/api/admin/broadcast/stop'&&req.method==='POST')return adminBroadcastStop(req,env);
  {const m=url.pathname.match(new RegExp('^/api/admin/broadcast/items/([0-9a-f-]+)/(skip|remove)$','i'));if(m&&req.method==='POST')return adminBroadcastItemCommand(req,env,m[1],m[2]);}
  if(url.pathname==='/api/library/provider/status'&&req.method==='GET')return providerStatus(req,env);
  if(url.pathname==='/api/library/provider/search'&&req.method==='GET')return providerSearch(req,env,url);
  if(url.pathname==='/api/library/provider/lyrics'&&req.method==='GET')return providerLyrics(req,env,url);
  if(url.pathname==='/api/library/provider/stream'&&(req.method==='GET'||req.method==='HEAD'))return providerBinary(req,env,url,'stream');
  if(url.pathname==='/api/library/provider/artwork'&&(req.method==='GET'||req.method==='HEAD'))return providerBinary(req,env,url,'artwork');
  if(url.pathname==='/api/support'&&req.method==='POST')return support(req,env);
  if(url.pathname==='/api/stripe/webhook'&&req.method==='POST')return webhook(req,env);
  return json({error:'Not found'},404);
}

export async function handleApi(req,env){const url=new URL(req.url);return api(req,env,url)}

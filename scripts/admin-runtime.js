(()=>{
  const state={offset:0,limit:50,total:0,users:[],timer:null};
  const $=id=>document.getElementById(id);
  const fmtDate=value=>value?new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
  const fmtCount=value=>new Intl.NumberFormat().format(Number(value)||0);
  const api=async path=>{
    const response=await fetch(path,{headers:{Accept:'application/json'},credentials:'same-origin',cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){const error=new Error(data.error||'Request failed');error.status=response.status;throw error}
    return data;
  };
  const subscriptionLabel=user=>{
    const status=user.subscription_status||'free';
    return status==='free'?'Free':status.replaceAll('_',' ');
  };
  const pillClass=status=>status==='active'||status==='trialing'?'good':status==='past_due'?'warn':status==='banned'?'danger':'';
  const setText=(id,value)=>{$(id).textContent=String(value??'—')};

  async function loadSummary(){
    const data=await api('/api/admin/summary');
    setText('mUsers',fmtCount(data.total_users));
    setText('mVerified',fmtCount(data.verified_users));
    setText('mPremium',fmtCount(data.active_subscriptions));
    setText('mNew',fmtCount(data.new_users_7d));
    setText('mEvents',fmtCount(data.events_24h));
    setText('mSupport',fmtCount(data.open_support));
    $('adminNotice').textContent=data.total_users===0
      ? 'No registered Neon Auth users exist yet. The portal is live and will populate automatically as people create accounts.'
      : 'Showing the canonical Neon Auth directory, not only users who have already created an Afterlight profile row.';
  }

  function query(){
    const p=new URLSearchParams({
      offset:String(state.offset),limit:String(state.limit),
      q:$('search').value.trim(),
      subscription:$('subscription').value,
      verified:$('verified').value,
      account_state:$('accountState').value
    });
    return '/api/admin/users?'+p.toString();
  }

  function row(user){
    const tr=document.createElement('tr');tr.dataset.user=user.id;
    const userCell=document.createElement('td');
    const name=document.createElement('div');name.className='name';name.textContent=user.name||'Listener';
    const email=document.createElement('span');email.className='sub';email.textContent=user.email;
    userCell.append(name,email);
    if(user.banned){const b=document.createElement('span');b.className='pill danger';b.textContent='Banned';userCell.append(document.createElement('br'),b)}
    const joined=document.createElement('td');joined.textContent=fmtDate(user.created_at);
    const membership=document.createElement('td');const mp=document.createElement('span');mp.className='pill '+pillClass(user.subscription_status);mp.textContent=subscriptionLabel(user);membership.appendChild(mp);
    const activity=document.createElement('td');activity.textContent=fmtDate(user.last_activity);
    const room=document.createElement('td');room.textContent=user.last_room||'—';
    const events=document.createElement('td');events.textContent=fmtCount(user.event_count);
    const support=document.createElement('td');support.textContent=user.open_support?user.open_support+' open / '+user.support_count:user.support_count||'0';
    tr.append(userCell,joined,membership,activity,room,events,support);
    tr.addEventListener('click',()=>openDetail(user));
    return tr;
  }

  function detailRow(label,value){
    const wrap=document.createElement('div');wrap.className='detailrow';
    const l=document.createElement('span');l.textContent=label;
    const v=document.createElement('b');v.textContent=String(value??'—');
    wrap.append(l,v);return wrap;
  }

  function openDetail(user){
    $('detailName').textContent=user.name||'Listener';
    const grid=$('detailGrid');grid.replaceChildren(
      detailRow('Email',user.email),
      detailRow('Email verified',user.email_verified?'Yes':'No'),
      detailRow('User ID',user.id),
      detailRow('Role',user.role||'listener'),
      detailRow('Joined',fmtDate(user.created_at)),
      detailRow('Account state',user.banned?'Banned':'Active'),
      detailRow('Membership',subscriptionLabel(user)),
      detailRow('Plan',user.plan||'—'),
      detailRow('Access through',fmtDate(user.current_period_end)),
      detailRow('Stripe profile',user.has_billing_profile?'Linked':'Not linked'),
      detailRow('Last activity',fmtDate(user.last_activity)),
      detailRow('Events',fmtCount(user.event_count)),
      detailRow('Last room',user.last_room||'—'),
      detailRow('Favorite rooms',fmtCount(user.favorites_count)),
      detailRow('Support requests',fmtCount(user.support_count)),
      detailRow('Open support',fmtCount(user.open_support))
    );
    $('detailDialog').showModal();
  }

  async function loadUsers(){
    const data=await api(query());
    state.total=Number(data.total)||0;state.users=Array.isArray(data.users)?data.users:[];
    const rows=$('rows');rows.replaceChildren(...state.users.map(row));
    $('empty').hidden=state.users.length>0;
    const start=state.total?state.offset+1:0,end=Math.min(state.offset+state.users.length,state.total);
    $('pageStatus').textContent=`${fmtCount(start)}–${fmtCount(end)} of ${fmtCount(state.total)} users`;
    $('prev').disabled=state.offset<=0;
    $('next').disabled=state.offset+state.limit>=state.total;
  }

  async function boot(){
    try{
      await loadSummary();
      $('gate').hidden=true;$('console').hidden=false;
      await loadUsers();
    }catch(error){
      const message=error.status===401?'Sign in to an Afterlight account before opening the operator console.'
        :error.status===403?'Your signed-in account does not have Afterlight admin access.'
        :'The admin console could not load right now.';
      $('gateMessage').textContent=message;
      $('gate').querySelector('h2').textContent=error.status===403?'Admin access required':error.status===401?'Sign in required':'Admin console unavailable';
    }
  }

  const refresh=()=>{clearTimeout(state.timer);state.timer=setTimeout(()=>{state.offset=0;loadUsers().catch(()=>{})},220)};
  $('search').addEventListener('input',refresh);
  for(const id of ['subscription','verified','accountState'])$(id).addEventListener('change',()=>{state.offset=0;loadUsers().catch(()=>{})});
  $('prev').onclick=()=>{state.offset=Math.max(0,state.offset-state.limit);loadUsers().catch(()=>{})};
  $('next').onclick=()=>{state.offset+=state.limit;loadUsers().catch(()=>{})};
  $('detailClose').onclick=()=>$('detailDialog').close();
  boot();
})();
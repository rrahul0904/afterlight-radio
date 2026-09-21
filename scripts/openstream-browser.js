(()=>{
  let enabled=false;
  let loading=false;
  let switcher=null;
  let panel=null;
  let ownedSearch=null;
  let ownedCount=null;
  let ownedResults=null;

  const jsonFetch=async path=>{
    const response=await fetch(path,{headers:{Accept:'application/json'},credentials:'same-origin'});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw Object.assign(new Error(data?.error||'OpenStream request failed'),{status:response.status,data});
    return data;
  };

  function escapeText(value){return String(value??'')}

  function style(){
    if(document.getElementById('afterlightOpenStreamStyles'))return;
    const el=document.createElement('style');
    el.id='afterlightOpenStreamStyles';
    el.textContent=`
      .library-source-switch{display:flex;gap:8px;margin:16px 0 4px}
      .library-source-switch[hidden]{display:none}
      .library-source-btn{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:inherit;border-radius:999px;padding:8px 12px;cursor:pointer}
      .library-source-btn.active{background:#f1dfc6;color:#1e1914}
      .openstream-panel{display:grid;gap:14px;margin-top:12px}
      .openstream-panel[hidden]{display:none}
      .openstream-section{display:grid;gap:8px}
      .openstream-section h3{font-size:12px;text-transform:uppercase;letter-spacing:.12em;opacity:.62;margin:6px 0 0}
      .openstream-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:11px 13px;border-radius:12px;background:rgba(255,255,255,.055)}
      .openstream-row span:first-child{display:grid;gap:3px;min-width:0}.openstream-row strong,.openstream-row small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .openstream-row small{opacity:.62}.openstream-badge{font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.65}
      .openstream-note{font-size:12px;line-height:1.5;opacity:.68;margin:2px 0}
    `;
    document.head.appendChild(el);
  }

  function makeRow(primary,secondary,badge){
    const row=document.createElement('div');
    row.className='openstream-row';
    const copy=document.createElement('span');
    const title=document.createElement('strong');
    title.textContent=escapeText(primary);
    const meta=document.createElement('small');
    meta.textContent=escapeText(secondary);
    copy.append(title,meta);
    const tag=document.createElement('span');
    tag.className='openstream-badge';
    tag.textContent=escapeText(badge);
    row.append(copy,tag);
    return row;
  }

  function showOwned(){
    if(!panel)return;
    panel.hidden=true;
    if(ownedSearch)ownedSearch.hidden=false;
    if(ownedCount)ownedCount.hidden=false;
    if(ownedResults)ownedResults.hidden=false;
    switcher?.querySelector('[data-source="afterlight"]')?.classList.add('active');
    switcher?.querySelector('[data-source="openstream"]')?.classList.remove('active');
  }

  async function showOpenStream(){
    if(!enabled||!panel||loading)return;
    loading=true;
    if(ownedSearch)ownedSearch.hidden=true;
    if(ownedCount)ownedCount.hidden=true;
    if(ownedResults)ownedResults.hidden=true;
    panel.hidden=false;
    panel.replaceChildren();
    const loadingText=document.createElement('p');
    loadingText.className='openstream-note';
    loadingText.textContent='Loading your self-hosted library…';
    panel.appendChild(loadingText);
    switcher?.querySelector('[data-source="afterlight"]')?.classList.remove('active');
    switcher?.querySelector('[data-source="openstream"]')?.classList.add('active');

    try{
      const [library,channels]=await Promise.all([
        jsonFetch('/api/providers/openstream/library'),
        jsonFetch('/api/providers/openstream/channels')
      ]);
      panel.replaceChildren();

      const librarySection=document.createElement('section');
      librarySection.className='openstream-section';
      const libraryTitle=document.createElement('h3');
      libraryTitle.textContent='Server library';
      librarySection.appendChild(libraryTitle);
      const items=Array.isArray(library.items)?library.items:[];
      if(!items.length){
        const empty=document.createElement('p');empty.className='openstream-note';empty.textContent='No server library items were returned.';librarySection.appendChild(empty);
      }else{
        for(const item of items.slice(0,200)){
          librarySection.appendChild(makeRow(item.name||'Untitled',item.path||item.type||'',item.type||'file'));
        }
      }

      const channelSection=document.createElement('section');
      channelSection.className='openstream-section';
      const channelTitle=document.createElement('h3');
      channelTitle.textContent='Active channels';
      channelSection.appendChild(channelTitle);
      const list=Array.isArray(channels.channels)?channels.channels:[];
      if(!list.length){
        const empty=document.createElement('p');empty.className='openstream-note';empty.textContent='No active OpenStream channels.';channelSection.appendChild(empty);
      }else{
        for(const channel of list.slice(0,100)){
          channelSection.appendChild(makeRow(channel.name||channel.id,channel.state||'unknown',channel.listeners==null?'channel':channel.listeners+' listeners'));
        }
      }

      const note=document.createElement('p');
      note.className='openstream-note';
      note.textContent='Browsing is enabled. Secure hosted playback remains gated until the HLS proxy transport is certified.';
      panel.append(librarySection,channelSection,note);
    }catch(error){
      panel.replaceChildren();
      const message=document.createElement('p');
      message.className='openstream-note';
      message.textContent=error.status===401?'Sign in to browse your self-hosted music.':'Your self-hosted library is temporarily unavailable.';
      panel.appendChild(message);
    }finally{loading=false}
  }

  async function refresh(){
    try{
      const status=await jsonFetch('/api/providers/openstream/status');
      enabled=!!status.enabled&&status.reachable!==false;
    }catch{enabled=false}
    if(switcher)switcher.hidden=!enabled;
    if(!enabled)showOwned();
    return enabled;
  }

  function install(){
    const dialog=document.getElementById('libraryBrowser');
    const shell=dialog?.querySelector('.library-shell');
    if(!dialog||!shell||document.getElementById('openstreamSourceSwitch'))return false;
    style();
    ownedSearch=dialog.querySelector('#librarySearch');
    ownedCount=dialog.querySelector('#libraryCount');
    ownedResults=dialog.querySelector('#libraryResults');

    switcher=document.createElement('div');
    switcher.id='openstreamSourceSwitch';
    switcher.className='library-source-switch';
    switcher.hidden=true;
    const afterlight=document.createElement('button');
    afterlight.type='button';afterlight.className='library-source-btn active';afterlight.dataset.source='afterlight';afterlight.textContent='Afterlight';
    const external=document.createElement('button');
    external.type='button';external.className='library-source-btn';external.dataset.source='openstream';external.textContent='Self-hosted';
    switcher.append(afterlight,external);

    panel=document.createElement('div');
    panel.id='openstreamPanel';
    panel.className='openstream-panel';
    panel.hidden=true;

    const head=dialog.querySelector('.library-head');
    head?.insertAdjacentElement('afterend',switcher);
    ownedResults?.insertAdjacentElement('afterend',panel);

    afterlight.onclick=showOwned;
    external.onclick=showOpenStream;
    dialog.addEventListener('close',showOwned);

    const libraryButton=document.getElementById('libraryBtn');
    libraryButton?.addEventListener('click',()=>refresh());
    return true;
  }

  if(!install()){
    const observer=new MutationObserver(()=>{if(install())observer.disconnect()});
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  window.__afterlightOpenStream={
    version:1,
    refresh,
    showOwned,
    showOpenStream,
    get enabled(){return enabled}
  };
})();
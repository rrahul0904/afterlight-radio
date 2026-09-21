(()=>{
  const normalize=value=>String(value||'').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
  let dialog=null;
  let searchInput=null;
  let resultHost=null;

  function catalog(){
    try{
      return R.flatMap((room,roomIndex)=>room.tracks.map((title,trackIndex)=>({
        id:room.slug+':'+trackIndex,
        roomIndex,
        trackIndex,
        room:room.slug,
        roomName:room.name,
        mood:room.mood,
        title,
        source:'/audio/'+room.slug+'/'+(trackIndex+1)+'.wav',
        search:normalize([title,room.name,room.mood,room.story].join(' '))
      })));
    }catch{return []}
  }

  const entries=catalog();

  function matches(entry,query){
    const q=normalize(query).trim();
    if(!q)return true;
    return q.split(/\s+/).every(token=>entry.search.includes(token));
  }

  function filtered(query=''){
    return entries.filter(entry=>matches(entry,query));
  }

  function notify(message){
    try{if(typeof toast==='function')return toast(message)}catch{}
    console.info('[Afterlight library]',message);
  }

  function select(entry){
    const target=R[entry.roomIndex];
    if(!target)return false;
    try{
      if(typeof isFree==='function'&&!isFree(target)&&!accountState?.premium){
        i=entry.roomIndex;
        t=entry.trackIndex;
        render(true);
        if(typeof premiumGate==='function')premiumGate(target);
        dialog?.close();
        return false;
      }
    }catch{}
    i=entry.roomIndex;
    t=entry.trackIndex;
    render(true);
    source(false);
    dialog?.close();
    notify(target.name+' · '+entry.title);
    if(typeof trackEvent==='function')trackEvent('library_track_selected',{room:target.slug,track:entry.trackIndex});
    return true;
  }

  function render(query=''){
    if(!resultHost)return;
    const list=filtered(query);
    resultHost.replaceChildren();
    if(!list.length){
      const empty=document.createElement('p');
      empty.className='library-empty';
      empty.textContent='No Afterlight tracks match that search.';
      resultHost.appendChild(empty);
    }else{
      for(const entry of list){
        const row=document.createElement('button');
        row.type='button';
        row.className='library-track-row';
        row.dataset.libraryTrack=entry.id;
        row.setAttribute('aria-label','Play '+entry.title+' from '+entry.roomName);
        const copy=document.createElement('span');
        const title=document.createElement('strong');
        title.textContent=entry.title;
        const meta=document.createElement('small');
        meta.textContent=entry.roomName+' · '+entry.mood;
        copy.append(title,meta);
        const number=document.createElement('span');
        number.className='library-track-number';
        number.textContent=String(entry.trackIndex+1).padStart(2,'0');
        row.append(copy,number);
        row.addEventListener('click',()=>select(entry));
        resultHost.appendChild(row);
      }
    }
    const count=dialog?.querySelector('#libraryCount');
    if(count)count.textContent=list.length+' of '+entries.length+' tracks';
  }

  function installStyles(){
    if(document.getElementById('afterlightLibraryBrowserStyles'))return;
    const style=document.createElement('style');
    style.id='afterlightLibraryBrowserStyles';
    style.textContent=`
      .library-browser{width:min(720px,calc(100vw - 24px));max-height:min(84vh,780px);border:0;border-radius:18px;padding:0;background:#171512;color:#f7efe5;box-shadow:0 28px 80px rgba(0,0,0,.48)}
      .library-browser::backdrop{background:rgba(7,6,5,.64);backdrop-filter:blur(8px)}
      .library-shell{padding:22px}.library-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.library-head h2{margin:4px 0 0;font-size:26px}
      .library-kicker{font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.62}.library-close{width:40px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:transparent;color:inherit;cursor:pointer}
      .library-search{width:100%;box-sizing:border-box;margin:18px 0 8px;padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:inherit;font:inherit;outline:none}
      .library-search:focus{border-color:rgba(241,223,198,.8)}.library-count{font-size:11px;opacity:.58;margin-bottom:12px}
      .library-results{display:grid;gap:7px;max-height:54vh;overflow:auto;padding-right:3px}.library-track-row{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;width:100%;border:0;border-radius:12px;padding:11px 13px;background:rgba(255,255,255,.055);color:inherit;text-align:left;cursor:pointer}
      .library-track-row:hover,.library-track-row:focus-visible{background:rgba(255,255,255,.11)}.library-track-row span:first-child{display:grid;gap:3px}.library-track-row small{opacity:.62}.library-track-number{font-variant-numeric:tabular-nums;opacity:.48}
      .library-empty{opacity:.66;padding:20px 4px}@media(max-width:600px){.library-shell{padding:16px}.library-results{max-height:58vh}}
    `;
    document.head.appendChild(style);
  }

  function install(){
    if(document.getElementById('libraryBrowser'))return;
    installStyles();
    dialog=document.createElement('dialog');
    dialog.id='libraryBrowser';
    dialog.className='library-browser';
    dialog.innerHTML=`
      <div class="library-shell">
        <div class="library-head"><div><span class="library-kicker">Owned Afterlight catalog</span><h2>Music library</h2></div><button id="libraryClose" class="library-close" type="button" aria-label="Close library">×</button></div>
        <input id="librarySearch" class="library-search" type="search" autocomplete="off" placeholder="Search tracks, places, or moods" aria-label="Search Afterlight music library">
        <div id="libraryCount" class="library-count"></div>
        <div id="libraryResults" class="library-results"></div>
      </div>`;
    document.body.appendChild(dialog);
    searchInput=dialog.querySelector('#librarySearch');
    resultHost=dialog.querySelector('#libraryResults');
    dialog.querySelector('#libraryClose').onclick=()=>dialog.close();
    searchInput.addEventListener('input',()=>render(searchInput.value));
    dialog.addEventListener('close',()=>{searchInput.value='';render('')});

    const tools=document.querySelector('.room-tools');
    if(tools&&!document.getElementById('libraryBtn')){
      const button=document.createElement('button');
      button.id='libraryBtn';
      button.className='pill';
      button.type='button';
      button.textContent='Library';
      button.onclick=()=>{
        render('');
        dialog.showModal();
        searchInput.focus();
        if(typeof trackEvent==='function')trackEvent('library_opened',{tracks:entries.length});
      };
      tools.appendChild(button);
    }
    render('');
  }

  install();

  window.__afterlightCatalog={
    version:1,
    count:entries.length,
    all:()=>entries.map(entry=>({...entry,search:undefined})),
    search:query=>filtered(query).map(entry=>({...entry,search:undefined})),
    select
  };
})();
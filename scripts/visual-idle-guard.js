(()=>{
  'use strict';

  const HIDDEN_CLASS='afterlight-visual-hidden';
  const COMMON=['.top','.room-nav','.foot','.room-tools','.story'];
  const MODE_TARGETS={
    default:[],
    focus:['.copy'],
    canvas:['.copy','.player']
  };

  function clearHidden(){
    document.querySelectorAll('.'+HIDDEN_CLASS).forEach(node=>node.classList.remove(HIDDEN_CLASS));
  }

  function targetsForState(){
    const body=document.body;
    if(!body||body.dataset.autoHide!=='true'||!body.classList.contains('visual-idle'))return [];
    const mode=MODE_TARGETS[body.dataset.displayMode]?body.dataset.displayMode:'default';
    return [...new Set([...COMMON,...MODE_TARGETS[mode]])];
  }

  function sync(){
    clearHidden();
    for(const selector of targetsForState()){
      document.querySelectorAll(selector).forEach(node=>node.classList.add(HIDDEN_CLASS));
    }
  }

  function injectStyle(){
    if(document.getElementById('afterlightVisualIdleGuardStyle'))return;
    const style=document.createElement('style');
    style.id='afterlightVisualIdleGuardStyle';
    style.textContent=`
      .afterlight-visual-hidden{opacity:0!important;pointer-events:none!important;transition:opacity .35s ease!important}
      @media(prefers-reduced-motion:reduce){.afterlight-visual-hidden{transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function init(){
    injectStyle();
    sync();
    new MutationObserver(sync).observe(document.body,{
      attributes:true,
      attributeFilter:['class','data-auto-hide','data-display-mode']
    });
    new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
    window.__afterlightVisualIdleGuard={sync};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();

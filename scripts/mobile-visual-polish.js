(()=>{
  const style=document.createElement('style');
  style.id='afterlightMobileVisualPolish';
  style.textContent=`
    .painted-scene svg{preserve-aspect-ratio:xMidYMid slice}
    @media(max-width:800px){
      .top{padding:16px max(17px,env(safe-area-inset-right)) 16px max(17px,env(safe-area-inset-left));gap:10px}
      .top .brand{flex:1;min-width:0;text-align:left;white-space:nowrap}
      .top .actions{gap:3px;flex:0 0 auto}
      .top .actions #accountBtn{display:inline-flex!important;align-items:center;justify-content:center;min-height:44px;padding:0 8px;font-size:8px;letter-spacing:.12em;opacity:.88}
      .top .actions .round{width:44px;height:44px;flex:0 0 44px}
      .painted-scene svg{transform:none!important;width:100%;height:100%}
      .account{width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:auto;padding:25px 20px 22px;border-radius:14px}
      .account h2{font-size:clamp(36px,11vw,52px)}
      .google-auth{min-height:50px!important}
    }
    @media(max-width:430px){
      .top .brand{font-size:9px;letter-spacing:.16em}
      .top .actions #accountBtn{font-size:7.5px;padding:0 5px}
      .copy{left:20px;right:20px}
    }
  `;
  document.head.appendChild(style);

  function fixSceneFraming(){
    const host=document.getElementById('paintedScene');
    const svg=host?.querySelector('svg');
    if(svg&&svg.getAttribute('preserveAspectRatio')!=='xMidYMid slice')svg.setAttribute('preserveAspectRatio','xMidYMid slice');
  }
  fixSceneFraming();
  const host=document.getElementById('paintedScene');
  if(host)new MutationObserver(fixSceneFraming).observe(host,{childList:true,subtree:false});
  window.addEventListener('popstate',fixSceneFraming);
})();

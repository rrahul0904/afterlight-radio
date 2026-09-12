(()=>{
  const style=document.createElement('style');
  style.id='afterlightMobileVisualPolish';
  style.textContent=`
    .painted-scene svg{preserve-aspect-ratio:xMidYMid slice}
    #homeAccount{min-height:44px}
    .home-card[data-room],.thumb[data-room]{background-size:cover;background-position:center}
    .home-card[data-room]::before,.thumb[data-room]::before{display:none}
    .home-card[data-room]::after{height:62%;background:linear-gradient(180deg,transparent,rgba(7,6,5,.86))}
    .thumb[data-room]::after{height:45%;background:linear-gradient(180deg,transparent,rgba(7,6,5,.7));clip-path:none}
    .home-card[data-room="rooftop"],.thumb[data-room="rooftop"]{background-image:radial-gradient(circle at 74% 22%,#ffd689 0 9%,transparent 10%),linear-gradient(155deg,transparent 48%,#25232b 49% 60%,transparent 61%),linear-gradient(180deg,#d99776 0 52%,#6f5368 53% 66%,#17171d 67% 100%)}
    .home-card[data-room="window"],.thumb[data-room="window"]{background-image:repeating-linear-gradient(104deg,transparent 0 20px,rgba(230,241,245,.17) 21px 22px,transparent 23px 43px),radial-gradient(circle at 25% 60%,#e7bd72 0 4%,transparent 8%),radial-gradient(circle at 68% 52%,#d5ad6c 0 4%,transparent 9%),linear-gradient(90deg,#263945 0 72%,#211a17 73% 100%)}
    .home-card[data-room="roma"],.thumb[data-room="roma"]{background-image:linear-gradient(90deg,transparent 0 62%,rgba(239,226,199,.92) 63% 88%,transparent 89%),repeating-linear-gradient(0deg,transparent 0 32px,rgba(246,226,196,.09) 33px 35px),linear-gradient(180deg,#6a332d 0 60%,#261a17 61%)}
    .home-card[data-room="long-way-home"],.thumb[data-room="long-way-home"]{background-image:radial-gradient(circle at 78% 17%,#d7d9cd 0 7%,transparent 8%),linear-gradient(105deg,transparent 0 43%,#272b34 44% 56%,transparent 57%),linear-gradient(180deg,#26364c,#101620 61%,#090b10 62%)}
    .home-card[data-room="two-hundred"],.thumb[data-room="two-hundred"]{background-image:linear-gradient(180deg,transparent 0 30%,#d7c89f 31% 36%,#2b2b2d 37% 73%,#17191e 74%),linear-gradient(90deg,#111625,#161d2d)}
    .home-card[data-room="one-more-log"],.thumb[data-room="one-more-log"]{background-image:radial-gradient(ellipse at 33% 72%,#ffd17a 0 6%,#d96031 7% 12%,transparent 18%),repeating-linear-gradient(0deg,#241611 0 32px,#39231a 33px 38px)}
    .home-card[data-room="friends"],.thumb[data-room="friends"]{background-image:radial-gradient(circle at 20% 22%,#f1c87a 0 2%,transparent 3%),radial-gradient(circle at 40% 18%,#f1c87a 0 2%,transparent 3%),radial-gradient(circle at 62% 23%,#f1c87a 0 2%,transparent 3%),radial-gradient(circle at 82% 17%,#f1c87a 0 2%,transparent 3%),linear-gradient(180deg,#314043 0 63%,#3b2b21 64%)}
    .home-card[data-room="backroom"],.thumb[data-room="backroom"]{background-image:linear-gradient(74deg,#641e28 0 24%,transparent 25% 75%,#641e28 76%),radial-gradient(ellipse at 50% 55%,rgba(235,180,102,.4) 0 12%,transparent 30%),linear-gradient(#241b1b,#0f0b0c)}
    .home-card[data-room="headspace"],.thumb[data-room="headspace"]{background-image:linear-gradient(90deg,transparent 0 54%,#8ca1a1 55% 87%,transparent 88%),linear-gradient(180deg,#c3beb0 0 64%,#665748 65%)}
    .home-card[data-room="last-bus"],.thumb[data-room="last-bus"]{background-image:linear-gradient(90deg,transparent 0 8%,#18222b 9% 29%,transparent 30% 35%,#18222b 36% 60%,transparent 61% 66%,#18222b 67% 90%,transparent 91%),linear-gradient(180deg,#46515b 0 62%,#1b2228 63%)}
    .home-card[data-room="momentum"],.thumb[data-room="momentum"]{background-image:linear-gradient(90deg,transparent 0 59%,#acc7ca 60% 90%,transparent 91%),linear-gradient(180deg,#c9d4cd 0 64%,#b28e69 65%)}
    .home-card[data-room="between"],.thumb[data-room="between"]{background-image:radial-gradient(ellipse at 50% 68%,#5e6668 0 13%,transparent 14%),linear-gradient(90deg,transparent 0 14%,#d4cec2 15% 39%,transparent 40% 62%,#c5bfb6 63% 86%,transparent 87%),linear-gradient(180deg,#aaa8aa,#72797a)}
    @media(max-width:800px){
      .top{padding:16px max(17px,env(safe-area-inset-right)) 16px max(17px,env(safe-area-inset-left));gap:10px}
      .top .brand{flex:1;min-width:0;text-align:left;white-space:nowrap}
      .top .actions{gap:3px;flex:0 0 auto}
      .top .actions #accountBtn{display:inline-flex!important;align-items:center;justify-content:center;min-height:44px;padding:0 8px;font-size:8px;letter-spacing:.12em;opacity:.88}
      .home .top .actions #homeAccount{display:inline-flex!important;align-items:center;justify-content:center;min-height:44px;padding:0 7px;font-size:8px;letter-spacing:.12em;opacity:.88}
      .top .actions .round{width:44px;height:44px;flex:0 0 44px}
      .painted-scene svg{transform:none!important;width:100%;height:100%}
      .account{width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:auto;padding:25px 20px 22px;border-radius:14px}
      .account h2{font-size:clamp(36px,11vw,52px)}
      .google-auth{min-height:50px!important}
    }
    @media(max-width:430px){
      .top .brand{font-size:9px;letter-spacing:.16em}
      .top .actions #accountBtn,.home .top .actions #homeAccount{font-size:7.5px;padding:0 5px}
      .copy{left:20px;right:20px}
    }
  `;
  document.head.appendChild(style);

  function fixSceneFraming(){
    const host=document.getElementById('paintedScene');
    const svg=host?.querySelector('svg');
    if(svg&&svg.getAttribute('preserveAspectRatio')!=='xMidYMid slice')svg.setAttribute('preserveAspectRatio','xMidYMid slice');
  }
  function decorateDiscovery(){
    const cards=[...document.querySelectorAll('#homeGrid .home-card')];
    const thumbs=[...document.querySelectorAll('#grid .thumb')];
    if(typeof R!=='undefined'){
      cards.forEach((el,n)=>{if(R[n])el.dataset.room=R[n].slug});
      thumbs.forEach((el,n)=>{if(R[n])el.dataset.room=R[n].slug});
    }
  }
  function installHomeAccount(){
    const actions=document.querySelector('#home .top .actions');
    if(!actions||document.getElementById('homeAccount'))return;
    const button=document.createElement('button');button.id='homeAccount';button.className='textbtn';button.type='button';button.textContent='Sign in';
    button.addEventListener('click',()=>document.getElementById('account')?.showModal());
    actions.insertBefore(button,actions.firstChild);
  }

  fixSceneFraming();decorateDiscovery();installHomeAccount();
  const host=document.getElementById('paintedScene');
  if(host)new MutationObserver(fixSceneFraming).observe(host,{childList:true,subtree:false});
  const homeGrid=document.getElementById('homeGrid'),grid=document.getElementById('grid');
  if(homeGrid)new MutationObserver(decorateDiscovery).observe(homeGrid,{childList:true});
  if(grid)new MutationObserver(decorateDiscovery).observe(grid,{childList:true});
  window.addEventListener('popstate',fixSceneFraming);
})();

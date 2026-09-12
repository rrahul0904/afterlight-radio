(()=>{
  const supportUrl='/support/?topic='+encodeURIComponent('Subscription cancellation');
  const button=document.getElementById('manageBilling');
  const note=document.getElementById('billingNote');
  const googleMark=`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.27c0-.71-.06-1.24-.2-1.79H12v3.26h5.37a4.58 4.58 0 0 1-1.99 3.01l-.02.11 2.89 2.24.2.02c1.82-1.68 2.9-4.15 2.9-6.85Z"/><path fill="#34A853" d="M12 21.8c2.61 0 4.8-.86 6.4-2.34l-3.05-2.37c-.82.55-1.92.94-3.35.94a5.82 5.82 0 0 1-5.51-4.02l-.1.01-3 2.32-.04.1A9.67 9.67 0 0 0 12 21.8Z"/><path fill="#FBBC05" d="M6.49 14.01A5.96 5.96 0 0 1 6.17 12c0-.7.12-1.38.3-2.01l-.01-.13-3.04-2.36-.1.05A9.78 9.78 0 0 0 2.33 12c0 1.6.38 3.12 1.03 4.45l3.13-2.44Z"/><path fill="#EA4335" d="M12 5.97c1.82 0 3.05.78 3.75 1.43l2.71-2.65C16.8 3.2 14.61 2.2 12 2.2a9.67 9.67 0 0 0-8.68 5.35l3.14 2.44A5.84 5.84 0 0 1 12 5.97Z"/></svg>`;

  async function googleAuth(){
    const status=document.getElementById('loginStatus');
    if(status)status.textContent='Opening Google…';
    try{
      const r=await fetch('/api/auth/sign-in/social',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({provider:'google',callbackURL:'/account/'})});
      const data=await r.json().catch(()=>null);
      if(!r.ok)throw new Error(data?.message||data?.error||'Google sign-in could not start');
      if(!data?.url)throw new Error('Google sign-in did not return a redirect');
      location.assign(data.url);
    }catch(err){if(status)status.textContent=err.message}
  }
  function installGoogle(){
    const form=document.getElementById('loginForm');if(!form||document.getElementById('googleAuthAccount'))return;
    const style=document.createElement('style');style.textContent=`.google-auth{width:100%;min-height:46px;border:1px solid rgba(32,28,23,.24);background:#fff;color:#1f1f1f;display:flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;font-weight:600;margin-bottom:12px}.google-auth svg{width:19px;height:19px}.auth-separator{display:flex;align-items:center;gap:10px;color:#675e53;font-size:10px;text-transform:uppercase;letter-spacing:.12em;margin:2px 0 12px}.auth-separator:before,.auth-separator:after{content:"";height:1px;background:rgba(32,28,23,.16);flex:1}.auth-separator span{white-space:nowrap}`;document.head.appendChild(style);
    const google=document.createElement('button');google.id='googleAuthAccount';google.type='button';google.className='google-auth';google.innerHTML=`${googleMark}<span>Continue with Google</span>`;google.onclick=googleAuth;
    const sep=document.createElement('div');sep.className='auth-separator';sep.innerHTML='<span>or use email</span>';
    form.prepend(sep);form.prepend(google);
  }

  if(button){
    const originalRender=render;
    render=function(){originalRender();const hasBilling=!!me?.subscription?.stripe_customer_id;if(hasBilling&&!config?.portalEnabled){button.disabled=false;button.textContent='Billing support';if(note)note.textContent='Stripe self-service is being activated. Billing and cancellation support is available now.'}else if(config?.portalEnabled){button.textContent='Manage billing'}};
    const originalBilling=billing;
    billing=async function(){if(!me?.subscription?.stripe_customer_id)return;if(!config?.portalEnabled){location.assign(supportUrl);return}return originalBilling()};
    button.onclick=billing;render();
  }
  installGoogle();
})();

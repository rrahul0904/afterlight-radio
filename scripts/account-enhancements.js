(()=>{
  const supportUrl='/support/?topic='+encodeURIComponent('Subscription cancellation');
  const button=document.getElementById('manageBilling');
  const note=document.getElementById('billingNote');
  if(!button)return;

  const originalRender=render;
  render=function(){
    originalRender();
    const hasBilling=!!me?.subscription?.stripe_customer_id;
    if(hasBilling&&!config?.portalEnabled){
      button.disabled=false;
      button.textContent='Billing support';
      if(note)note.textContent='Stripe self-service is being activated. Billing and cancellation support is available now.';
    }else if(config?.portalEnabled){
      button.textContent='Manage billing';
    }
  };

  const originalBilling=billing;
  billing=async function(){
    if(!me?.subscription?.stripe_customer_id)return;
    if(!config?.portalEnabled){
      location.assign(supportUrl);
      return;
    }
    return originalBilling();
  };
  button.onclick=billing;
  render();
})();

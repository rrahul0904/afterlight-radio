(()=>{
  if(typeof audio==='undefined')return;

  // A room has three distinct arrangements. Let each one finish, then move
  // forward automatically instead of repeating the same short file forever.
  audio.loop=false;
  audio.onended=()=>{
    t=(t+1)%3;
    render(false);
    audio.play().then(()=>{
      playing=true;
      syncPlay();
      if(typeof trackEvent==='function')trackEvent('play',{room:R[i].slug,track:t,continuous:true});
    }).catch(()=>{
      playing=false;
      syncPlay();
      if(typeof toast==='function')toast('Tap play to continue');
    });
  };
})();

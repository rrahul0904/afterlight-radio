window.AFTERLIGHT_REBUILD_CATALOG={
  version:2,
  rooms:{
    rooftop:{label:'ROOFTOP · 7:42 PM',title:'Nobody wants to go in.',copy:'The city is still warm. Nobody has said goodbye yet.',mix:'sunset soul',tracks:[
      {id:'rooftop-1',title:'Orange on the parapet',provider:'owned',source:'/audio/rooftop/1.wav'},
      {id:'rooftop-2',title:'Windows turning gold',provider:'owned',source:'/audio/rooftop/2.wav'},
      {id:'rooftop-3',title:'Last glass before dark',provider:'owned',source:'/audio/rooftop/3.wav'}]},
    window:{label:'WINDOW SEAT · RAIN',title:'Stay until your stop.',copy:'Streetlights smear across the glass and the bus keeps moving.',mix:'rainy jazz',tracks:[
      {id:'window-1',title:'Streetlights in water',provider:'owned',source:'/audio/window/1.wav'},
      {id:'window-2',title:'Quiet between the buses',provider:'owned',source:'/audio/window/2.wav'},
      {id:'window-3',title:'Blue room, warm cup',provider:'owned',source:'/audio/window/3.wav'}]},
    headspace:{label:'HEADSPACE · QUIET HOURS',title:'A little room in your head.',copy:'Nothing needs your attention except the next line.',mix:'focus piano',tracks:[
      {id:'headspace-1',title:'Margin notes',provider:'owned',source:'/audio/headspace/1.wav'},
      {id:'headspace-2',title:'The second cup',provider:'owned',source:'/audio/headspace/2.wav'},
      {id:'headspace-3',title:'Window open four inches',provider:'owned',source:'/audio/headspace/3.wav'}]},
    'last-bus':{label:'LAST BUS · 12:18 AM',title:'Home through the glass.',copy:'Almost nobody is talking. The city has finally lowered its voice.',mix:'night ambient',tracks:[
      {id:'last-bus-1',title:'Doors closing',provider:'owned',source:'/audio/last-bus/1.wav'},
      {id:'last-bus-2',title:'Nobody at the platform',provider:'owned',source:'/audio/last-bus/2.wav'},
      {id:'last-bus-3',title:'Home through glass',provider:'owned',source:'/audio/last-bus/3.wav'}]}
  },
  providerContract:{
    owned:{kind:'html-audio',rights:'first-party-or-cleared'},
    youtube:{
      kind:'official-iframe-visible',
      rights:'embed-availability-required',
      status:'adapter-contract-only-no-catalog-ids-committed',
      minViewport:{width:200,height:200},
      requireVisiblePlayback:true,
      allowObscuringOverlay:false,
      allowAudioExtraction:false,
      allowBackgroundPlay:false,
      preserveYouTubeMetadataAndStandardExperience:true
    }
  }
};

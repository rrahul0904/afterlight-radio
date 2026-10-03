const catalog=window.AFTERLIGHT_REBUILD_CATALOG;
if(!catalog?.rooms)throw new Error('Afterlight rebuild catalog is missing');
const rooms=catalog.rooms;

const app=document.querySelector('#app');
const audio=document.querySelector('#audio');
const title=document.querySelector('#room-title');
const kicker=document.querySelector('#room-kicker');
const copy=document.querySelector('#room-copy');
const trackTitle=document.querySelector('#track-title');
const trackSubtitle=document.querySelector('#track-subtitle');
const playButton=document.querySelector('#play');
const primaryPlay=document.querySelector('#primary-play');
const vinyl=document.querySelector('#vinyl');
const ambienceButton=document.querySelector('#ambience');
let room='rooftop',track=0,view=0;
let ambience=null;
let activeProvider='owned';

function roomInfo(){return rooms[room]}
function trackInfo(){return roomInfo().tracks[track]}
function syncUrl(){const url=new URL(location.href);url.searchParams.set('room',room);url.searchParams.set('track',String(track+1));url.searchParams.set('view',String(view));history.replaceState(null,'',url)}
function setProviderSource(nextTrack){
  activeProvider=nextTrack.provider;
  if(nextTrack.provider==='owned'){
    audio.src=nextTrack.source;
    audio.load();
    return;
  }
  audio.removeAttribute('src');
  audio.load();
  throw new Error(`Provider ${nextTrack.provider} is not enabled in this clean-room preview`);
}
function render({preserveAudio=false}={}){
  const info=roomInfo(),selected=trackInfo();
  app.dataset.room=room;
  app.dataset.view=String(view);
  kicker.textContent=info.label;
  title.textContent=info.title;
  copy.textContent=info.copy;
  trackTitle.textContent=selected.title;
  trackSubtitle.textContent=`${info.title.replace(/[.]$/,'')} · ${selected.provider==='owned'?'temporary cleared/owned demo source':selected.provider}`;
  document.querySelectorAll('[data-room-choice]').forEach(button=>button.classList.toggle('active',button.dataset.roomChoice===room));
  if(!preserveAudio)setProviderSource(selected);
  syncUrl();
}
async function play(){
  if(activeProvider!=='owned')return;
  if(!audio.src)setProviderSource(trackInfo());
  try{await audio.play()}catch{}
}
function pause(){if(activeProvider==='owned')audio.pause()}
function updatePlayState(){const playing=activeProvider==='owned'&&!audio.paused;playButton.textContent=playing?'Ⅱ':'▶';playButton.setAttribute('aria-label',playing?'Pause':'Play');primaryPlay.textContent=playing?'Pause this place':'Play this place';vinyl.classList.toggle('spinning',playing)}
function changeTrack(delta){const wasPlaying=activeProvider==='owned'&&!audio.paused;track=(track+delta+roomInfo().tracks.length)%roomInfo().tracks.length;render();if(wasPlaying)void play()}
function changeRoom(next){if(!rooms[next]||next===room)return;const wasPlaying=activeProvider==='owned'&&!audio.paused;room=next;track=0;view=0;render();if(wasPlaying)void play()}
function anotherView(){view=(view+1)%3;render({preserveAudio:true})}

function toggleAmbience(){
  if(ambience){ambience.source.stop();ambience.context.close();ambience=null;ambienceButton.textContent='Ambience off';ambienceButton.setAttribute('aria-pressed','false');return}
  const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
  const context=new AudioContext();const length=context.sampleRate*2;const buffer=context.createBuffer(1,length,context.sampleRate);const data=buffer.getChannelData(0);let brown=0;
  for(let i=0;i<length;i++){const white=Math.random()*2-1;brown=(brown+.02*white)/1.02;data[i]=brown*2.8}
  const source=context.createBufferSource();source.buffer=buffer;source.loop=true;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=room==='window'?900:room==='last-bus'?540:700;const gain=context.createGain();gain.gain.value=.045;source.connect(filter).connect(gain).connect(context.destination);source.start();ambience={context,source};ambienceButton.textContent='Ambience on';ambienceButton.setAttribute('aria-pressed','true')
}

async function shareMoment(){
  const url=new URL(location.href);url.searchParams.set('room',room);url.searchParams.set('track',String(track+1));url.searchParams.set('view',String(view));const text=`Afterlight — ${roomInfo().title} · ${trackInfo().title}`;
  if(navigator.share){await navigator.share({title:'Afterlight',text,url:url.toString()}).catch(()=>undefined);return}
  await navigator.clipboard?.writeText(url.toString());
}

document.querySelectorAll('[data-room-choice]').forEach(button=>button.addEventListener('click',()=>changeRoom(button.dataset.roomChoice)));
document.querySelector('#another-view').addEventListener('click',anotherView);
document.querySelector('#next').addEventListener('click',()=>changeTrack(1));
document.querySelector('#prev').addEventListener('click',()=>changeTrack(-1));
document.querySelector('#share').addEventListener('click',()=>void shareMoment());
ambienceButton.addEventListener('click',toggleAmbience);
playButton.addEventListener('click',()=>audio.paused?void play():pause());
primaryPlay.addEventListener('click',()=>audio.paused?void play():pause());
audio.addEventListener('play',updatePlayState);audio.addEventListener('pause',updatePlayState);audio.addEventListener('ended',()=>changeTrack(1));
window.addEventListener('keydown',event=>{if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;if(event.code==='Space'){event.preventDefault();audio.paused?void play():pause()}if(event.key==='ArrowRight')changeTrack(1);if(event.key==='ArrowLeft')changeTrack(-1);if(event.key.toLowerCase()==='v')anotherView()});

const params=new URLSearchParams(location.search);if(rooms[params.get('room')])room=params.get('room');const requestedTrack=Number(params.get('track'));if(Number.isInteger(requestedTrack)&&requestedTrack>=1&&requestedTrack<=roomInfo().tracks.length)track=requestedTrack-1;const requestedView=Number(params.get('view'));if(Number.isInteger(requestedView)&&requestedView>=0&&requestedView<=2)view=requestedView;render();updatePlayState();

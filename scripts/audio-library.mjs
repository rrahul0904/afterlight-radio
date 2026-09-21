import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/*
 * Afterlight composition engine v3.
 *
 * Clean-room design: authored room profiles and motif families are combined by a
 * deterministic arrangement engine. No third-party stems, recordings, melodies,
 * model weights, or proprietary implementation code are used.
 */

const rooms=[
  {slug:'roma',name:'Pizzeria Roma',bpm:72,root:53,mode:'minor7',style:'vinyl soul',warm:.94,keys:.76,pluck:.46,drums:.34,air:.15,swing:.08,motion:.50,melody:.35,brightness:.55,tracks:['The red booth','Closing time oregano','Receipt under the saucer']},
  {slug:'window',name:'The window seat',bpm:64,root:55,mode:'major7',style:'rainy jazz',warm:.84,keys:.94,pluck:.24,drums:.12,air:.34,swing:.05,motion:.28,melody:.28,brightness:.58,tracks:['Streetlights in water','Quiet between the buses','Blue room, warm cup']},
  {slug:'long-way-home',name:'The long way home',bpm:78,root:50,mode:'dorian',style:'mellow indie',warm:.68,keys:.44,pluck:.64,drums:.48,air:.20,swing:.04,motion:.72,melody:.48,brightness:.48,tracks:['Exit nineteen','Windows down','The road after sunset']},
  {slug:'two-hundred',name:'Two hundred to go',bpm:68,root:48,mode:'minor7',style:'neon downtempo',warm:.58,keys:.58,pluck:.44,drums:.28,air:.38,swing:.02,motion:.35,melody:.22,brightness:.38,tracks:['Pump number four','Receipt in the wind','Coffee under neon']},
  {slug:'one-more-log',name:'Just one more log',bpm:58,root:48,mode:'major7',style:'fireside acoustic',warm:.98,keys:.62,pluck:.74,drums:.08,air:.24,swing:.06,motion:.30,melody:.32,brightness:.42,tracks:['Cedar and wool','Snow against the door','Embers talking']},
  {slug:'rooftop',name:'Nobody wants to go in',bpm:74,root:57,mode:'major7',style:'sunset soul',warm:.90,keys:.74,pluck:.52,drums:.40,air:.16,swing:.09,motion:.58,melody:.46,brightness:.68,tracks:['Orange on the parapet','Windows turning gold','Last glass before dark']},
  {slug:'friends',name:'A few good friends',bpm:76,root:55,mode:'dorian',style:'courtyard soul',warm:.92,keys:.70,pluck:.46,drums:.44,air:.14,swing:.11,motion:.62,melody:.44,brightness:.62,tracks:['The long story','Glass on stone','Stay for another']},
  {slug:'backroom',name:'The backroom stage',bpm:88,root:52,mode:'minor7',style:'small-room indie',warm:.66,keys:.36,pluck:.86,drums:.72,air:.10,swing:.08,motion:.88,melody:.55,brightness:.52,tracks:['Before the encore','Red curtain hum','Mic left on']},
  {slug:'headspace',name:'A little headspace',bpm:60,root:55,mode:'major7',style:'focus piano',warm:.80,keys:.99,pluck:.18,drums:.03,air:.24,swing:0,motion:.18,melody:.20,brightness:.66,tracks:['Margin notes','The second cup','Window open four inches']},
  {slug:'last-bus',name:'The last bus',bpm:62,root:48,mode:'minor7',style:'night ambient',warm:.58,keys:.78,pluck:.20,drums:.08,air:.40,swing:0,motion:.22,melody:.24,brightness:.34,tracks:['Doors closing','Nobody at the platform','Home through glass']},
  {slug:'momentum',name:'A little momentum',bpm:82,root:57,mode:'major7',style:'morning jazz beat',warm:.82,keys:.82,pluck:.56,drums:.56,air:.10,swing:.07,motion:.82,melody:.50,brightness:.72,tracks:['Toast and sunlight','Before everyone wakes','Half a grapefruit']},
  {slug:'between',name:'Somewhere in between',bpm:56,root:50,mode:'dorian',style:'drifting piano',warm:.54,keys:.98,pluck:.14,drums:.02,air:.46,swing:0,motion:.14,melody:.18,brightness:.40,tracks:['Room without an address','Almost remembered','Signal through fog']}
];

const SR=32000;
const BARS=12;
const modes={
  major7:[0,2,4,7,9,11,14],
  minor7:[0,2,3,5,7,10,12],
  dorian:[0,2,3,5,7,9,10]
};
const modeNames={major7:'major',minor7:'minor',dorian:'dorian'};
const noteNames=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const chordTransitions={
  0:[[0,.12],[3,.24],[4,.34],[5,.30]],
  3:[[0,.28],[4,.31],[5,.27],[3,.14]],
  4:[[0,.40],[3,.19],[5,.27],[4,.14]],
  5:[[0,.39],[3,.31],[4,.20],[5,.10]]
};
const motifs=[
  [0,2,4,2,5,4,2,1],
  [0,4,2,6,5,2,4,1],
  [0,2,3,5,4,2,1,2],
  [0,5,4,2,3,1,2,0],
  [0,2,5,4,2,6,4,1]
];
const TAU=Math.PI*2,SIN_SIZE=8192,SIN=new Float32Array(SIN_SIZE);
for(let i=0;i<SIN_SIZE;i++)SIN[i]=Math.sin(TAU*i/SIN_SIZE);

function midi(n){return 440*Math.pow(2,(n-69)/12)}
function hash(s){let h=2166136261>>>0;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let x=seed||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%1000000)/1000000}}
function fract(x){return x-Math.floor(x)}
function tri(p){return 1-4*Math.abs(fract(p)-.5)}
function sinP(p){const x=fract(p)*SIN_SIZE,i=x|0,j=(i+1)&(SIN_SIZE-1),f=x-i;return SIN[i]+(SIN[j]-SIN[i])*f}
function softSaw(p){return sinP(p)+.31*sinP(p*2)+.13*sinP(p*3)+.055*sinP(p*4)}
function clamp(x,a=-1,b=1){return Math.max(a,Math.min(b,x))}
function envAD(local,attack,decay){if(local<0)return 0;if(local<attack)return local/attack;return Math.exp(-(local-attack)/decay)}
function noteFromDegree(room,degree,octave=0){const scale=modes[room.mode],d=((degree%7)+7)%7,oct=Math.floor(degree/7)+octave;return midi(room.root+scale[d]+12*oct)}
function noteLabel(room){return noteNames[((room.root%12)+12)%12]+' '+modeNames[room.mode]}
function weighted(options,rand){let p=rand(),sum=0;for(const [value,w] of options){sum+=w;if(p<=sum)return value}return options.at(-1)[0]}
function pan(sample,pos){const angle=(clamp(pos)+1)*Math.PI/4;return [sample*Math.cos(angle),sample*Math.sin(angle)]}
function addStereo(acc,sample,pos){const [l,r]=pan(sample,pos);acc[0]+=l;acc[1]+=r}
function arrangementName(track){return track===1?'arrival arc':track===2?'motion arc':'late-night arc'}

function sectionFor(track,bar){
  const plans={
    1:[
      {name:'intro',until:2,pad:.65,keys:.32,pluck:.12,bass:.38,drums:.06,lead:.00,air:1.05},
      {name:'settle',until:5,pad:.88,keys:.70,pluck:.34,bass:.72,drums:.45,lead:.18,air:.92},
      {name:'bloom',until:9,pad:1.00,keys:.90,pluck:.60,bass:.90,drums:.78,lead:.46,air:.82},
      {name:'release',until:12,pad:.82,keys:.58,pluck:.22,bass:.62,drums:.24,lead:.18,air:1.05}
    ],
    2:[
      {name:'intro',until:2,pad:.78,keys:.50,pluck:.32,bass:.58,drums:.18,lead:.12,air:.88},
      {name:'lift',until:6,pad:.95,keys:.78,pluck:.72,bass:.90,drums:.78,lead:.40,air:.72},
      {name:'drive',until:10,pad:1.00,keys:.68,pluck:.88,bass:1.00,drums:1.00,lead:.56,air:.68},
      {name:'release',until:12,pad:.80,keys:.44,pluck:.40,bass:.66,drums:.36,lead:.20,air:.95}
    ],
    3:[
      {name:'intro',until:3,pad:.90,keys:.62,pluck:.12,bass:.40,drums:.04,lead:.14,air:1.12},
      {name:'drift',until:7,pad:1.00,keys:.82,pluck:.28,bass:.58,drums:.20,lead:.34,air:1.00},
      {name:'resolve',until:10,pad:.92,keys:.70,pluck:.22,bass:.54,drums:.12,lead:.26,air:1.08},
      {name:'outro',until:12,pad:.72,keys:.42,pluck:.06,bass:.28,drums:.00,lead:.08,air:1.18}
    ]
  };
  return plans[track].find(section=>bar<section.until)||plans[track].at(-1);
}

function transformMotif(base,variant){
  let out=[...base];
  if(variant&1)out=out.map((v,i)=>i%2?v+1:v);
  if(variant&2)out=out.map(v=>Math.max(0,6-v));
  if(variant&4)out=[...out.slice(2),...out.slice(0,2)];
  if(variant&8)out=out.map((v,i)=>i===3||i===7?v+7:v);
  return out;
}

function buildScore(room,track){
  const rand=rng(hash(room.slug+':score:v3:'+track)),bars=[];
  let degree=0;
  const motif=motifs[(hash(room.slug)+track)%motifs.length];
  for(let bar=0;bar<BARS;bar++){
    if(bar>0)degree=weighted(chordTransitions[degree]||chordTransitions[0],rand);
    if(bar===BARS-1)degree=0;
    const section=sectionFor(track,bar),variant=(bar+track+(hash(room.slug)%7))&15,seq=transformMotif(motif,variant);
    const eighths=Array.from({length:8},(_,step)=>({
      degree:degree+seq[step],
      velocity:.72+rand()*.28,
      delay:(step%2?room.swing:0)*(.45+rand()*.5),
      octave:(track===2&&bar>5&&step===6)?1:0
    }));
    const lead=Array.from({length:4},(_,beat)=>{
      const active=rand()<room.melody*section.lead*(track===3?1.25:1),choices=[0,2,4,5,6,8,9],pick=choices[Math.floor(rand()*choices.length)];
      return {active,degree:degree+pick,velocity:.55+rand()*.35,offset:(rand()-.5)*.035,beat};
    });
    bars.push({degree,section,eighths,lead,human:(rand()-.5)*.012});
  }
  return bars;
}

function synth(room,track){
  const beat=60/room.bpm,barDur=beat*4,duration=barDur*BARS,N=Math.floor(SR*duration);
  const dryL=new Float32Array(N),dryR=new Float32Array(N),score=buildScore(room,track),rand=rng(hash(room.slug+':audio:v3:'+track));
  let airLP=0,airSlow=0,crackle=0;

  for(let n=0;n<N;n++){
    const x=n/SR,bar=Math.min(BARS-1,Math.floor(x/barDur)),barLocal=x-bar*barDur;
    const beatFloat=barLocal/beat,beatIndex=Math.floor(beatFloat),beatPhase=beatFloat-beatIndex;
    const spec=score[bar],section=spec.section,degree=spec.degree,acc=[0,0];
    const wow=.0017*sinP(.13*x)+.0010*sinP(.071*x+1.7/TAU)+.0005*sinP(.31*x+.3/TAU);

    // Harmonic bed: room-specific warmth, moving voicing, and mild sidechain breathing.
    const chordSteps=track===2?[0,2,4,6]:track===3?[0,2,5,6]:[0,2,4,5];
    const padBreath=.80+.20*sinP(x/(barDur*2.2)+track*.8/TAU),sideDuck=1-.16*section.drums*Math.exp(-beatPhase*7);
    for(let k=0;k<chordSteps.length;k++){
      const octave=k===3?-1:0,f=noteFromDegree(room,degree+chordSteps[k],octave)*(k===1?1.0022:k===2?.9981:1);
      const phase=f*x*(1+wow),tone=softSaw(phase)*(.29/(1+k*.10))+sinP(phase*.5)*.18;
      addStereo(acc,tone*(.032+.052*room.warm)*section.pad*padBreath*sideDuck,[-.46,-.16,.18,.48][k]);
    }

    // Electric-key motif with deterministic transformation and bounded humanization.
    const eighth=beat/2,step=Math.min(7,Math.floor(barLocal/eighth)),event=spec.eighths[step];
    const eventStart=step*eighth+event.delay*eighth+spec.human,keyLocal=barLocal-eventStart;
    if(keyLocal>=0&&keyLocal<eighth*.96){
      const f=noteFromDegree(room,event.degree,event.octave),e=envAD(keyLocal,.008,.19+.24*room.keys);
      const bell=sinP(f*x)+.34*sinP(f*2.005*x)+.10*sinP(f*3.99*x);
      addStereo(acc,bell*e*event.velocity*(.021+.055*room.keys)*section.keys,(step%2?-.24:.24)+(track-2)*.05);
    }

    // Muted pluck ostinato: activity follows room motion and track role.
    const sixteenth=beat/4,ss=Math.floor(barLocal/sixteenth),sl=barLocal-ss*sixteenth;
    const pluckGate=(ss%4===0)||(room.motion>.65&&ss%4===2)||(track===2&&ss%8===6);
    if(pluckGate){
      const offsets=[0,4,2,5,3,4,1,5],deg=degree+offsets[(Math.floor(ss/2)+bar+track)%offsets.length],f=noteFromDegree(room,deg,0);
      const e=envAD(sl,.0025,.075+.13*room.pluck),sample=(tri(f*x)+.18*sinP(f*2*x))*e*(.014+.044*room.pluck)*section.pluck;
      addStereo(acc,sample,ss%8<4?-.34:.34);
    }

    // Bass alternates root/fifth, then approaches the next harmony before a transition.
    const bassStep=beat*2,bs=Math.floor(barLocal/bassStep),bl=barLocal-bs*bassStep;
    let bassDegree=degree-7+(bs%2?4:0);
    if(barLocal>barDur-beat*.35&&bar<BARS-1)bassDegree=score[bar+1].degree-8;
    const bassF=noteFromDegree(room,bassDegree,0),bassEnv=envAD(bl,.006,.34+.18*room.warm);
    addStereo(acc,(sinP(bassF*x)+.13*sinP(bassF*2*x))*bassEnv*(.039+.024*room.warm)*section.bass,0);

    // Sparse upper voice: enough movement to feel composed, not enough to steal attention.
    const leadEvent=spec.lead[Math.min(3,beatIndex)],leadLocal=barLocal-beatIndex*beat-leadEvent.offset;
    if(leadEvent.active&&leadLocal>=0&&leadLocal<beat*.86){
      const f=noteFromDegree(room,leadEvent.degree,1),e=envAD(leadLocal,.018,.33+.20*(1-room.motion));
      addStereo(acc,(sinP(f*x)+.18*sinP(f*2*x))*e*leadEvent.velocity*(.020+.030*room.melody)*section.lead,beatIndex%2?-.28:.28);
    }

    // Restrained rhythm section with arrangement-dependent intensity.
    const beatLocal=barLocal-beatIndex*beat;
    if((beatIndex===0||beatIndex===2)&&beatLocal<.18){
      const sweep=45+78*Math.exp(-beatLocal*25),kick=sinP(sweep*x)*Math.exp(-beatLocal*23)*(.035+.078*room.drums)*section.drums;
      addStereo(acc,kick,0);
    }
    if((beatIndex===1||beatIndex===3)&&beatLocal<.14)addStereo(acc,(rand()*2-1)*Math.exp(-beatLocal*28)*(.014+.043*room.drums)*section.drums,.12);
    const hatPhase=barLocal%(beat/2);
    if(hatPhase<.045&&section.drums>.08){
      const raw=rand()*2-1;airLP=airLP*.58+raw*.42;
      addStereo(acc,(raw-airLP)*Math.exp(-hatPhase*78)*(.008+.026*room.drums)*section.drums,Math.floor(barLocal/(beat/2))%2?-.55:.55);
    }

    // Environmental/tape bed uses filtered noise, never imported recordings.
    const noise=rand()*2-1;airLP=airLP*.989+noise*.011;airSlow=airSlow*.99955+noise*.00045;
    addStereo(acc,(airLP*.64+airSlow*1.8)*(.025+.078*room.air)*section.air,-.12+sinP(x*.07/TAU)*.18);
    if(rand()<.000035*(1+room.air*2.8))crackle=.025+rand()*.055;
    crackle*=.991;addStereo(acc,(rand()*2-1)*crackle,.42*sinP(x*.61/TAU));

    const fadeIn=Math.min(1,x/1.6),fadeOut=Math.min(1,(duration-x)/2.4),shape=Math.max(0,Math.min(fadeIn,fadeOut));
    dryL[n]=acc[0]*shape;dryR[n]=acc[1]*shape;
  }

  // Stereo multi-tap ambience with cross-feed keeps the renderer deterministic.
  const taps=[
    [Math.floor(SR*.109),.145,false],
    [Math.floor(SR*.173),.105,true],
    [Math.floor(SR*.287),.078,false],
    [Math.floor(SR*.419),.052,true]
  ];
  const wetL=new Float32Array(N),wetR=new Float32Array(N);
  let peak=.001;
  for(let n=0;n<N;n++){
    let l=dryL[n],r=dryR[n];
    for(const [delay,gain,cross] of taps){
      if(n<delay)continue;
      l+=(cross?dryR[n-delay]:dryL[n-delay])*gain;
      r+=(cross?dryL[n-delay]:dryR[n-delay])*gain;
    }
    l=Math.tanh(l*(1.36+.05*room.warm));r=Math.tanh(r*(1.34+.04*room.warm));
    wetL[n]=l;wetR[n]=r;peak=Math.max(peak,Math.abs(l),Math.abs(r));
  }

  const gain=Math.min(2.00,.92/peak),dataBytes=N*4,buf=new ArrayBuffer(44+dataBytes),v=new DataView(buf);
  const enc=(o,text)=>{for(let j=0;j<text.length;j++)v.setUint8(o+j,text.charCodeAt(j))};
  enc(0,'RIFF');v.setUint32(4,36+dataBytes,true);enc(8,'WAVE');enc(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
  v.setUint32(24,SR,true);v.setUint32(28,SR*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);
  enc(36,'data');v.setUint32(40,dataBytes,true);
  for(let n=0;n<N;n++){
    v.setInt16(44+n*4,Math.round(clamp(Math.tanh(wetL[n]*gain*1.08))*32767),true);
    v.setInt16(46+n*4,Math.round(clamp(Math.tanh(wetR[n]*gain*1.08))*32767),true);
  }
  return {bytes:new Uint8Array(buf),duration};
}

export async function generateAudio(out){
  const manifest=[];
  for(const room of rooms){
    const dir=path.join(out,'audio',room.slug);await mkdir(dir,{recursive:true});
    for(let track=1;track<=3;track++){
      const rendered=synth(room,track);await writeFile(path.join(dir,track+'.wav'),rendered.bytes);
      manifest.push({
        id:room.slug+':'+track,
        room:room.slug,
        roomName:room.name,
        track,
        title:room.tracks[track-1],
        bpm:room.bpm,
        key:noteLabel(room),
        style:room.style,
        arrangement:arrangementName(track),
        durationSeconds:Number(rendered.duration.toFixed(2)),
        format:'pcm_s16le',
        sampleRate:SR,
        channels:2,
        bars:BARS,
        generator:'afterlight-composition-engine-v3',
        model:'authored-elements-plus-deterministic-arrangement'
      });
    }
  }
  await writeFile(path.join(out,'music-manifest.json'),JSON.stringify({
    version:3,
    generated:true,
    rights:'original procedural composition rendered by Afterlight',
    thirdPartyAudio:false,
    tracks:manifest
  },null,2)+'\n');
  return manifest.length;
}

export const audioRoomSlugs=rooms.map(room=>room.slug);
export const audioEngineContract=Object.freeze({
  version:3,
  sampleRate:SR,
  channels:2,
  bars:BARS,
  model:'authored-elements-plus-deterministic-arrangement',
  thirdPartyAudio:false
});

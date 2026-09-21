import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/*
 * Afterlight clean-room composition engine.
 *
 * Product research showed that strong generative-audio products do not rely on
 * one tiny loop. Their public descriptions point to authored musical elements
 * controlled by generative/adaptive logic. This implementation is independent:
 * deterministic room profiles, generated arrangements, motif transformations,
 * section dynamics and a small synthesis/mix engine. No third-party stems,
 * melodies, model weights or proprietary implementation code are used.
 */

const rooms=[
  {slug:'roma',bpm:72,root:53,mode:'minor7',warm:.92,keys:.78,pluck:.42,drums:.34,air:.14,swing:.08,motion:.50,melody:.35,brightness:.55},
  {slug:'window',bpm:64,root:55,mode:'major7',warm:.84,keys:.92,pluck:.28,drums:.12,air:.32,swing:.05,motion:.28,melody:.28,brightness:.58},
  {slug:'long-way-home',bpm:78,root:50,mode:'dorian',warm:.66,keys:.42,pluck:.58,drums:.48,air:.22,swing:.04,motion:.72,melody:.48,brightness:.48},
  {slug:'two-hundred',bpm:58,root:48,mode:'minor7',warm:.55,keys:.58,pluck:.48,drums:.25,air:.38,swing:.02,motion:.35,melody:.22,brightness:.38},
  {slug:'one-more-log',bpm:62,root:48,mode:'major7',warm:.96,keys:.65,pluck:.68,drums:.08,air:.24,swing:.06,motion:.30,melody:.32,brightness:.42},
  {slug:'rooftop',bpm:70,root:57,mode:'major7',warm:.88,keys:.72,pluck:.52,drums:.38,air:.18,swing:.09,motion:.58,melody:.46,brightness:.68},
  {slug:'friends',bpm:74,root:55,mode:'dorian',warm:.90,keys:.72,pluck:.48,drums:.42,air:.14,swing:.11,motion:.62,melody:.44,brightness:.62},
  {slug:'backroom',bpm:86,root:52,mode:'minor7',warm:.64,keys:.38,pluck:.82,drums:.70,air:.10,swing:.08,motion:.88,melody:.55,brightness:.52},
  {slug:'headspace',bpm:60,root:55,mode:'major7',warm:.78,keys:.98,pluck:.20,drums:.03,air:.25,swing:.00,motion:.18,melody:.20,brightness:.66},
  {slug:'last-bus',bpm:56,root:48,mode:'minor7',warm:.55,keys:.76,pluck:.25,drums:.08,air:.36,swing:.00,motion:.22,melody:.24,brightness:.34},
  {slug:'momentum',bpm:82,root:57,mode:'major7',warm:.80,keys:.80,pluck:.56,drums:.55,air:.10,swing:.07,motion:.82,melody:.50,brightness:.72},
  {slug:'between',bpm:56,root:50,mode:'dorian',warm:.52,keys:.96,pluck:.16,drums:.02,air:.44,swing:.00,motion:.14,melody:.18,brightness:.40}
];

const SR=32000;
const BARS=12;
const TAU=Math.PI*2;
const modes={
  major7:[0,2,4,7,9,11,14],
  minor7:[0,2,3,5,7,10,12],
  dorian:[0,2,3,5,7,9,10]
};
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

function midi(n){return 440*Math.pow(2,(n-69)/12)}
function fract(x){return x-Math.floor(x)}
function tri(p){return 1-4*Math.abs(fract(p)-.5)}
function softSaw(p){const a=TAU*p;return Math.sin(a)+.31*Math.sin(a*2)+.13*Math.sin(a*3)+.055*Math.sin(a*4)}
function softSquare(p){const a=TAU*p;return Math.sin(a)+Math.sin(a*3)/3+Math.sin(a*5)/5}
function hash(s){let h=2166136261>>>0;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let x=seed||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%1000000)/1000000}}
function clamp(v,a=-1,b=1){return Math.max(a,Math.min(b,v))}
function envAD(local,attack,decay){if(local<0)return 0;if(local<attack)return local/attack;return Math.exp(-(local-attack)/decay)}
function noteFromDegree(room,degree,octave=0){const scale=modes[room.mode],d=((degree%7)+7)%7,oct=Math.floor(degree/7)+octave;return midi(room.root+scale[d]+12*oct)}
function pan(sample,pos){const p=clamp(pos,-1,1),angle=(p+1)*Math.PI/4;return [sample*Math.cos(angle),sample*Math.sin(angle)]}
function addStereo(acc,sample,pos){const [l,r]=pan(sample,pos);acc[0]+=l;acc[1]+=r}
function weighted(options,rand){let p=rand(),sum=0;for(const [value,w] of options){sum+=w;if(p<=sum)return value}return options.at(-1)[0]}

function sectionFor(track,bar){
  // Three related arrangements per room: arrival, motion, and late-night resolve.
  const plans={
    1:[
      {until:2,pad:.65,keys:.32,pluck:.12,bass:.38,drums:.06,lead:.00,air:1.05},
      {until:5,pad:.88,keys:.70,pluck:.34,bass:.72,drums:.45,lead:.18,air:.92},
      {until:9,pad:1.00,keys:.90,pluck:.60,bass:.90,drums:.78,lead:.46,air:.82},
      {until:12,pad:.82,keys:.58,pluck:.22,bass:.62,drums:.24,lead:.18,air:1.05}
    ],
    2:[
      {until:2,pad:.78,keys:.50,pluck:.32,bass:.58,drums:.18,lead:.12,air:.88},
      {until:6,pad:.95,keys:.78,pluck:.72,bass:.90,drums:.78,lead:.40,air:.72},
      {until:10,pad:1.00,keys:.68,pluck:.88,bass:1.00,drums:1.00,lead:.56,air:.68},
      {until:12,pad:.80,keys:.44,pluck:.40,bass:.66,drums:.36,lead:.20,air:.95}
    ],
    3:[
      {until:3,pad:.90,keys:.62,pluck:.12,bass:.40,drums:.04,lead:.14,air:1.12},
      {until:7,pad:1.00,keys:.82,pluck:.28,bass:.58,drums:.20,lead:.34,air:1.00},
      {until:10,pad:.92,keys:.70,pluck:.22,bass:.54,drums:.12,lead:.26,air:1.08},
      {until:12,pad:.72,keys:.42,pluck:.06,bass:.28,drums:.00,lead:.08,air:1.18}
    ]
  };
  return plans[track].find(s=>bar<s.until)||plans[track].at(-1);
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
  const rand=rng(hash(room.slug+':score:'+track));
  const bars=[];
  let degree=0;
  const motif=motifs[(hash(room.slug)+track)%motifs.length];
  for(let bar=0;bar<BARS;bar++){
    if(bar>0)degree=weighted(chordTransitions[degree]||chordTransitions[0],rand);
    if(bar===BARS-1)degree=0;
    const section=sectionFor(track,bar);
    const variant=(bar+track+(hash(room.slug)%7))&15;
    const seq=transformMotif(motif,variant);
    const eighths=Array.from({length:8},(_,step)=>({
      degree:degree+seq[step],
      velocity:.72+rand()*.28,
      delay:(step%2?room.swing:0)*(.45+rand()*.5),
      octave:(track===2&&bar>5&&step===6)?1:0
    }));
    const lead=Array.from({length:4},(_,beat)=>{
      const active=rand()<room.melody*section.lead*(track===3?1.25:1);
      const choices=[0,2,4,5,6,8,9],pick=choices[Math.floor(rand()*choices.length)];
      return {active,degree:degree+pick,velocity:.55+rand()*.35,offset:(rand()-.5)*.035};
    });
    bars.push({degree,section,eighths,lead,human:(rand()-.5)*.012});
  }
  return bars;
}

function synth(room,track){
  const beat=60/room.bpm,barDur=beat*4,duration=barDur*BARS,N=Math.floor(SR*duration);
  const dryL=new Float32Array(N),dryR=new Float32Array(N);
  const score=buildScore(room,track),rand=rng(hash(room.slug+':audio:'+track));
  let airLP=0,airSlow=0,crackle=0;

  for(let n=0;n<N;n++){
    const x=n/SR,bar=Math.min(BARS-1,Math.floor(x/barDur)),barLocal=x-bar*barDur;
    const beatFloat=barLocal/beat,beatIndex=Math.floor(beatFloat),beatPhase=beatFloat-beatIndex;
    const spec=score[bar],section=spec.section;
    const acc=[0,0];
    const degree=spec.degree;
    const wow=.0017*Math.sin(TAU*.13*x)+.0010*Math.sin(TAU*.071*x+1.7)+.0005*Math.sin(TAU*.31*x+.3);

    // Evolving four-note pad: authored harmonic role, generative voicing and movement.
    const chordSteps=track===2?[0,2,4,6]:track===3?[0,2,5,6]:[0,2,4,5];
    const padBreath=.80+.20*Math.sin(TAU*x/(barDur*2.2)+track*.8);
    const sideDuck=1-.16*section.drums*Math.exp(-beatPhase*7);
    for(let k=0;k<chordSteps.length;k++){
      const octave=k===3?-1:0,f=noteFromDegree(room,degree+chordSteps[k],octave)*(k===1?1.0022:k===2?.9981:1);
      const phase=f*x*(1+wow),tone=softSaw(phase)*(.29/(1+k*.10))+Math.sin(TAU*phase*.5)*.18;
      const sample=tone*(.032+.052*room.warm)*section.pad*padBreath*sideDuck;
      addStereo(acc,sample,[-.46,-.16,.18,.48][k]);
    }

    // Electric-key motif. Deterministic motif transforms create recognizable continuity
    // without repeating the exact same bar.
    const eighth=beat/2,step=Math.min(7,Math.floor(barLocal/eighth)),event=spec.eighths[step];
    const eventStart=step*eighth+event.delay*eighth+spec.human;
    const keyLocal=barLocal-eventStart;
    if(keyLocal>=0&&keyLocal<eighth*.96){
      const f=noteFromDegree(room,event.degree,event.octave),e=envAD(keyLocal,.008,.19+.24*room.keys);
      const bell=Math.sin(TAU*f*x)+.34*Math.sin(TAU*f*2.005*x)+.10*Math.sin(TAU*f*3.99*x);
      const sample=bell*e*event.velocity*(.021+.055*room.keys)*section.keys;
      addStereo(acc,sample,(step%2?-0.24:.24)+(track-2)*.05);
    }

    // Muted pluck ostinato. More active rooms get denser syncopation.
    const sixteenth=beat/4,ss=Math.floor(barLocal/sixteenth),sl=barLocal-ss*sixteenth;
    const pluckGate=(ss%4===0)||(room.motion>.65&&ss%4===2)||(track===2&&ss%8===6);
    if(pluckGate){
      const offsets=[0,4,2,5,3,4,1,5],deg=degree+offsets[(ss/2+bar+track|0)%offsets.length],f=noteFromDegree(room,deg,0);
      const e=envAD(sl,.0025,.075+.13*room.pluck),sample=(tri(f*x)+.18*Math.sin(TAU*f*2*x))*e*(.014+.044*room.pluck)*section.pluck;
      addStereo(acc,sample,(ss%8<4?-.34:.34));
    }

    // Bass changes root/fifth and adds occasional approach tones before new bars.
    const bassStep=beat*2,bs=Math.floor(barLocal/bassStep),bl=barLocal-bs*bassStep;
    let bassDegree=degree-7+(bs%2?4:0);
    if(barLocal>barDur-beat*.35&&bar<BARS-1)bassDegree=score[bar+1].degree-8;
    const bassF=noteFromDegree(room,bassDegree,0),bassEnv=envAD(bl,.006,.34+.18*room.warm);
    const bass=(Math.sin(TAU*bassF*x)+.13*Math.sin(TAU*bassF*2*x))*bassEnv*(.039+.024*room.warm)*section.bass;
    addStereo(acc,bass,0);

    // Sparse upper voice; deliberately avoids foreground-song density.
    const leadEvent=spec.lead[Math.min(3,beatIndex)],leadLocal=barLocal-beatIndex*beat-leadEvent.offset;
    if(leadEvent.active&&leadLocal>=0&&leadLocal<beat*.86){
      const f=noteFromDegree(room,leadEvent.degree,1),e=envAD(leadLocal,.018,.33+.20*(1-room.motion));
      const voice=(Math.sin(TAU*f*x)+.18*Math.sin(TAU*f*2*x))*e*leadEvent.velocity*(.020+.030*room.melody)*section.lead;
      addStereo(acc,voice,beatIndex%2?-.28:.28);
    }

    // Restrained rhythm section. Pattern intensity follows the arrangement rather
    // than running unchanged for the entire file.
    const beatLocal=barLocal-beatIndex*beat;
    if((beatIndex===0||beatIndex===2)&&beatLocal<.18){
      const sweep=45+78*Math.exp(-beatLocal*25),kick=Math.sin(TAU*sweep*x)*Math.exp(-beatLocal*23)*(.035+.078*room.drums)*section.drums;
      addStereo(acc,kick,0);
    }
    if((beatIndex===1||beatIndex===3)&&beatLocal<.14){
      const brush=(rand()*2-1)*Math.exp(-beatLocal*28)*(.014+.043*room.drums)*section.drums;
      addStereo(acc,brush,.12);
    }
    const hatPhase=barLocal%(beat/2);
    if(hatPhase<.045&&section.drums>.08){
      const raw=rand()*2-1;airLP=airLP*.58+raw*.42;
      const hat=(raw-airLP)*Math.exp(-hatPhase*78)*(.008+.026*room.drums)*section.drums;
      addStereo(acc,hat,(Math.floor(barLocal/(beat/2))%2?-.55:.55));
    }

    // Layered environmental/tape bed. Low-passed random sources avoid white-noise hiss.
    const noise=rand()*2-1;
    airLP=airLP*.989+noise*.011;
    airSlow=airSlow*.99955+noise*.00045;
    const texture=(airLP*.64+airSlow*1.8)*(.025+.078*room.air)*section.air;
    addStereo(acc,texture,-.12+Math.sin(x*.07)*.18);
    if(rand()<.000035*(1+room.air*2.8))crackle=.025+rand()*.055;
    crackle*=.991;
    const click=(rand()*2-1)*crackle;
    addStereo(acc,click,.42*Math.sin(x*.61));

    // Intro/outro contour gives tracks shape while remaining safe for automatic continuity.
    const fadeIn=Math.min(1,x/1.6),fadeOut=Math.min(1,(duration-x)/2.4),shape=Math.max(0,Math.min(fadeIn,fadeOut));
    dryL[n]=acc[0]*shape;
    dryR[n]=acc[1]*shape;
  }

  // Stereo multi-tap ambience with cross-feed. This is intentionally simple and
  // deterministic, keeping build-time audio fully first-party and reproducible.
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
    // Gentle tape-like saturation, with a tiny channel asymmetry for width.
    l=Math.tanh(l*(1.36+.05*room.warm));
    r=Math.tanh(r*(1.34+.04*room.warm));
    wetL[n]=l;wetR[n]=r;peak=Math.max(peak,Math.abs(l),Math.abs(r));
  }

  const gain=Math.min(1.20,.92/peak),dataBytes=N*4,buf=new ArrayBuffer(44+dataBytes),v=new DataView(buf);
  const enc=(o,text)=>{for(let j=0;j<text.length;j++)v.setUint8(o+j,text.charCodeAt(j))};
  enc(0,'RIFF');v.setUint32(4,36+dataBytes,true);enc(8,'WAVE');enc(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
  v.setUint32(24,SR,true);v.setUint32(28,SR*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);
  enc(36,'data');v.setUint32(40,dataBytes,true);
  for(let n=0;n<N;n++){
    const l=clamp(Math.tanh(wetL[n]*gain*1.08)),r=clamp(Math.tanh(wetR[n]*gain*1.08));
    v.setInt16(44+n*4,Math.round(l*32767),true);
    v.setInt16(46+n*4,Math.round(r*32767),true);
  }
  return new Uint8Array(buf);
}

export async function generateAudio(out){
  for(const room of rooms){
    const dir=path.join(out,'audio',room.slug);
    await mkdir(dir,{recursive:true});
    for(let track=1;track<=3;track++)await writeFile(path.join(dir,track+'.wav'),synth(room,track));
  }
  return rooms.length*3;
}

export const audioRoomSlugs=rooms.map(room=>room.slug);
export const audioEngineContract=Object.freeze({
  version:2,
  sampleRate:SR,
  channels:2,
  bars:BARS,
  model:'authored-elements-plus-deterministic-arrangement',
  thirdPartyAudio:false
});

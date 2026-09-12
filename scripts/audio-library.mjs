import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rooms=[
  {slug:'roma',bpm:72,root:53,mode:'minor7',warm:.92,keys:.78,pluck:.42,drums:.34,air:.14,swing:.08},
  {slug:'window',bpm:64,root:55,mode:'major7',warm:.84,keys:.92,pluck:.28,drums:.12,air:.32,swing:.05},
  {slug:'long-way-home',bpm:78,root:50,mode:'dorian',warm:.66,keys:.42,pluck:.58,drums:.48,air:.22,swing:.04},
  {slug:'two-hundred',bpm:58,root:48,mode:'minor7',warm:.55,keys:.58,pluck:.48,drums:.25,air:.38,swing:.02},
  {slug:'one-more-log',bpm:62,root:48,mode:'major7',warm:.96,keys:.65,pluck:.68,drums:.08,air:.24,swing:.06},
  {slug:'rooftop',bpm:70,root:57,mode:'major7',warm:.88,keys:.72,pluck:.52,drums:.38,air:.18,swing:.09},
  {slug:'friends',bpm:74,root:55,mode:'dorian',warm:.9,keys:.72,pluck:.48,drums:.42,air:.14,swing:.11},
  {slug:'backroom',bpm:86,root:52,mode:'minor7',warm:.64,keys:.38,pluck:.82,drums:.7,air:.1,swing:.08},
  {slug:'headspace',bpm:60,root:55,mode:'major7',warm:.78,keys:.98,pluck:.2,drums:.03,air:.25,swing:.0},
  {slug:'last-bus',bpm:56,root:48,mode:'minor7',warm:.55,keys:.76,pluck:.25,drums:.08,air:.36,swing:.0},
  {slug:'momentum',bpm:82,root:57,mode:'major7',warm:.8,keys:.8,pluck:.56,drums:.55,air:.1,swing:.07},
  {slug:'between',bpm:56,root:50,mode:'dorian',warm:.52,keys:.96,pluck:.16,drums:.02,air:.44,swing:.0}
];

const sr=32000,bars=8;
const modes={
  major7:[0,2,4,7,9,11,14],
  minor7:[0,2,3,5,7,10,12],
  dorian:[0,2,3,5,7,9,10]
};
const progressions=[
  [0,4,5,3,0,4,3,4],
  [0,5,3,4,0,5,4,4],
  [0,3,5,4,0,3,4,5]
];
const TAU=Math.PI*2;
function midi(n){return 440*Math.pow(2,(n-69)/12)}
function hash(s){let h=2166136261>>>0;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let x=seed||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%1000000)/1000000}}
function fract(x){return x-Math.floor(x)}
function tri(p){return 1-4*Math.abs(fract(p)-.5)}
function softSaw(p){const a=TAU*p;return Math.sin(a)+.34*Math.sin(a*2)+.16*Math.sin(a*3)+.08*Math.sin(a*4)}
function noteFromDegree(room,degree,octave=0){const scale=modes[room.mode],d=((degree%7)+7)%7,oct=Math.floor(degree/7)+octave;return midi(room.root+scale[d]+12*oct)}
function chord(room,degree,track){const color=track===2?[0,2,4,6]:track===3?[0,2,5,6]:[0,2,4,5];return color.map((step,k)=>noteFromDegree(room,degree+step,k===3?-1:0))}
function envAD(local,attack,decay){if(local<0)return 0;if(local<attack)return local/attack;return Math.exp(-(local-attack)/decay)}

function synth(room,track){
  const beat=60/room.bpm,barDur=beat*4,dur=barDur*bars,N=Math.floor(sr*dur),dry=new Float32Array(N),rand=rng(hash(room.slug+':'+track));
  const prog=progressions[(track-1)%progressions.length];let noiseLP=0,crackle=0;
  for(let n=0;n<N;n++){
    const x=n/sr,bar=Math.floor(x/barDur)%bars,beatPos=(x%barDur)/beat,beatIndex=Math.floor(beatPos),sub=beatPos-beatIndex;
    const degree=prog[bar],frequencies=chord(room,degree,track),wow=.0018*Math.sin(TAU*.17*x)+.0011*Math.sin(TAU*.07*x+1.3);
    let y=0;

    // Warm sustained chord bed with slow breathing and detune.
    const padAmp=.055+.055*room.warm;
    const breath=.78+.22*Math.sin(TAU*(1/(barDur*2))*x+.5);
    for(let k=0;k<frequencies.length;k++){
      const f=frequencies[k]*(k===1?1.002:k===2?.998:1);
      const phase=f*x*(1+wow);
      const harmonic=softSaw(phase)*(.35/(1+k*.12))+Math.sin(TAU*phase*.5)*.2;
      y+=harmonic*padAmp*breath;
    }

    // Piano/electric-key figure. Uses short decays and room-specific density.
    const eighth=beat/2,stepFloat=x/eighth,step=Math.floor(stepFloat),local=x-step*eighth;
    const sequence=[0,2,4,2,5,4,2,1,0,4,2,6,5,4,2,1];
    const swing=(step%2?room.swing*eighth:0),keyLocal=local-swing;
    if(keyLocal>=0){
      const deg=degree+sequence[(step+track*3)%sequence.length],f=noteFromDegree(room,deg,track===3?1:0),e=envAD(keyLocal,.008,.24+.22*room.keys);
      const bell=Math.sin(TAU*f*x)+.38*Math.sin(TAU*f*2.01*x)+.14*Math.sin(TAU*f*3.98*x);
      y+=bell*e*(.025+.075*room.keys);
    }

    // Muted guitar/pluck pattern for motion.
    const quarter=beat,qs=Math.floor(x/quarter),ql=x-qs*quarter;
    if(((qs+track)%2===0)||room.pluck>.65){
      const deg=degree+[0,4,2,5][qs%4],f=noteFromDegree(room,deg,0),e=envAD(ql,.003,.11+.16*room.pluck);
      y+=(tri(f*x)+.22*Math.sin(TAU*f*2*x))*e*(.018+.055*room.pluck);
    }

    // Round bass line.
    const bassF=noteFromDegree(room,degree-7,0),bassEnv=.65+.35*Math.exp(-sub*3.5);
    y+=(Math.sin(TAU*bassF*x)+.18*Math.sin(TAU*bassF*2*x))*bassEnv*(.045+.025*room.warm);

    // Soft kick, brushed snare and hats. Kept intentionally restrained.
    const beatLocal=x-Math.floor(x/beat)*beat;
    if(beatLocal<.17){const sweep=48+72*Math.exp(-beatLocal*25);y+=Math.sin(TAU*sweep*x)*Math.exp(-beatLocal*24)*(.04+.09*room.drums)}
    const half=x%(beat/2);
    if(half<.055){noiseLP=noiseLP*.72+(rand()*2-1)*.28;y+=noiseLP*Math.exp(-half*70)*(.012+.038*room.drums)}
    if((beatIndex===1||beatIndex===3)&&beatLocal<.12){const brush=(rand()*2-1)*Math.exp(-beatLocal*30);y+=brush*(.018+.05*room.drums)}

    // Room tone: rain/tape/air rather than white-noise hiss.
    const raw=rand()*2-1;noiseLP=noiseLP*.992+raw*.008;
    y+=noiseLP*(.05+.12*room.air);
    if(rand()<.000045*(1+room.air*3))crackle=(rand()*.08+.02);
    crackle*=.992;y+=(rand()*2-1)*crackle;

    dry[n]=y;
  }

  // A tiny multi-tap room reverb glues the synthetic instruments together.
  const d1=Math.floor(sr*.137),d2=Math.floor(sr*.271),d3=Math.floor(sr*.413),wet=new Float32Array(N);
  let peak=.001;
  for(let n=0;n<N;n++){
    let y=dry[n];
    if(n>=d1)y+=dry[n-d1]*.19;
    if(n>=d2)y+=dry[n-d2]*.11;
    if(n>=d3)y+=dry[n-d3]*.065;
    y=Math.tanh(y*1.45);
    wet[n]=y;peak=Math.max(peak,Math.abs(y));
  }
  const gain=Math.min(1.15,.91/peak),buf=new ArrayBuffer(44+N*2),v=new DataView(buf),enc=(o,s)=>{for(let j=0;j<s.length;j++)v.setUint8(o+j,s.charCodeAt(j))};
  enc(0,'RIFF');v.setUint32(4,36+N*2,true);enc(8,'WAVE');enc(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);enc(36,'data');v.setUint32(40,N*2,true);
  for(let n=0;n<N;n++){const shaped=Math.tanh(wet[n]*gain*1.12),z=Math.max(-32768,Math.min(32767,Math.round(shaped*32767)));v.setInt16(44+n*2,z,true)}
  return new Uint8Array(buf);
}

export async function generateAudio(out){
  for(const room of rooms){const dir=path.join(out,'audio',room.slug);await mkdir(dir,{recursive:true});for(let t=1;t<=3;t++)await writeFile(path.join(dir,t+'.wav'),synth(room,t))}
  return rooms.length*3;
}
export const audioRoomSlugs=rooms.map(r=>r.slug);

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rooms=[
  {slug:'roma',name:'Pizzeria Roma',bpm:72,root:53,mode:'minor7',style:'vinyl soul',warm:.94,keys:.76,pluck:.46,drums:.34,air:.15,swing:.08,tracks:['The red booth','Closing time oregano','Receipt under the saucer']},
  {slug:'window',name:'The window seat',bpm:64,root:55,mode:'major7',style:'rainy jazz',warm:.84,keys:.94,pluck:.24,drums:.12,air:.34,swing:.05,tracks:['Streetlights in water','Quiet between the buses','Blue room, warm cup']},
  {slug:'long-way-home',name:'The long way home',bpm:78,root:50,mode:'dorian',style:'mellow indie',warm:.68,keys:.44,pluck:.64,drums:.48,air:.2,swing:.04,tracks:['Exit nineteen','Windows down','The road after sunset']},
  {slug:'two-hundred',name:'Two hundred to go',bpm:68,root:48,mode:'minor7',style:'neon downtempo',warm:.58,keys:.58,pluck:.44,drums:.28,air:.38,swing:.02,tracks:['Pump number four','Receipt in the wind','Coffee under neon']},
  {slug:'one-more-log',name:'Just one more log',bpm:58,root:48,mode:'major7',style:'fireside acoustic',warm:.98,keys:.62,pluck:.74,drums:.08,air:.24,swing:.06,tracks:['Cedar and wool','Snow against the door','Embers talking']},
  {slug:'rooftop',name:'Nobody wants to go in',bpm:74,root:57,mode:'major7',style:'sunset soul',warm:.9,keys:.74,pluck:.52,drums:.4,air:.16,swing:.09,tracks:['Orange on the parapet','Windows turning gold','Last glass before dark']},
  {slug:'friends',name:'A few good friends',bpm:76,root:55,mode:'dorian',style:'courtyard soul',warm:.92,keys:.7,pluck:.46,drums:.44,air:.14,swing:.11,tracks:['The long story','Glass on stone','Stay for another']},
  {slug:'backroom',name:'The backroom stage',bpm:88,root:52,mode:'minor7',style:'small-room indie',warm:.66,keys:.36,pluck:.86,drums:.72,air:.1,swing:.08,tracks:['Before the encore','Red curtain hum','Mic left on']},
  {slug:'headspace',name:'A little headspace',bpm:60,root:55,mode:'major7',style:'focus piano',warm:.8,keys:.99,pluck:.18,drums:.03,air:.24,swing:0,tracks:['Margin notes','The second cup','Window open four inches']},
  {slug:'last-bus',name:'The last bus',bpm:62,root:48,mode:'minor7',style:'night ambient',warm:.58,keys:.78,pluck:.2,drums:.08,air:.4,swing:0,tracks:['Doors closing','Nobody at the platform','Home through glass']},
  {slug:'momentum',name:'A little momentum',bpm:82,root:57,mode:'major7',style:'morning jazz beat',warm:.82,keys:.82,pluck:.56,drums:.56,air:.1,swing:.07,tracks:['Toast and sunlight','Before everyone wakes','Half a grapefruit']},
  {slug:'between',name:'Somewhere in between',bpm:56,root:50,mode:'dorian',style:'drifting piano',warm:.54,keys:.98,pluck:.14,drums:.02,air:.46,swing:0,tracks:['Room without an address','Almost remembered','Signal through fog']}
];

const sr=32000,bars=8;
const modes={
  major7:[0,2,4,7,9,11,14],
  minor7:[0,2,3,5,7,10,12],
  dorian:[0,2,3,5,7,9,10]
};
const modeNames={major7:'major',minor7:'minor',dorian:'dorian'};
const noteNames=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const progressions=[
  [0,4,5,3,0,4,3,4],
  [0,5,3,4,0,5,4,4],
  [0,3,5,4,0,3,4,0]
];
const motifBanks=[
  [0,2,4,2,5,4,2,1,0,2,4,6,5,4,2,1],
  [0,1,2,4,2,5,4,2,0,4,5,4,2,1,2,0],
  [0,4,2,5,4,6,5,2,1,2,4,2,5,4,2,0]
];
const TAU=Math.PI*2,SIN_SIZE=8192,SIN=new Float32Array(SIN_SIZE);
for(let i=0;i<SIN_SIZE;i++)SIN[i]=Math.sin(TAU*i/SIN_SIZE);

function midi(n){return 440*Math.pow(2,(n-69)/12)}
function hash(s){let h=2166136261>>>0;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let x=seed||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%1000000)/1000000}}
function fract(x){return x-Math.floor(x)}
function tri(p){return 1-4*Math.abs(fract(p)-.5)}
function sinP(p){const x=fract(p)*SIN_SIZE,i=x|0,j=(i+1)&(SIN_SIZE-1),f=x-i;return SIN[i]+(SIN[j]-SIN[i])*f}
function softSaw(p){return sinP(p)+.34*sinP(p*2)+.16*sinP(p*3)+.08*sinP(p*4)}
function envAD(local,attack,decay){if(local<0)return 0;if(local<attack)return local/attack;return Math.exp(-(local-attack)/decay)}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function noteFromDegree(room,degree,octave=0){const scale=modes[room.mode],d=((degree%7)+7)%7,oct=Math.floor(degree/7)+octave;return midi(room.root+scale[d]+12*oct)}
function noteLabel(room){return noteNames[((room.root%12)+12)%12]+' '+modeNames[room.mode]}
function sectionForBar(bar){if(bar<1)return'intro';if(bar<4)return'A';if(bar<7)return'B';return'outro'}
function sectionEnergy(bar,track){const section=sectionForBar(bar),bias=track===1?.92:track===2?1.05:.84;if(section==='intro')return .56*bias;if(section==='A')return .9*bias;if(section==='B')return 1.06*bias;return .62*bias}
function chordDegrees(track){return track===1?[0,2,4,6]:track===2?[0,2,4,5]:[0,2,5,6]}
function chord(room,degree,track,bar){
  const inversion=(bar+track)%3,steps=chordDegrees(track);
  return steps.map((step,k)=>{
    let d=degree+step;
    if(k<inversion)d+=7;
    const octave=k===3?-1:0;
    return noteFromDegree(room,d,octave);
  });
}
function bassDegree(degree,beatIndex,track){if(track===2&&beatIndex===3)return degree+4;if(track===3&&beatIndex===2)return degree+2;return degree-7}
function motifDegree(track,step,bar){
  const bank=motifBanks[(track-1)%motifBanks.length],base=bank[(step+bar*2)%bank.length];
  if(sectionForBar(bar)==='B'&&step%4===3)return base+7;
  return base;
}
function arrangementName(track){return track===1?'warm narrative':track===2?'rhythmic lift':'late-night drift'}

function synth(room,track){
  const beat=60/room.bpm,barDur=beat*4,dur=barDur*bars,N=Math.floor(sr*dur),dry=new Float32Array(N),rand=rng(hash(room.slug+':v2:'+track));
  const prog=progressions[(track-1)%progressions.length];
  const eighth=beat/2,sixteenth=beat/4;
  let airLP=0,brown=0,crackle=0,masterLP=0,prev=0;

  for(let n=0;n<N;n++){
    const x=n/sr,bar=Math.floor(x/barDur)%bars,barX=x-bar*barDur,beatFloat=barX/beat,beatIndex=Math.floor(beatFloat),beatPhase=beatFloat-beatIndex;
    const degree=prog[bar],frequencies=chord(room,degree,track,bar),energy=sectionEnergy(bar,track);
    const wow=.00145*sinP(.17*x)+.0008*sinP(.071*x+1.3/TAU),flutter=.00024*sinP(5.1*x+track/TAU);
    let y=0;

    // Sustained voiced harmony: section-aware, detuned and gently breathing.
    const padAmp=(.042+.052*room.warm)*energy,breath=.79+.21*sinP((1/(barDur*2))*x+.45/TAU);
    for(let k=0;k<frequencies.length;k++){
      const detune=1+([-.0018,.0013,-.0011,.0007][k]||0),f=frequencies[k]*detune,phase=f*x*(1+wow+flutter);
      const tone=softSaw(phase)*(.29/(1+k*.14))+sinP(phase*.5)*.18+sinP(phase*1.003)*.08;
      y+=tone*padAmp*breath;
    }

    // Electric piano motif with rests, dynamics and B-section answer phrases.
    const stepFloat=x/eighth,step=Math.floor(stepFloat),local=x-step*eighth,swing=(step%2?room.swing*eighth:0),keyLocal=local-swing;
    const motifStep=step%16,rest=(track===3&&motifStep%4===1)||(track===1&&motifStep===7)||(sectionForBar(bar)==='intro'&&motifStep%2===1);
    if(!rest&&keyLocal>=0){
      const deg=degree+motifDegree(track,motifStep,bar),octave=track===3&&sectionForBar(bar)==='B'?1:0,f=noteFromDegree(room,deg,octave),e=envAD(keyLocal,.007,.19+.2*room.keys);
      const velocity=(motifStep%4===0?1:.76)*(sectionForBar(bar)==='outro'?.72:1);
      const bell=sinP(f*x)+.34*sinP(f*2.01*x)+.11*sinP(f*3.98*x)+.06*sinP(f*.5*x);
      y+=bell*e*velocity*(.018+.067*room.keys)*energy;
    }

    // Muted guitar/pluck syncopation; track 2 drives, track 3 leaves more space.
    const pluckStep=Math.floor(x/sixteenth),pluckLocal=x-pluckStep*sixteenth,pattern=(pluckStep+track*3)%16;
    const activePluck=track===2?[0,3,6,10,12,15].includes(pattern):track===1?[0,6,8,14].includes(pattern):[0,8].includes(pattern);
    if(activePluck&&pluckLocal<.34){
      const deg=degree+[0,4,2,5,1,4][pattern%6],f=noteFromDegree(room,deg,track===2&&pattern===15?1:0),e=envAD(pluckLocal,.0025,.075+.13*room.pluck);
      y+=(tri(f*x)+.18*sinP(f*2*x)+.08*sinP(f*3*x))*e*(.016+.058*room.pluck)*energy;
    }

    // Bass follows harmony with occasional fifth/approach tones and a soft transient.
    const bassDeg=bassDegree(degree,beatIndex,track),bassF=noteFromDegree(room,bassDeg,0),bassAttack=Math.exp(-beatPhase*7),bassBody=.58+.42*Math.exp(-beatPhase*2.6);
    y+=(sinP(bassF*x)+.16*sinP(bassF*2*x))*bassBody*(.036+.028*room.warm)*energy;
    y+=sinP(bassF*1.995*x)*bassAttack*.008*energy;

    // Restrained groove with section builds and bar-end fills.
    const beatLocal=x-Math.floor(x/beat)*beat,section=sectionForBar(bar),drumEnergy=room.drums*energy*(section==='intro'?.55:section==='outro'?.48:1);
    const kickHit=beatIndex===0||(track===2&&beatIndex===2)||(room.drums>.6&&beatIndex===3&&bar%2===1);
    if(kickHit&&beatLocal<.19){
      const phase=TAU*(49*beatLocal+18*(1-Math.exp(-beatLocal*20)));
      y+=sinP(phase/TAU)*Math.exp(-beatLocal*23)*(.034+.095*drumEnergy);
    }
    const half=x%(beat/2);
    if(half<.045&&drumEnergy>.025){airLP=airLP*.64+(rand()*2-1)*.36;y+=airLP*Math.exp(-half*88)*(.009+.032*drumEnergy)}
    if((beatIndex===1||beatIndex===3)&&beatLocal<.12){const brush=(rand()*2-1)*Math.exp(-beatLocal*31);y+=brush*(.014+.052*drumEnergy)}
    const fillLocal=barX-(barDur-beat/2);
    if((bar===3||bar===6)&&fillLocal>=0&&fillLocal<beat/2&&drumEnergy>.12){
      const burst=fillLocal%(beat/8),accent=Math.exp(-burst*75);y+=(rand()*2-1)*accent*.034*drumEnergy;
    }

    // Room texture: tape-like brown air and sparse crackle, not broad white hiss.
    const raw=rand()*2-1;airLP=airLP*.992+raw*.008;brown=brown*.985+airLP*.015;
    y+=(airLP*.45+brown*.8)*(.035+.105*room.air);
    if(rand()<.000035*(1+room.air*3.2))crackle=(rand()*.075+.018);
    crackle*=.991;y+=(rand()*2-1)*crackle;

    // Intro/outro fades make tracks feel composed rather than abruptly looped.
    const fadeIn=clamp(x/1.4,0,1),fadeOut=clamp((dur-x)/2.4,0,1),shape=fadeIn*fadeOut;
    dry[n]=y*shape;
  }

  // Multi-tap room reverb + a subtle widening-like chorus in mono. Process in place to keep build memory bounded.
  const d1=Math.floor(sr*.113),d2=Math.floor(sr*.239),d3=Math.floor(sr*.397),chorus=Math.floor(sr*.021);
  let peak=.001;
  for(let n=0;n<N;n++){
    let y=dry[n];
    if(n>=chorus)y+=dry[n-chorus]*.045;
    if(n>=d1)y+=dry[n-d1]*.18;
    if(n>=d2)y+=dry[n-d2]*.105;
    if(n>=d3)y+=dry[n-d3]*.058;
    masterLP=masterLP*.996+y*.004;
    const highPassed=y-masterLP*.72;
    y=Math.tanh(highPassed*1.42+prev*.018);prev=y;
    dry[n]=y;peak=Math.max(peak,Math.abs(y));
  }

  const gain=Math.min(1.18,.9/peak),buf=new ArrayBuffer(44+N*2),v=new DataView(buf),enc=(o,s)=>{for(let j=0;j<s.length;j++)v.setUint8(o+j,s.charCodeAt(j))};
  enc(0,'RIFF');v.setUint32(4,36+N*2,true);enc(8,'WAVE');enc(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);enc(36,'data');v.setUint32(40,N*2,true);
  for(let n=0;n<N;n++){const shaped=Math.tanh(dry[n]*gain*1.1),z=Math.max(-32768,Math.min(32767,Math.round(shaped*32767)));v.setInt16(44+n*2,z,true)}
  return {bytes:new Uint8Array(buf),duration:dur};
}

export async function generateAudio(out){
  const manifest=[];
  for(const room of rooms){
    const dir=path.join(out,'audio',room.slug);await mkdir(dir,{recursive:true});
    for(let t=1;t<=3;t++){
      const rendered=synth(room,t);await writeFile(path.join(dir,t+'.wav'),rendered.bytes);
      manifest.push({
        id:room.slug+':'+t,
        room:room.slug,
        roomName:room.name,
        track:t,
        title:room.tracks[t-1],
        bpm:room.bpm,
        key:noteLabel(room),
        style:room.style,
        arrangement:arrangementName(t),
        durationSeconds:Number(rendered.duration.toFixed(2)),
        format:'pcm_s16le',
        sampleRate:sr,
        channels:1,
        generator:'afterlight-composition-engine-v2'
      });
    }
  }
  await writeFile(path.join(out,'music-manifest.json'),JSON.stringify({version:2,generated:true,rights:'original procedural composition rendered by Afterlight',tracks:manifest},null,2)+'\n');
  return manifest.length;
}
export const audioRoomSlugs=rooms.map(r=>r.slug);

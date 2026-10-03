import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const V3_MASTER_GAIN_DB=5;
export const V3_MASTERING_METHOD='linear-post-render-v1';
const V3_MASTER_GAIN=Math.pow(10,V3_MASTER_GAIN_DB/20);

function parsePcm16Wav(buffer){
  if(buffer.length<44||buffer.subarray(0,4).toString()!=='RIFF'||buffer.subarray(8,12).toString()!=='WAVE')throw new Error('Master trim expects RIFF/WAVE audio');
  let offset=12,fmt=null,data=null;
  while(offset+8<=buffer.length){
    const id=buffer.subarray(offset,offset+4).toString('ascii'),size=buffer.readUInt32LE(offset+4),start=offset+8,end=start+size;
    if(end>buffer.length)throw new Error('Malformed WAV chunk during master trim: '+id);
    if(id==='fmt '){
      if(size<16)throw new Error('WAV fmt chunk is too short during master trim');
      fmt={format:buffer.readUInt16LE(start),channels:buffer.readUInt16LE(start+2),bits:buffer.readUInt16LE(start+14),blockAlign:buffer.readUInt16LE(start+12)};
    }else if(id==='data'&&!data){
      data={start,size};
    }
    offset=end+(size%2);
  }
  if(!fmt||!data)throw new Error('WAV is missing fmt/data during master trim');
  if(fmt.format!==1||fmt.channels!==2||fmt.bits!==16||fmt.blockAlign!==4)throw new Error('Master trim supports generated stereo PCM16 only');
  return {dataStart:data.start,dataBytes:data.size};
}

export function applyV3MasterTrim(bytes){
  const buffer=Buffer.from(bytes),wav=parsePcm16Wav(buffer);
  let sourcePeak=0;
  for(let offset=wav.dataStart;offset+1<wav.dataStart+wav.dataBytes;offset+=2){
    sourcePeak=Math.max(sourcePeak,Math.abs(buffer.readInt16LE(offset)/32768));
  }
  const projectedPeak=sourcePeak*V3_MASTER_GAIN;
  if(projectedPeak>=.98)throw new Error(`V3 +${V3_MASTER_GAIN_DB} dB trim would approach clipping: projected sample peak ${projectedPeak.toFixed(4)}`);
  let masteredPeak=0;
  for(let offset=wav.dataStart;offset+1<wav.dataStart+wav.dataBytes;offset+=2){
    const sample=buffer.readInt16LE(offset)/32768,mastered=sample*V3_MASTER_GAIN;
    masteredPeak=Math.max(masteredPeak,Math.abs(mastered));
    buffer.writeInt16LE(Math.round(mastered*32767),offset);
  }
  return {
    bytes:new Uint8Array(buffer),
    gainDb:V3_MASTER_GAIN_DB,
    method:V3_MASTERING_METHOD,
    sourceSamplePeak:Number(sourcePeak.toFixed(5)),
    masteredSamplePeak:Number(masteredPeak.toFixed(5))
  };
}

export async function masterGeneratedCatalog(out,roomSlugs){
  const mastered=[];
  for(const room of roomSlugs){
    for(let track=1;track<=3;track++){
      const file=path.join(out,'audio',room,String(track)+'.wav'),raw=await readFile(file),result=applyV3MasterTrim(raw);
      await writeFile(file,result.bytes);
      mastered.push({room,track,sourceSamplePeak:result.sourceSamplePeak,masteredSamplePeak:result.masteredSamplePeak});
    }
  }
  const manifestPath=path.join(out,'music-manifest.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  manifest.mastering={method:V3_MASTERING_METHOD,gainDb:V3_MASTER_GAIN_DB};
  for(const track of manifest.tracks||[]){
    track.masterGainDb=V3_MASTER_GAIN_DB;
    track.masteringMethod=V3_MASTERING_METHOD;
  }
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
  return mastered;
}

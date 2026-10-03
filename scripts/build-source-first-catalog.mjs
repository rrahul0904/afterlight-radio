import { auditStageACatalog } from './stage-a-catalog-readiness.mjs';

const roomMeta={
  rooftop:{label:'ROOFTOP · 7:42 PM',title:'Nobody wants to go in.',copy:'The city is still warm. Nobody has said goodbye yet.',mix:'sunset soul'},
  window:{label:'WINDOW SEAT · RAIN',title:'Stay until your stop.',copy:'Streetlights smear across the glass and the bus keeps moving.',mix:'rainy jazz'},
  headspace:{label:'HEADSPACE · QUIET HOURS',title:'A little room in your head.',copy:'Nothing needs your attention except the next line.',mix:'focus piano'},
  'last-bus':{label:'LAST BUS · 12:18 AM',title:'Home through the glass.',copy:'Almost nobody is talking. The city has finally lowered its voice.',mix:'night ambient'}
};

const providerContract={
  owned:{kind:'html-audio',rights:'first-party-or-cleared'},
  cleared:{kind:'html-audio',rights:'receipt-bound-cleared-master'},
  youtube:{
    kind:'official-iframe-visible',rights:'embed-availability-required',status:'adapter-contract-only-no-catalog-ids-committed',
    minViewport:{width:200,height:200},requireVisiblePlayback:true,allowObscuringOverlay:false,allowAudioExtraction:false,
    allowBackgroundPlay:false,preserveYouTubeMetadataAndStandardExperience:true
  }
};

export function buildSourceFirstCatalog({manifest,baselineSource}){
  const audit=auditStageACatalog(manifest);
  if(!audit.ready){
    const demo=baselineSource.includes("mode:'demo'")?baselineSource:baselineSource.replace('version:2,',"version:3,\n  mode:'demo',");
    return {mode:'demo',source:demo,audit};
  }

  const rooms={};
  for(const [slug,meta] of Object.entries(roomMeta)){
    const tracks=manifest.entries.filter(entry=>entry.room===slug).map(entry=>({
      id:`${slug}-${entry.assetSha256?.slice(0,12)||entry.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`,
      title:entry.title,
      artist:entry.artist,
      provider:entry.provider,
      source:entry.sourceUrl,
      attribution:entry.attribution||'',
      license:entry.licenseScope,
      assetSha256:entry.assetSha256||null,
      humanListeningApproved:Boolean(entry.humanListeningApproved)
    }));
    rooms[slug]={...meta,tracks};
  }
  const payload={version:3,mode:'stage-a',rooms,providerContract};
  return {mode:'stage-a',source:`window.AFTERLIGHT_REBUILD_CATALOG=${JSON.stringify(payload,null,2)};\n`,audit};
}

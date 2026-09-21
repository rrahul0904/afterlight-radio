import assert from 'node:assert/strict';
import {handleApi} from '../src/api-core.js';

const originalFetch=globalThis.fetch;
const calls=[];
let signedIn=true;

const env={
  NEON_AUTH_BASE_URL:'https://auth.example',
  NAVIDROME_BASE_URL:'https://music.example',
  NAVIDROME_USERNAME:'listener',
  NAVIDROME_TOKEN:'token-secret',
  NAVIDROME_SALT:'salt-secret',
  NAVIDROME_CLIENT_NAME:'afterlight-test'
};

globalThis.fetch=async input=>{
  const url=new URL(typeof input==='string'?input:input.url||String(input));
  calls.push(url.toString());
  if(url.hostname==='auth.example'&&url.pathname==='/get-session'){
    return signedIn
      ? Response.json({user:{id:'11111111-1111-1111-1111-111111111111',email:'test@example.com'}})
      : Response.json({error:'signed out'},{status:401});
  }
  if(url.hostname==='music.example'&&url.pathname==='/rest/search3.view'){
    assert.equal(url.searchParams.get('u'),'listener');
    assert.equal(url.searchParams.get('t'),'token-secret');
    assert.equal(url.searchParams.get('s'),'salt-secret');
    return Response.json({'subsonic-response':{
      status:'ok',
      searchResult3:{song:[{id:'song-1',title:'Owned Song',artist:'Test Artist',album:'Test Album',duration:123,coverArt:'cover-1'}]}
    }});
  }
  if(url.hostname==='music.example'&&url.pathname==='/rest/getLyricsBySongId.view'){
    assert.equal(url.searchParams.get('id'),'song-1');
    return Response.json({'subsonic-response':{
      status:'ok',
      lyricsList:{structuredLyrics:[
        {
          displayArtist:'Test Artist',
          displayTitle:'Owned Song',
          lang:'xxx',
          offset:-125,
          synced:true,
          line:[
            {start:0,value:'First line'},
            {start:2450,value:'Second line'},
            {start:5000,value:'x'.repeat(2500)}
          ]
        },
        {
          lang:'eng',
          synced:false,
          line:[{value:'Unsynced line'}]
        }
      ]}
    }});
  }
  throw new Error('Unexpected fetch '+url);
};

try{
  const search=await handleApi(new Request('https://afterlight.test/api/library/provider/search?q=owned'),env);
  assert.equal(search.status,200);
  const searchData=await search.json();
  assert.equal(searchData.tracks.length,1);
  assert.equal(searchData.tracks[0].lyricsUrl,'/api/library/provider/lyrics?id=song-1');
  assert.equal(searchData.tracks[0].streamUrl,'/api/library/provider/stream?id=song-1');

  const response=await handleApi(new Request('https://afterlight.test/api/library/provider/lyrics?id=song-1'),env);
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.provider,'navidrome');
  assert.equal(data.providerTrackId,'song-1');
  assert.equal(data.available,true);
  assert.equal(data.tracks.length,2);
  assert.deepEqual(data.tracks[0].lines.slice(0,2),[
    {startMs:0,text:'First line'},
    {startMs:2450,text:'Second line'}
  ]);
  assert.equal(data.tracks[0].lines[2].text.length,2000);
  assert.equal(data.tracks[0].lang,'und');
  assert.equal(data.tracks[0].offsetMs,-125);
  assert.equal(data.tracks[0].synced,true);
  assert.deepEqual(data.tracks[1].lines,[{startMs:null,text:'Unsynced line'}]);

  const serialized=JSON.stringify(data);
  for(const secret of ['token-secret','salt-secret','listener'])assert.equal(serialized.includes(secret),false);

  const invalid=await handleApi(new Request('https://afterlight.test/api/library/provider/lyrics?id=../../etc/passwd'),env);
  assert.equal(invalid.status,400);

  signedIn=false;
  const signedOut=await handleApi(new Request('https://afterlight.test/api/library/provider/lyrics?id=song-1'),env);
  assert.equal(signedOut.status,401);

  assert.ok(calls.some(url=>url.includes('/rest/getLyricsBySongId.view')));
  console.log('PASS: provider lyrics are authenticated, bounded, line-timed, normalized, and keep provider credentials server-side');
}finally{
  globalThis.fetch=originalFetch;
}

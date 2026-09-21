import assert from 'node:assert/strict';
import {handleOpenStreamApi,openStreamConfig,isOpenStreamPath} from '../src/openstream-provider.js';

const calls=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async input=>{
  const url=new URL(typeof input==='string'?input:input.url);
  calls.push(url.toString());
  if(url.pathname==='/health')return Response.json({ok:true});
  if(url.pathname==='/api/capabilities')return Response.json({library:true,hls:true});
  if(url.pathname==='/api/library'){
    assert.equal(url.searchParams.get('key'),'control-secret');
    return Response.json({items:[
      {id:'one',name:'Song One',path:'album/song-one.mp3',type:'file',metadata:{codec:'mp3'}},
      'mix/list.m3u'
    ]});
  }
  if(url.pathname==='/api/channels'){
    assert.equal(url.searchParams.get('key'),'listen-secret');
    return Response.json({channels:[{id:'live',name:'Live',status:'playing',streamUrl:'https://media.example/stream?key=listen-secret'}]});
  }
  if(url.pathname==='/api/state/snapshot'){
    assert.equal(url.searchParams.get('key'),'listen-secret');
    return Response.json({nowPlaying:'Song One',secret:'listen-secret',url:'https://media.example/x?key=listen-secret'});
  }
  return Response.json({error:'unexpected'},{status:404});
};

try{
  assert.equal(isOpenStreamPath('/api/providers/openstream/status'),true);
  assert.equal(isOpenStreamPath('/api/me'),false);

  assert.deepEqual(openStreamConfig({}),{enabled:false});
  assert.equal(openStreamConfig({OPENSTREAM_URL:'http://127.0.0.1:4321'}).enabled,false);
  assert.equal(openStreamConfig({OPENSTREAM_URL:'http://127.0.0.1:4321'}).error,'https_required');
  assert.equal(openStreamConfig({OPENSTREAM_URL:'https://127.0.0.1:4321'}).error,'private_network_blocked');

  const env={
    OPENSTREAM_URL:'https://music.example',
    OPENSTREAM_LISTEN_KEY:'listen-secret',
    OPENSTREAM_CONTROL_KEY:'control-secret'
  };

  let response=await handleOpenStreamApi(new Request('https://afterlight.test/api/providers/openstream/status'),env);
  assert.equal(response.status,200);
  let data=await response.json();
  assert.equal(data.enabled,true);
  assert.equal(data.reachable,true);
  assert.equal(data.listenConfigured,true);
  assert.equal(data.controlConfigured,true);

  response=await handleOpenStreamApi(new Request('https://afterlight.test/api/providers/openstream/library'),env);
  assert.equal(response.status,200);
  data=await response.json();
  assert.equal(data.count,2);
  assert.deepEqual(data.items[0],{
    id:'one',
    name:'Song One',
    path:'album/song-one.mp3',
    type:'file',
    duration:null,
    size:null,
    metadata:{codec:'mp3'}
  });
  assert.equal(data.items[1].type,'playlist');

  response=await handleOpenStreamApi(new Request('https://afterlight.test/api/providers/openstream/channels'),env);
  assert.equal(response.status,200);
  data=await response.json();
  assert.equal(data.channels[0].id,'live');
  assert.ok(!JSON.stringify(data).includes('listen-secret'));

  response=await handleOpenStreamApi(new Request('https://afterlight.test/api/providers/openstream/state'),env);
  assert.equal(response.status,200);
  data=await response.json();
  assert.ok(!JSON.stringify(data).includes('listen-secret'));
  assert.equal(data.state.secret,'[redacted]');
  assert.match(data.state.url,/key=%5Bredacted%5D|key=\[redacted\]/);

  response=await handleOpenStreamApi(new Request('https://afterlight.test/api/providers/openstream/library'),{
    OPENSTREAM_URL:'https://music.example'
  });
  assert.equal(response.status,503);
  data=await response.json();
  assert.equal(data.code,'control_key_missing');

  response=await handleOpenStreamApi(new Request('https://afterlight.test/api/providers/openstream/library',{method:'POST'}),env);
  assert.equal(response.status,405);
  assert.equal(response.headers.get('allow'),'GET');

  for(const url of calls){
    assert.ok(!url.includes('listen-secret')||url.includes('/api/channels')||url.includes('/api/state/snapshot'));
    assert.ok(!url.includes('control-secret')||url.includes('/api/library'));
  }

  console.log('PASS: OpenStream provider validates origins, separates listen/control authority, normalizes read-only data, and redacts secrets');
}finally{
  globalThis.fetch=originalFetch;
}

import { handleApi } from './api-core.js';

function fail(error){
  console.error(error);
  return new Response(JSON.stringify({error:'Internal server error'}),{
    status:500,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
}

export default{
  async fetch(req,env){
    try{
      const url=new URL(req.url);
      if(url.pathname.startsWith('/api/'))return await handleApi(req,env);
      return env.ASSETS.fetch(req);
    }catch(error){return fail(error)}
  }
};

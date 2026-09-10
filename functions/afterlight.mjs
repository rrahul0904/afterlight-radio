import { handleApi } from '../src/api-core.js';

const PUBLIC_ENV={
  NEON_AUTH_BASE_URL:'https://ep-bitter-cake-axu59msq.neonauth.c-4.us-east-2.aws.neon.tech/afterlight/auth'
};

export default {
  async fetch(request){
    try{
      return await handleApi(request,{...PUBLIC_ENV,...process.env});
    }catch(error){
      console.error(error);
      return new Response(JSON.stringify({error:'Internal server error'}),{
        status:500,
        headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
      });
    }
  }
};

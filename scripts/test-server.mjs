import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('public');
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.wav':'audio/wav','.css':'text/css; charset=utf-8'};
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))};

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/config')return json(res,200,{authEnabled:true,billingEnabled:true,portalEnabled:false,webhookEnabled:true,supportEnabled:true});
  if(url.pathname==='/api/me')return json(res,401,{error:'Not signed in'});
  if(url.pathname==='/api/events'){res.writeHead(204,{'Cache-Control':'no-store'});return res.end()}
  if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Test API route not implemented'});

  const pathname=decodeURIComponent(url.pathname);
  if(pathname.includes('\0')||pathname.includes('..')){res.writeHead(400);return res.end('Bad request')}
  let file=path.join(root,pathname.replace(/^\/+/,''));
  try{
    const info=await stat(file);
    if(info.isDirectory())file=path.join(file,'index.html');
  }catch{
    if(!path.extname(file))file=path.join(file,'index.html');
  }
  try{
    const data=await readFile(file);
    const ext=path.extname(file).toLowerCase();
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  }catch{
    try{
      const fallback=await readFile(path.join(root,'404.html'));
      res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});
      res.end(fallback);
    }catch{
      res.writeHead(404);res.end('Not found');
    }
  }
});
server.listen(port,'127.0.0.1',()=>console.log(`Afterlight test server listening on http://127.0.0.1:${port}`));
const shutdown=()=>server.close(()=>process.exit(0));
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);

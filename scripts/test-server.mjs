import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('public');
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.wav':'audio/wav','.css':'text/css; charset=utf-8'};
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body))};

function parseRange(header,size){
  const match=/^bytes=(\d*)-(\d*)$/.exec(header||'');
  if(!match)return null;
  let start=match[1]?Number(match[1]):null,end=match[2]?Number(match[2]):null;
  if(start===null&&end!==null){start=Math.max(0,size-end);end=size-1}
  else{start=start??0;end=end??size-1}
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||start>=size)return false;
  return {start,end:Math.min(end,size-1)};
}

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
    const contentType=types[ext]||'application/octet-stream';
    const headers={'Content-Type':contentType,'Cache-Control':'no-store'};
    if(ext==='.wav'){
      headers['Accept-Ranges']='bytes';
      const range=parseRange(req.headers.range,data.length);
      if(range===false){
        res.writeHead(416,{...headers,'Content-Range':`bytes */${data.length}`});
        return res.end();
      }
      if(range){
        const chunk=data.subarray(range.start,range.end+1);
        res.writeHead(206,{...headers,'Content-Range':`bytes ${range.start}-${range.end}/${data.length}`,'Content-Length':String(chunk.length)});
        return req.method==='HEAD'?res.end():res.end(chunk);
      }
    }
    res.writeHead(200,{...headers,'Content-Length':String(data.length)});
    if(req.method==='HEAD')return res.end();
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

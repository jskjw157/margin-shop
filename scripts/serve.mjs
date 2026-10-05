/** Local preview only. The deployed app is static and has no backend endpoints. */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT || 4173);
const host=process.env.HOST || '127.0.0.1';
const server=http.createServer(async(req,res)=>{
  if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405);return res.end();}
  let path;
  try{path=new URL(req.url,'http://localhost').pathname;}catch{res.writeHead(400);return res.end();}
  if(!['/','/index.html','/margin-shop/','/margin-shop/index.html'].includes(path)){res.writeHead(404);return res.end('Not found');}
  try{
    const html=await readFile(resolve(root,'index.html'));
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:html);
  }catch{res.writeHead(503);res.end('Run npm run build first.');}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,host,()=>console.log(`Margin Shop: http://${host}:${port}`));

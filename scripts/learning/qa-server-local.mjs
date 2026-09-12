// Local-only browser QA: serves the built SPA and proxies the disposable Supabase API.
// Capture keys/status only, never credentials, code, answers, notes, artifact values or signed URLs.
import { createServer } from 'node:http';
import { readFileSync, appendFileSync, existsSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
const root=resolve('dist/client');
const evidence=process.env.LEARNING_QA_NETWORK_LOG ?? '/tmp/corelia-learning-network.jsonl';
let fault=null;
let assetFault=null;
function keys(value,prefix='',depth=0) {
 if(!value || typeof value!=='object' || depth>3) return [];
 return Object.entries(value).flatMap(([key,item])=>[prefix+key,...keys(item,`${prefix}${key}.`,depth+1)]);
}
const api=createServer(async(req,res)=>{
 try {
  const parsed=new URL(req.url,'http://127.0.0.1:54521');
  if(parsed.pathname==='/__qa/asset' && req.method==='POST') {
   let body=''; for await(const chunk of req) body+=chunk;
   const input=JSON.parse(body);
   if(typeof input.prefix!=='string' || !input.prefix.startsWith('/assets/')){res.writeHead(400).end();return;}
   assetFault={prefix:input.prefix,remaining:Math.min(Math.max(Number(input.count)||1,1),3)};res.writeHead(204).end();return;
  }
  if(parsed.pathname==='/__qa/fault' && req.method==='POST') {
   let body=''; for await(const chunk of req) body+=chunk;
   const input=JSON.parse(body);
   if(!/^\/rest\/v1\//.test(input.path) || ![503,0].includes(input.status)) {res.writeHead(400).end(); return;}
   fault={path:input.path,status:input.status,delay:Math.min(Math.max(Number(input.delay)||0,0),10000)};
   res.writeHead(204).end(); return;
  }
  const chunks=[]; for await(const chunk of req) chunks.push(chunk);
  const body=Buffer.concat(chunks);
  let shape=[]; try{shape=keys(JSON.parse(body.toString()));}catch{/* Binary or empty payload: no capture. */}
  const matching=fault && parsed.pathname===fault.path && req.method!=='OPTIONS';
  const selected=matching?fault:null; if(matching)fault=null;
  if(selected?.delay)await new Promise(r=>setTimeout(r,selected.delay));
  const cors={'Access-Control-Allow-Origin':req.headers.origin??'*','Access-Control-Allow-Headers':req.headers['access-control-request-headers']??'*','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,PATCH,PUT,DELETE,OPTIONS','Access-Control-Expose-Headers':'*'};
  if(req.method==='OPTIONS'){res.writeHead(204,cors).end();return;}
  if(selected?.status){appendFileSync(evidence,JSON.stringify({at:new Date().toISOString(),method:req.method,path:parsed.pathname,status:selected.status,keys:shape,injected:true})+'\n');res.writeHead(selected.status,{...cors,'Content-Type':'application/json'}).end('{"message":"Local QA injected failure"}');return;}
  const headers={...req.headers}; delete headers.host; delete headers.connection; delete headers['content-length']; delete headers['accept-encoding'];
  const upstream=await fetch(`http://127.0.0.1:54321${req.url}`,{method:req.method,headers,body:body.length?body:undefined});
  const responseHeaders=Object.fromEntries([...upstream.headers].filter(([key])=>!key.startsWith('access-control-'))); delete responseHeaders['content-encoding'];delete responseHeaders['content-length'];delete responseHeaders['transfer-encoding'];
  appendFileSync(evidence,JSON.stringify({at:new Date().toISOString(),method:req.method,path:parsed.pathname,status:upstream.status,keys:shape})+'\n');
  res.writeHead(upstream.status,{...responseHeaders,...cors}).end(Buffer.from(await upstream.arrayBuffer()));
 }catch{res.writeHead(502,{'Access-Control-Allow-Origin':'*'}).end('Local QA upstream unavailable');}
});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const app=createServer((req,res)=>{
 if(assetFault && req.url.startsWith(assetFault.prefix)) {
  if(--assetFault.remaining===0)assetFault=null;
  appendFileSync(evidence,JSON.stringify({at:new Date().toISOString(),method:'GET',path:new URL(req.url,'http://127.0.0.1:5190').pathname,status:503,keys:[],injected:true})+'\n');
  res.writeHead(503,{'Cache-Control':'no-store'}).end('Local QA asset failure');return;
 }
 let file=resolve(root,'.'+new URL(req.url,'http://127.0.0.1:5190').pathname);
 if(!file.startsWith(root+'/'))file=resolve(root,'index.html');
 if(!existsSync(file)||!statSync(file).isFile())file=resolve(root,'index.html');
 res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store'}).end(readFileSync(file));
});
api.listen(54521,'127.0.0.1');app.listen(5190,'127.0.0.1');
console.log('Local QA artifact: http://127.0.0.1:5190; proxy: http://127.0.0.1:54521. Only field names are captured.');
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{api.close();app.close();process.exit(0);});

import http from 'node:http';
import {mkdir,writeFile,readFile,readdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import {validateUrl,summarize} from './normalize.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.LIGHTHOUSE_PORT || 4177);
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'reports');
const ALLOW_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;
const CATEGORIES = ['performance','accessibility','best-practices','seo'];
let busy = false;
await mkdir(DIR,{recursive:true});

function allowed(req) {
  const origin = req.headers.origin;
  return !origin || ALLOW_ORIGIN.test(origin);
}
function cors(req,res) {
  const origin=req.headers.origin;
  if (origin && ALLOW_ORIGIN.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
  }
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
}
function json(res,status,body) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify(body));
}
async function bodyJson(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) {
    throw new Error('Expected application/json');
  }
  const parts=[];let bytes=0;
  for await(const part of req) {
    bytes+=part.length;
    if(bytes>16384) throw new Error('Request too large');
    parts.push(part);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
async function trimReports(max=24) {
  const files=(await readdir(DIR)).filter(x=>x.endsWith('.html'));
  if(files.length<=max)return;
  const dated=await Promise.all(files.map(async name=>({
    name, stat:await import('node:fs/promises').then(fs=>fs.stat(path.join(DIR,name)))
  })));
  dated.sort((a,b)=>b.stat.mtimeMs-a.stat.mtimeMs);
  for(const f of dated.slice(max)) {
    await Promise.allSettled([
      unlink(path.join(DIR,f.name)),
      unlink(path.join(DIR,f.name.replace(/\.html$/,'.json')))
    ]);
  }
}
async function runAudit(url,strategy) {
  let chrome;
  try {
    chrome=await chromeLauncher.launch({
      chromeFlags:['--headless=new','--disable-extensions','--no-first-run','--no-default-browser-check']
    });
    const results=await lighthouse(url,{
      port:chrome.port,
      logLevel:'error',
      output:'html',
      onlyCategories:CATEGORIES,
      ...(strategy==='desktop'?{preset:'desktop'}:{}),
      maxWaitForLoad:45000
    });
    if(!results?.lhr) throw new Error('Lighthouse produced no result');
    const lhr=results.lhr;
    if(lhr.runtimeError) throw new Error(lhr.runtimeError.message||'Page could not be audited');
    const id=randomUUID();
    const html=Array.isArray(results.report)?results.report[0]:results.report;
    await Promise.all([
      writeFile(path.join(DIR,id+'.html'),html,'utf8'),
      writeFile(path.join(DIR,id+'.json'),JSON.stringify(lhr),'utf8')
    ]);
    trimReports().catch(()=>{});
    return {id,...summarize(lhr,strategy)};
  } finally {
    if(chrome) await chrome.kill().catch(()=>{});
  }
}
const server=http.createServer(async(req,res)=>{
  cors(req,res);
  if(!allowed(req))return json(res,403,{error:'Access denied for this origin.'});
  const pathname=new URL(req.url||'/', 'http://localhost').pathname;
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method==='GET' && pathname==='/health')return json(res,200,{
    ok:true,engine:'Local Lighthouse + headless Chrome',version:'1.0.0',busy
  });
  if(req.method==='GET' && /^\/api\/reports\/[a-f0-9-]{36}\.(html|json)$/.test(pathname)){
    try {
      const name=pathname.split('/').at(-1);
      const data=await readFile(path.join(DIR,name));
      res.writeHead(200,{
        'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':'application/json; charset=utf-8',
        'Content-Disposition':'attachment; filename="lighthouse-'+name+'"'
      });
      return res.end(data);
    }catch{return json(res,404,{error:'Report not found'});}
  }
  if(req.method==='POST' && pathname==='/api/audit'){
    if(busy)return json(res,409,{error:'Another audit is running. Wait for it to finish.'});
    let data,url,strategy;
    try{
      data=await bodyJson(req);
      url=validateUrl(data.url);
      strategy=data.strategy==='desktop'?'desktop':'mobile';
    }catch(e){return json(res,400,{error:e.message});}
    busy=true;
    try {
      const result=await runAudit(url,strategy);
      return json(res,200,result);
    }catch(e){
      console.error('Lighthouse audit failed:',e);
      return json(res,500,{error:String(e.message||e).slice(0,700)});
    }finally{busy=false;}
  }
  return json(res,404,{error:'Not found'});
});
server.requestTimeout=180_000;
server.listen(PORT,HOST,()=>{
  console.log('Lighthouse Pro agent ready at http://'+HOST+':'+PORT);
  console.log('Chrome extension can start real mobile and desktop Lighthouse audits.');
});

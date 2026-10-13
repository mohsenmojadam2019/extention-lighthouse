import http from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import {normalizeTarget, buildSummary, pickReports} from './utils.mjs';

const HOST = '127.0.0.1';
const PORT = 4177;
const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'reports');
const INDEX = path.join(DATA,'history.json');
const jobs = new Map();
let records = [];
let activeId = null;
await mkdir(DATA, {recursive:true});
try { records = JSON.parse(await readFile(INDEX,'utf8')); } catch { records = []; }
if (!Array.isArray(records)) records = [];

function allowedOrigin(origin) { return !origin || /^chrome-extension:\/\/[a-p]{32}$/.test(origin); }
function headers(res, origin) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
  if (origin && allowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  }
}
function send(res, code, data) {
  res.statusCode=code;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function fail(res, code, message) { send(res,code,{error:message}); }
async function bodyJSON(req) {
  let size=0; const chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;
    if (size>16384) throw new Error('Request too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function saveHistory(record) {
  records = [record, ...records.filter(r=>r.id!==record.id)].slice(0,30);
  await writeFile(INDEX, JSON.stringify(records,null,2));
}
async function runAudit(job) {
  activeId=job.id;
  let chrome;
  try {
    job.status='running';
    job.stage='Launching isolated headless Chrome';
    chrome=await chromeLauncher.launch({
      chromeFlags:['--headless=new','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--disable-extensions'],
    });
    job.stage='Auditing page with Lighthouse';
    const flags={
      port:chrome.port,output:['html','json'],logLevel:'error',
      onlyCategories:['performance','accessibility','best-practices','seo'],
      formFactor:job.formFactor,
    };
    if (job.formFactor==='desktop') {
      flags.screenEmulation={mobile:false,width:1350,height:940,deviceScaleFactor:1,disabled:false};
    }
    const result=await lighthouse(job.url,flags);
    if (!result?.lhr) throw new Error('Lighthouse returned no results.');
    if (result.lhr.runtimeError) throw new Error(result.lhr.runtimeError.message || 'Lighthouse runtime error.');
    const summary=buildSummary(result.lhr,job.url,job.formFactor,job.id);
    const picked=pickReports(result.report);
    const html=picked.html;
    const json=picked.json || JSON.stringify(result.lhr);
    if (!html) throw new Error('Lighthouse HTML report is missing.');
    await Promise.all([
      writeFile(path.join(DATA,job.id+'.html'),html),
      writeFile(path.join(DATA,job.id+'.json'),json),
      writeFile(path.join(DATA,job.id+'.summary.json'),JSON.stringify(summary)),
    ]);
    job.status='complete';job.stage='Finished';job.summary=summary;job.completedAt=new Date().toISOString();
    await saveHistory({id:job.id,url:job.url,formFactor:job.formFactor,generatedAt:summary.generatedAt,scores:summary.scores});
  } catch(e) {
    job.status='error';job.stage='Failed';job.error=String(e?.message||e);
    console.error('[audit]',job.id,job.error);
  } finally {
    if(chrome) try {await chrome.kill();} catch(e) {console.warn('Chrome cleanup:',e.message);}
    activeId=null;
  }
}
const ID=/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i;
const server=http.createServer(async (req,res)=>{
  const origin=req.headers.origin || '';
  headers(res,origin);
  if(!allowedOrigin(origin)) return fail(res,403,'Only the installed Chrome extension can access this agent.');
  if(req.method==='OPTIONS') {res.statusCode=204;res.end();return;}
  let pathname;
  try {pathname=new URL(req.url,'http://127.0.0.1').pathname;} catch {return fail(res,400,'Bad URL');}
  try {
    if(req.method==='GET' && (pathname==='/health'||pathname==='/api/health')) {
      return send(res,200,{ok:true,name:'Lighthouse Pro',version:'1.0.0',engine:'Google Lighthouse',busy:activeId!==null,local:true});
    }
    if(req.method==='GET' && pathname==='/api/history') {
      return send(res,200,{history:records});
    }
    if(req.method==='POST' && pathname==='/api/audits') {
      if(!String(req.headers['content-type']||'').startsWith('application/json'))return fail(res,415,'JSON required.');
      if(activeId) return fail(res,409,'An audit is already running. Please wait.');
      const params=await bodyJSON(req);
      const url=normalizeTarget(params.url);
      const formFactor=params.formFactor==='desktop'?'desktop':'mobile';
      const id=randomUUID();
      const job={id,url,formFactor,status:'queued',stage:'Waiting',createdAt:new Date().toISOString()};
      jobs.set(id,job);
      send(res,202,{id,status:job.status});
      setImmediate(()=>runAudit(job));
      return;
    }
    const matches=pathname.match(/^\/api\/audits\/([0-9a-f-]+)$/i);
    if(req.method==='GET' && matches && ID.test(matches[1])) {
      const job=jobs.get(matches[1]);
      if (job) return send(res,200,job);
      const record=records.find(r=>r.id===matches[1]);
      if (!record) return fail(res,404,'Audit not found.');
      const summary=JSON.parse(await readFile(path.join(DATA,record.id+'.summary.json'),'utf8'));
      return send(res,200,{id:record.id,status:'complete',summary});
    }
    const report=pathname.match(/^\/api\/reports\/([0-9a-f-]+)\/(html|json)$/i);
    if(req.method==='GET' && report && ID.test(report[1])) {
      const [_,id,format]=report;
      if(!records.some(r=>r.id===id))return fail(res,404,'Report not found.');
      const file=path.join(DATA,id+'.'+format);
      if(!existsSync(file))return fail(res,404,'Report not found.');
      res.statusCode=200;
      res.setHeader('Content-Type',format==='html'?'text/html; charset=utf-8':'application/json; charset=utf-8');
      res.setHeader('Content-Disposition','attachment; filename="lighthouse-'+id+'.'+format+'"');
      res.end(await readFile(file));
      return;
    }
    fail(res,404,'Route not found.');
  } catch (e) {
    console.error('[request]',e.message);
    fail(res,400,String(e.message||e));
  }
});
server.requestTimeout=180000;
server.listen(PORT,HOST,()=>console.log('Lighthouse Pro running at http://'+HOST+':'+PORT+'/health'));

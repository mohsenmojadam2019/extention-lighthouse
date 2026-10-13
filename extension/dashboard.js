'use strict';
const API='http://127.0.0.1:4177';
const $=id=>document.getElementById(id);
let mode='mobile',running=false,lastReport=null;
const qs=new URLSearchParams(location.search);
const startingUrl=qs.get('url')||'';
$('urlInput').value=startingUrl;

function tone(n) {return n==null?'#a9b5c7':n>=90?'#11af89':n>=50?'#efb04a':'#e65c6c';}
function scoreText(n){return n===null||n===undefined?'—':String(n);}
function el(tag,className,textValue){
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(textValue!==undefined)node.textContent=textValue;
  return node;
}
function setNotice(message,kind=''){
  $('notice').textContent=message;
  $('notice').className='notice '+kind;
}
function setBusy(value){
  running=value;
  $('runButton').disabled=value;
  $('runLabel').textContent=value?'در حال ارزیابی...':'اجرای آنالیز';
  $('runIcon').textContent=value?'◌':'◈';
}
async function checkAgent(){
  try{
    const response=await fetch(API+'/health',{cache:'no-store',signal:AbortSignal.timeout(3500)});
    if(!response.ok)throw Error('Unavailable');
    $('agentStatus').textContent='موتور متصل و آماده';
    $('statusDot').className='status-dot online';
    return true;
  }catch{
    $('agentStatus').textContent='سرویس محلی خاموش';
    $('statusDot').className='status-dot offline';
    return false;
  }
}
function hostOf(url){
  try{return new URL(url).host;}catch{return url;}
}
function cardScore(key,label,subtitle,value) {
  const card=el('div','score-card');
  const ring=el('div','score-ring');
  ring.style.setProperty('--tone',tone(value));
  ring.style.setProperty('--pct',value??0);
  const circle=el('div','score-inner',scoreText(value));
  ring.appendChild(circle);
  const details=el('div');
  details.append(el('div','score-title',label),el('div','score-desc',subtitle));
  details.appendChild(el('div','score-label',value==null?'بدون داده':value>=90?'خوب':value>=50?'نیازمند بهبود':'ضعیف'));
  card.append(ring,details);
  return card;
}
const categoryNames=[
  ['performance','عملکرد','PERFORMANCE'],
  ['accessibility','دسترس‌پذیری','ACCESSIBILITY'],
  ['bestPractices','استانداردها','BEST PRACTICES'],
  ['seo','سئو فنی','SEO']
];
const metricNames=[
  ['lcp','Largest Contentful Paint','LCP'],
  ['fcp','First Contentful Paint','FCP'],
  ['tbt','Total Blocking Time','TBT'],
  ['cls','Cumulative Layout Shift','CLS'],
  ['si','Speed Index','SI']
];
function renderReport(report){
  lastReport=report;
  $('reportArea').hidden=false;
  $('reportMeta').textContent=hostOf(report.url)+'  /  '+(report.strategy==='mobile'?'Mobile':'Desktop')+
    '  /  '+new Date(report.testedAt).toLocaleString('fa-IR')+'  /  Lighthouse '+(report.version||'');
  const scores=$('scores');scores.replaceChildren();
  for(const [key,label,subtitle] of categoryNames)scores.appendChild(cardScore(key,label,subtitle,report.scores?.[key]));
  const vitals=$('vitals');vitals.replaceChildren();
  for(const [key,name,short] of metricNames){
    const m=report.vitals?.[key]||{};
    const row=el('div','vital');const info=el('div','vital-info');
    const dot=el('span','vital-dot');dot.style.setProperty('--tone',tone(m.score==null?null:Math.round(m.score*100)));
    const label=el('div');
    label.append(el('div','vital-name',short),el('div','vital-help',name));
    info.append(dot,label);
    row.append(info,el('div','vital-value',m.label||'—'));
    vitals.appendChild(row);
  }
  const issues=$('insights');issues.replaceChildren();
  const diagnostics=Array.isArray(report.diagnostics)?report.diagnostics:[];
  $('issueCount').textContent=diagnostics.length+' مورد';
  if(!diagnostics.length)issues.appendChild(el('div','no-insights','فرصت بهبود امتیازدار دیگری در خروجی این اجرا شناسایی نشد. گزارش کامل را برای جزئیات بیشتر باز کنید.'));
  for(const item of diagnostics){
    const row=el('div','insight');
    row.appendChild(el('div','severity','!'));
    const body=el('div','insight-body');
    body.append(el('div','insight-title',item.title),el('div','insight-description',item.description||'برای جزئیات به گزارش کامل مراجعه کنید.'));
    row.appendChild(body);
    if(item.savingsMs>0)row.appendChild(el('div','insight-save','~'+Math.round(item.savingsMs)+' ms'));
    else if(item.detail)row.appendChild(el('div','insight-save',item.detail));
    issues.appendChild(row);
  }
}
async function saveHistory(report){
  const old=(await chrome.storage.local.get('audits')).audits||[];
  const clean=Array.isArray(old)?old:[];
  clean.unshift(report);
  await chrome.storage.local.set({audits:clean.slice(0,15)});
  renderHistory();
}
async function renderHistory(){
  const list=$('history');list.replaceChildren();
  const audits=(await chrome.storage.local.get('audits')).audits||[];
  if(!audits.length){list.appendChild(el('div','history-empty','هنوز گزارشی ثبت نشده است.'));return;}
  for(const report of audits){
    const row=el('div','history-row');
    row.appendChild(el('div','history-host',hostOf(report.url)));
    row.appendChild(el('div','history-date',new Date(report.testedAt).toLocaleString('fa-IR')+' / '+report.strategy));
    const pill=el('div','history-score','P '+scoreText(report.scores?.performance));
    pill.style.setProperty('--tone',tone(report.scores?.performance));
    row.appendChild(pill);
    const button=el('button','history-open','نمایش');
    button.type='button';
    button.addEventListener('click',()=>{
      renderReport(report);
      $('reportArea').scrollIntoView({behavior:'smooth',block:'start'});
    });
    row.appendChild(button);list.appendChild(row);
  }
}
function reportUrl(ext){
  if(!lastReport?.id)return null;
  return API+'/api/reports/'+lastReport.id+'.'+ext;
}
$('htmlButton').addEventListener('click',()=>{
  const url=reportUrl('html');if(url)chrome.tabs.create({url});
});
$('exportButton').addEventListener('click',()=>{
  const url=reportUrl('json');if(url)chrome.tabs.create({url});
});
$('clearHistory').addEventListener('click',async()=>{
  await chrome.storage.local.remove('audits');
  await renderHistory();
});
for(const button of document.querySelectorAll('[data-mode]')){
  button.addEventListener('click',()=>{
    mode=button.dataset.mode;
    for(const btn of document.querySelectorAll('[data-mode]'))btn.classList.toggle('selected',btn.dataset.mode===mode);
  });
}
async function startAudit(){
  if(running)return;
  const input=$('urlInput').value.trim();
  let url;
  try{
    url=new URL(input);
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error();
  }catch{
    setNotice('لطفاً آدرس کامل وب‌سایت را با https:// یا http:// وارد کنید.','error');return;
  }
  if(!(await checkAgent())){
    setNotice('سرویس محلی Lighthouse اجرا نشده است. در پوشه پروژه فایل scripts/start-agent.cmd را اجرا کنید و این صفحه را دوباره باز کنید.','error');return;
  }
  setBusy(true);
  setNotice('Chrome در حال اجرای ارزیابی واقعی '+(mode==='mobile'?'موبایل':'دسکتاپ')+' است. این مرحله معمولاً بین ۳۰ تا ۹۰ ثانیه طول می‌کشد.','loading');
  try {
    const response=await fetch(API+'/api/audit',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({url:url.toString(),strategy:mode}),
      signal:AbortSignal.timeout(180_000)
    });
    let result;
    try{result=await response.json();}catch{throw Error('Response could not be parsed');}
    if(!response.ok)throw Error(result.error||'Lighthouse failed');
    renderReport(result);
    await saveHistory(result);
    setNotice('ارزیابی واقعی با موفقیت انجام شد. برای همه جزئیات و شواهد، گزارش کامل HTML را باز کنید.','success');
    $('reportArea').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){
    const message=e.name==='TimeoutError'?'زمان تست تمام شد. اتصال، سرعت سایت و سرویس محلی را بررسی کنید.':e.message;
    setNotice('ارزیابی ناموفق بود: '+message,'error');
  }finally{setBusy(false);checkAgent();}
}
$('runButton').addEventListener('click',startAudit);
$('urlInput').addEventListener('keydown',e=>{if(e.key==='Enter')startAudit();});
checkAgent();
renderHistory().catch(()=>{});
if(startingUrl && /^https?:\/\//i.test(startingUrl))window.setTimeout(startAudit,300);

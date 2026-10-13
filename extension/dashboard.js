(() => {
  'use strict';
  const API = 'http://127.0.0.1:4177';
  const $ = id => document.getElementById(id);
  const form = $('audit-form'), input = $('url'), button = $('run-button');
  const msg = $('message'), loading = $('loading'), results = $('results');
  const categoryLabels = {'performance':'عملکرد و سرعت','accessibility':'دسترس‌پذیری','best-practices':'بهترین شیوه‌ها','seo':'سئو'};
  const scoreLabels = {'performance':'Performance','accessibility':'Accessibility','best-practices':'Best Practices','seo':'SEO'};
  const metricNames = {lcp:'Largest Contentful Paint',fcp:'First Contentful Paint',cls:'Cumulative Layout Shift',tbt:'Total Blocking Time',si:'Speed Index'};
  const metricFa = {lcp:'بارگذاری محتوای اصلی',fcp:'اولین نمایش محتوا',cls:'ثبات چیدمان',tbt:'زمان انسداد پردازش',si:'سرعت نمایش'};
  let selectedIssue = 'performance', latest = null, running = false;
  function html(text) {return String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function normalizeDescription(text) {
    return String(text||'').replace(/!\[([^\]]*)\]\([^)]+\)/g,'$1').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/<[^>]*>/g,'').replace(/[\`*_]/g,'').slice(0,420);
  }
  function showMessage(message,type='error') {
    msg.textContent=message;msg.className='notification'+(type==='ok'?' ok':'');msg.hidden=false;
  }
  function clearMessage() {msg.hidden=true;}
  function setLoading(active) {running=active;loading.hidden=!active;button.disabled=active;button.querySelector('span').textContent=active?'در حال تحلیل':'شروع تحلیل';}
  async function fetchJson(route,options) {
    const res=await fetch(API+route,{...options,cache:'no-store'});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||('HTTP '+res.status));
    return data;
  }
  async function checkAgent() {
    try {
      const state=await fetchJson('/api/health');
      $('agent-state').className='agent-state online';
      $('agent-state').querySelector('span').textContent='موتور Lighthouse متصل';
      return state.ok;
    } catch (_) {
      $('agent-state').className='agent-state offline';
      $('agent-state').querySelector('span').textContent='سرویس محلی خاموش است';
      showMessage('موتور Lighthouse اجرا نشده. فایل scripts/start-agent.cmd را از پوشه پروژه اجرا کنید؛ سپس دوباره «شروع تحلیل» را بزنید.');
      return false;
    }
  }
  function scoreClass(n){return n===null?'mid':n>=90?'good':n>=50?'mid':'poor';}
  function metricClass(key,value) {
    if(value===null || value===undefined) return 'mid';
    const bounds={lcp:[2500,4000],fcp:[1800,3000],cls:[.1,.25],tbt:[200,600],si:[3400,5800]};
    const [good,poor]=bounds[key]||[2500,4000];
    return value<=good?'good':value<=poor?'mid':'poor';
  }
  function formatSavings(issue) {
    if(issue.savingsMs>0)return '− '+issue.savingsMs.toLocaleString('en-US')+' ms';
    if(issue.savingsBytes>0)return '− '+Math.round(issue.savingsBytes/1024).toLocaleString('en-US')+' KB';
    return '';
  }
  function issueHtml(item) {
    const saving=formatSavings(item);
    return '<article class="issue-row"><div class="issue-top"><strong>'+html(item.title)+'</strong><span class="issue-saving">'+html(saving||((item.score??0)+' / 100'))+'</span></div>'+
      (item.displayValue?'<span class="issue-score">'+html(item.displayValue)+'</span>':'')+
      '<p>'+html(normalizeDescription(item.description)||'برای رفع این مشکل، گزارش کامل Lighthouse را مطالعه کنید.')+'</p></article>';
  }
  function showIssues() {
    if(!latest)return;
    const items=latest.checks?.[selectedIssue]||[];
    $('issues').innerHTML=items.length?items.map(issueHtml).join(''):'<p class="empty">مشکل قابل‌توجهی در این بخش شناسایی نشد.</p>';
    $('issue-count').textContent=items.length.toLocaleString('fa-IR')+' مورد';
    for(const b of $('category-tabs').querySelectorAll('button'))b.classList.toggle('active',b.dataset.category===selectedIssue);
  }
  function drawResult(report) {
    latest=report;
    loading.hidden=true;results.hidden=false;clearMessage();setLoading(false);
    $('result-url').textContent=report.finalUrl||report.url;
    const id=encodeURIComponent(report.id);
    $('download-html').href=API+'/api/reports/'+id+'/html';
    $('download-json').href=API+'/api/reports/'+id+'/json';
    $('wpt-link').href='https://www.webpagetest.org/';
    $('psi-link').href='https://pagespeed.web.dev/analysis?url='+encodeURIComponent(report.finalUrl||report.url);
    $('scores').innerHTML=Object.keys(scoreLabels).map(k=>{
      const val=report.scores?.[k]??null, css=scoreClass(val);
      return '<article class="score-card '+css+'"><div class="score-ring" style="--degree:'+(val===null?0:val*3.6)+'deg"><span>'+(val===null?'—':val)+'</span></div><h3>'+scoreLabels[k]+'</h3><p>'+categoryLabels[k]+'</p></article>';
    }).join('');
    $('metrics').innerHTML=Object.keys(metricNames).map(k=>{
      const item=report.metrics?.[k],css=metricClass(k,item?.value??null);
      return '<article class="metric-card"><span class="metric-abbr">'+k.toUpperCase()+'</span><div class="metric-value '+css+'">'+html(item?.display||'—')+'</div><div class="metric-title">'+metricFa[k]+'</div></article>';
    }).join('');
    const opportunities=report.opportunities||[];
    $('opportunity-count').textContent=opportunities.length.toLocaleString('fa-IR')+' مورد';
    $('opportunities').innerHTML=opportunities.length?opportunities.map(issueHtml).join(''):'<p class="empty">فرصت بهبود قابل‌اندازه‌گیری مهمی گزارش نشده است.</p>';
    $('category-tabs').innerHTML=Object.keys(categoryLabels).map(k=>'<button type="button" data-category="'+k+'" class="'+(k===selectedIssue?'active':'')+'">'+categoryLabels[k]+'</button>').join('');
    $('category-tabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{selectedIssue=b.dataset.category;showIssues();}));
    showIssues();
    results.scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function loadHistory() {
    try {
      const data=await fetchJson('/api/history');
      const rows=data.history||[];
      $('history').innerHTML=rows.length?rows.map(r=>
        '<button type="button" class="history-item" data-id="'+html(r.id)+'"><span><span class="history-url">'+html(r.url)+'</span><small>'+html(r.formFactor==='mobile'?'موبایل':'دسکتاپ')+' · '+html(new Date(r.generatedAt).toLocaleString('fa-IR'))+'</small></span><span class="history-scores">'+
        ['performance','accessibility','best-practices','seo'].map(k=>'<span>'+html(r.scores?.[k]??'—')+'</span>').join('')+'</span></button>'
      ).join(''):'<p class="muted">هنوز گزارشی ثبت نشده است.</p>';
      $('history').querySelectorAll('button[data-id]').forEach(b=>b.addEventListener('click',async ()=>{
        try {const j=await fetchJson('/api/audits/'+encodeURIComponent(b.dataset.id));if(j.summary)drawResult(j.summary);}
        catch(e){showMessage('بازیابی گزارش ناموفق بود: '+e.message);}
      }));
    }catch(_){/* agent offline */}
  }
  async function poll(id) {
    for(let attempt=0;attempt<150;attempt++){
      await new Promise(resolve=>setTimeout(resolve,1500));
      const job=await fetchJson('/api/audits/'+encodeURIComponent(id));
      $('progress-text').textContent=job.stage||'Lighthouse در حال اندازه‌گیری…';
      if(job.status==='complete'){drawResult(job.summary);await loadHistory();return;}
      if(job.status==='error')throw new Error(job.error||'ممیزی Lighthouse ناموفق بود.');
    }
    throw new Error('تحلیل بیش از حد طول کشید. وضعیت سرویس محلی را بررسی کنید.');
  }
  async function runAudit() {
    if(running)return;
    const url=input.value.trim();
    let parsed;
    try{parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw Error();}catch{showMessage('آدرس کامل وب‌سایت را با https:// یا http:// وارد کنید.');return;}
    clearMessage();
    const connected=await checkAgent();
    if(!connected)return;
    setLoading(true);results.hidden=true;
    $('progress-text').textContent='در حال شروع ممیزی واقعی…';
    try{
      const formFactor=form.querySelector('input[name="device"]:checked').value;
      const job=await fetchJson('/api/audits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,formFactor})});
      await poll(job.id);
    }catch(e){setLoading(false);showMessage('خطا در اجرای Lighthouse: '+e.message);}
  }
  form.addEventListener('submit',e=>{e.preventDefault();runAudit();});
  $('copy-summary').addEventListener('click',async()=>{
    if(!latest)return;
    const s=latest;
    const text=['Lighthouse Pro — '+s.finalUrl,'Mode: '+s.formFactor,
      ...Object.keys(scoreLabels).map(k=>scoreLabels[k]+': '+(s.scores[k]??'N/A')),
      ...Object.keys(metricNames).map(k=>k.toUpperCase()+': '+(s.metrics?.[k]?.display||'N/A')),
      'INP: Not available (field data required)',
      ...s.opportunities.slice(0,5).map(x=>'Fix: '+x.title+' ('+formatSavings(x)+')')].join('\n');
    try{await navigator.clipboard.writeText(text);showMessage('خلاصه گزارش در کلیپ‌بورد کپی شد.','ok');}catch(e){showMessage('کپی انجام نشد: '+e.message);}
  });
  const fromTab=new URLSearchParams(location.search).get('url');
  if(fromTab&&/^https?:\/\//i.test(fromTab))input.value=fromTab;
  (async()=>{const connected=await checkAgent();if(connected){await loadHistory();if(input.value)await runAudit();}})();
})();
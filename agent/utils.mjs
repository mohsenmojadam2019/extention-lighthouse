const metricIds = {
  fcp: 'first-contentful-paint',
  lcp: 'largest-contentful-paint',
  cls: 'cumulative-layout-shift',
  tbt: 'total-blocking-time',
  si: 'speed-index',
  tti: 'interactive',
};
const categoryKeys = ['performance', 'accessibility', 'best-practices', 'seo'];

export function normalizeTarget(text) {
  if (typeof text !== 'string' || text.length > 2048) throw new Error('Invalid URL length.');
  let target;
  try { target = new URL(text.trim()); } catch { throw new Error('Enter a complete http:// or https:// URL.'); }
  if (!['http:', 'https:'].includes(target.protocol) || !target.hostname || target.username || target.password) {
    throw new Error('Only HTTP and HTTPS website addresses are supported.');
  }
  target.hash = '';
  return target.toString();
}
function categoryScore(category) {
  const score = category?.score;
  return typeof score === 'number' ? Math.round(score * 100) : null;
}
export function compactAudit(audit, category = null) {
  if (!audit || !audit.title || typeof audit.score !== 'number' || audit.score >= 0.9) return null;
  if (audit.details?.type === 'debugdata' || audit.scoreDisplayMode === 'notApplicable' ||
      audit.scoreDisplayMode === 'informative' || audit.scoreDisplayMode === 'manual') return null;
  const ms = Math.max(0, Math.round(Number(audit.details?.overallSavingsMs) || 0));
  const bytes = Math.max(0, Math.round(Number(audit.details?.overallSavingsBytes) || 0));
  return {
    id: audit.id || '',
    title: audit.title,
    description: audit.description || '',
    score: Math.round(audit.score * 100),
    displayValue: audit.displayValue || '',
    savingsMs: ms,
    savingsBytes: bytes,
    category,
  };
}
export function pickReports(report) {
  const reports = Array.isArray(report) ? report : [report];
  return {
    html: reports.find(x => typeof x === 'string' && x.slice(0,2048).toLowerCase().includes('<!doctype html>')) || '',
    json: reports.find(x => typeof x === 'string' && x.trimStart().startsWith('{')) || '',
  };
}
export function buildSummary(lhr, url, formFactor, id) {
  const audits = lhr.audits || {};
  const scores = Object.fromEntries(categoryKeys.map(k => [k, categoryScore(lhr.categories?.[k])]));
  const metrics = {};
  for (const [key, auditId] of Object.entries(metricIds)) {
    const a = audits[auditId];
    metrics[key] = typeof a?.numericValue === 'number'
      ? {value: a.numericValue, display: a.displayValue || String(a.numericValue), score: a.score ?? null}
      : null;
  }
  // INP is a field metric and cannot be inferred from Lighthouse lab TBT.
  metrics.inp = null;
  const checks = {};
  const opportunities = [];
  for (const key of categoryKeys) {
    const refs = lhr.categories?.[key]?.auditRefs || [];
    checks[key] = [];
    for (const ref of refs) {
      const a = audits[ref.id];
      if (!a || ref.weight === 0 && a.details?.type !== 'opportunity') continue;
      const result = compactAudit({...a,id: ref.id},key);
      if (!result) continue;
      checks[key].push(result);
      if (key === 'performance' && (a.details?.type === 'opportunity' || result.savingsMs || result.savingsBytes)) {
        opportunities.push(result);
      }
    }
    checks[key].sort((a,b) => (a.score - b.score) || (b.savingsMs - a.savingsMs));
    checks[key] = checks[key].slice(0,30);
  }
  opportunities.sort((a,b) => (b.savingsMs - a.savingsMs) || (a.score - b.score));
  return {
    id, url, requestedUrl: lhr.requestedUrl || url, finalUrl: lhr.finalDisplayedUrl || lhr.finalUrl || url,
    formFactor, generatedAt: lhr.fetchTime || new Date().toISOString(),
    lighthouseVersion: lhr.lighthouseVersion || 'unknown',
    scores, metrics, opportunities: opportunities.slice(0,30), checks,
    warning: lhr.runWarnings || [], runtimeError: lhr.runtimeError?.message || null,
    environment: {userAgent:lhr.userAgent || '', benchmarkIndex:lhr.environment?.benchmarkIndex || null},
    clarification: 'Scores and LCP/CLS/FCP/TBT reflect synthetic lab measurements. INP requires CrUX/real-user field data; TBT is not INP.',
  };
}

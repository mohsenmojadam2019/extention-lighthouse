/** An intentionally small API contract: never invent audit scores or Core Web Vitals. */
export function validateUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('Enter a valid website URL.');
  let parsed;
  try { parsed = new URL(input.trim()); } catch { throw new Error('Enter an absolute http:// or https:// URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error('Only http(s) pages without embedded credentials can be audited.');
  }
  return parsed.toString();
}

export function summarize(lhr, strategy = 'mobile') {
  const audits = lhr.audits || {};
  const categories = lhr.categories || {};
  const category = id => categories[id]?.score == null ? null : Math.round(categories[id].score * 100);
  const metric = id => ({
    value: audits[id]?.numericValue ?? null,
    label: audits[id]?.displayValue ?? '—',
    score: audits[id]?.score ?? null
  });
  const diagnostics = Object.entries(audits)
    .filter(([,a]) => a && a.score !== null && a.score !== undefined && a.score < 0.9 && a.scoreDisplayMode !== 'manual' && a.scoreDisplayMode !== 'notApplicable')
    .filter(([,a]) => a.details?.type === 'opportunity' || a.details?.type === 'table' || a.details?.type === 'list')
    .map(([id,a]) => ({
      id, title: a.title || id,
      description: String(a.description || '').replace(/\[[^\]]+\]\([^)]+\)/g,'').replace(/\n/g,' ').slice(0,430),
      detail: a.displayValue || '',
      score: a.score,
      savingsMs: Math.max(0, a.details?.overallSavingsMs || 0)
    }))
    .sort((a,b) => (b.savingsMs - a.savingsMs) || (a.score - b.score)).slice(0,14);
  const meta = lhr.environment || {};
  return {
    url: lhr.finalDisplayedUrl || lhr.requestedUrl,
    testedAt: lhr.fetchTime || new Date().toISOString(),
    strategy,
    version: lhr.lighthouseVersion || '',
    userAgent: meta.hostUserAgent || '',
    scores: {
      performance: category('performance'),
      accessibility: category('accessibility'),
      bestPractices: category('best-practices'),
      seo: category('seo')
    },
    vitals: {
      fcp: metric('first-contentful-paint'),
      lcp: metric('largest-contentful-paint'),
      cls: metric('cumulative-layout-shift'),
      tbt: metric('total-blocking-time'),
      si: metric('speed-index')
    },
    diagnostics
  };
}

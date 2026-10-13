import test from 'node:test';
import assert from 'node:assert/strict';
import {validateUrl,summarize} from '../normalize.mjs';

test('accepts http(s) and localhost but rejects unsafe protocols and credentials', () => {
  assert.equal(validateUrl('https://example.org/foo'), 'https://example.org/foo');
  assert.equal(validateUrl('http://localhost:3000/'), 'http://localhost:3000/');
  for (const bad of ['file:///etc/passwd','javascript:alert(1)','chrome://extensions','https://u:p@example.com','garbage']) {
    assert.throws(() => validateUrl(bad));
  }
});

test('creates only Lighthouse-derived scores and vitals', () => {
  const report = summarize({
    requestedUrl:'https://example.org/',
    categories:{performance:{score:.83},accessibility:{score:.9},seo:{score:null},'best-practices':{score:1}},
    audits:{
      'largest-contentful-paint':{numericValue:1920,displayValue:'1.9 s',score:.89},
      'unused-javascript':{title:'Reduce unused JavaScript',description:'Save bytes',score:.2,scoreDisplayMode:'numeric',displayValue:'120 KiB',details:{type:'opportunity',overallSavingsMs:1250}},
      'unused-css-rules':{title:'Remove unused CSS',score:.3,displayValue:'',details:{type:'opportunity',overallSavingsMs:200}}
    }
  },'desktop');
  assert.deepEqual(report.scores,{performance:83,accessibility:90,bestPractices:100,seo:null});
  assert.equal(report.vitals.lcp.label,'1.9 s');
  assert.equal(report.vitals.cls.value,null);
  assert.equal(report.diagnostics[0].id,'unused-javascript');
  assert.equal(report.strategy,'desktop');
});

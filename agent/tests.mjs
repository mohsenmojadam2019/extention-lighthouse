import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTarget, compactAudit, buildSummary, pickReports} from './utils.mjs';

test('recognizes Lighthouse HTML report preceded by a license comment', () => {
  const {html,json}=pickReports(['<!-- license header -->\n<!doctype html>\n<html></html>','\n {\"lighthouseVersion\":\"12.8.2\"}']);
  assert.ok(html.startsWith('<!-- license'));
  assert.ok(json.trimStart().startsWith('{'));
});
test('accepts valid public page URLs and strips hashes', () => {
  assert.equal(normalizeTarget('https://example.com/a#b'),'https://example.com/a');
  assert.equal(normalizeTarget('http://localhost:3000/'),'http://localhost:3000/');
});
test('rejects privileged URL schemes', () => {
  for (const url of ['file:///etc/passwd','chrome://settings','javascript:alert(1)','not a url'])
    assert.throws(() => normalizeTarget(url));
});
test('normalizes metrics and keeps INP explicitly unavailable', () => {
  const lhr = {categories: {performance:{score:0.9,auditRefs:[{id:'render-blocking-resources',weight:1}]},seo:{score:1}},audits:{
    'largest-contentful-paint':{numericValue:2400,displayValue:'2.4 s'},
    'cumulative-layout-shift':{numericValue:0.05,displayValue:'0.05'},
    'total-blocking-time':{numericValue:100,displayValue:'100 ms'},
    'render-blocking-resources':{id:'render-blocking-resources',title:'Eliminate render-blocking',score:0.2,details:{type:'opportunity',overallSavingsMs:360},description:'Fix CSS'},
  }};
  const summary=buildSummary(lhr,'https://example.com','mobile','test');
  assert.equal(summary.scores.performance,90);
  assert.equal(summary.metrics.inp,null);
  assert.equal(summary.opportunities.length,1);
  assert.equal(summary.opportunities[0].savingsMs,360);
  assert.equal(compactAudit({score:null,details:{type:'debugdata'}}),null);
});
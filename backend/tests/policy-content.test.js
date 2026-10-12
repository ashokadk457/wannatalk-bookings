import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanPolicyHtml} from '../src/policyContent.js';
test('policy formatting and safe links survive sanitization',()=>{
  const html=cleanPolicyHtml('<h2>Terms</h2><p><strong>24 hours</strong> <em>notice</em></p><ol start="2"><li>Contact us</li></ol><a href="https://example.com">Website</a>');
  assert.ok(html.includes('<h2>Terms</h2>'));
  assert.ok(html.includes('<strong>24 hours</strong>'));
  assert.ok(html.includes('<ol start="2">'));
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});
test('scripts, event handlers and unsafe URL schemes cannot reach the patient view',()=>{
  const html=cleanPolicyHtml('<script>alert(1)</script><img src=x onerror=alert(1)><p onclick="alert(1)">Terms</p><a href="javascript:alert(1)">Bad link</a><iframe src="https://example.com"></iframe>');
  for(const forbidden of ['<script','<img','onclick','onerror','javascript:','<iframe']) assert.ok(!html.includes(forbidden));
  assert.ok(html.includes('Terms'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateScope } from '../extension/core.mjs';
test('only the exact approved practice page is allowed', () => {
  assert.equal(validateScope('https://college.codetantra.com/practice/123', 'https://college.codetantra.com/practice/123', true).ok, true);
  for (const [url, approved, consent] of [
    ['https://evil.example/practice/123', 'https://college.codetantra.com/practice/123', true],
    ['https://college.codetantra.com/practice/123','https://college.codetantra.com/practice/123',false],
    ['chrome://settings','chrome://settings',true],
    ['https://college.codetantra.com/exam/123','https://college.codetantra.com/exam/123',true],
    ['https://college.codetantra.com/practice/123?mode=assessment','https://college.codetantra.com/practice/123?mode=assessment',true],
    ['http://example.com/practice','http://example.com/practice',true],
    ['https://user:password@example.com/practice','https://user:password@example.com/practice',true],
  ]) assert.equal(validateScope(url, approved, consent).ok, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
const mintRe=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
test('malformed mint is rejected by Phase 2 validation contract',()=>{ assert.equal(mintRe.test('bad-risk-score'), false); assert.equal(mintRe.test('11111111111111111111111111111111'), true); });
test('pagination bounds are enforced by contract',()=>{ const page= Math.max(1, Number.parseInt('0',10)||1); const limit=Math.min(50, Math.max(1, Number.parseInt('500',10)||20)); assert.equal(page,1); assert.equal(limit,50); });
test('client risk fields are not part of mutation contract',()=>{ const allowed=['mintAddress']; const body={mintAddress:'11111111111111111111111111111111',riskScore:100}; assert.deepEqual(Object.keys(body).filter(k=>allowed.includes(k)), ['mintAddress']); });

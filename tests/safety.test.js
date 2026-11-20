const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { isTarget, validateAnswer, MessageGate } = require('../safety');
test('only exact Darsel personal JID passes', () => {
  assert.equal(isTarget('12027737838@s.whatsapp.net','12027737838'),true);
  for (const jid of ['1202@s.whatsapp.net','912027737838@s.whatsapp.net','12027737838@g.us','status@broadcast','12027737838@lid',null]) assert.equal(isTarget(jid,'12027737838'),false);
});
test('choice must be one of extracted labels', () => {
  assert.equal(validateAnswer({status:'answer',kind:'choice',options:['A','B'],answer:'B'}),'B');
  assert.equal(validateAnswer({status:'answer',kind:'choice',options:['A','B'],answer:'C'}),null);
  assert.equal(validateAnswer({status:'skip',answer:'A'}),null);
  assert.equal(validateAnswer({status:'answer',kind:'number',answer:'-3/4'}),'-3/4');
  assert.equal(validateAnswer({status:'answer',kind:'number',answer:'probably 4'}),null);
});
test('claims survive restart and queue serializes overlapping events', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'solver-'));
  try {
    const file=path.join(dir,'state.json'); const gate=new MessageGate(file);
    assert.equal(gate.claim('one'),true); assert.equal(new MessageGate(file).claim('one'),false);
    const order=[];
    await Promise.all([gate.enqueue(async()=>{order.push(1);await new Promise(r=>setTimeout(r,10));order.push(2)}),gate.enqueue(async()=>order.push(3))]);
    assert.deepEqual(order,[1,2,3]);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

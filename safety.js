const fs = require('node:fs');
const path = require('node:path');
function isTarget(jid, phone) {
  return typeof jid === 'string' && jid === `${phone}@s.whatsapp.net`;
}
function validateAnswer(value) {
  if (!value || value.status !== 'answer' || typeof value.answer !== 'string') return null;
  const answer = value.answer.trim();
  if (!answer || answer.length > 160 || /[\r\n]/.test(answer)) return null;
  if (value.kind === 'choice') {
    if (!Array.isArray(value.options) || !value.options.includes(answer)) return null;
    if (!/^(?:[A-Dأبجد]|[1-9])$/.test(answer)) return null;
  } else if (value.kind === 'number') {
    if (!/^-?\d+(?:\.\d+)?(?:\s*\/\s*-?\d+(?:\.\d+)?)?$/.test(answer)) return null;
  } else if (value.kind !== 'text') return null;
  return answer;
}
class MessageGate {
  constructor(file) {
    this.file = file;
    this.seen = new Set(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []);
    this.queue = Promise.resolve();
    this.pending = 0;
  }
  claim(id) {
    if (!id || this.seen.has(id)) return false;
    this.seen.add(id);
    const values = [...this.seen].slice(-10000);
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(values), { mode: 0o600 });
    fs.renameSync(`${this.file}.tmp`, this.file);
    this.seen = new Set(values);
    return true;
  }
  enqueue(fn) {
    if (this.pending >= 20) return Promise.reject(new Error('Queue full; question skipped'));
    this.pending++;
    const result = this.queue.then(fn);
    this.queue = result.catch(() => {}).finally(() => { this.pending--; });
    return result;
  }
}
module.exports = { isTarget, validateAnswer, MessageGate };

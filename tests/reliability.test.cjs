const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function harness() {
  const state = {}, events = [], sent = [], saved = [], reports = {};
  let fetches = 0, released = 0;
  const ctx = vm.createContext({
    console: {log() {}, error() {}}, Date, Set,
    Utilities: {formatDate(date, zone, format) {
      const parts = new Intl.DateTimeFormat('en-CA', {timeZone: zone,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
        hourCycle: 'h23'}).formatToParts(date);
      const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
      if (format === 'H') return p.hour;
      if (format === 'd') return p.day;
      return p.year + '-' + p.month + '-' + p.day;
    }},
    PropertiesService: {getScriptProperties: () => ({
      getProperty: k => state[k] || null,
      setProperty: (k, v) => {state[k] = v;},
      deleteProperty: k => {delete state[k];},
      getProperties: () => ({...state})
    })},
    MailApp: {getRemainingDailyQuota: () => 100, sendEmail: m => sent.push(m)},
    LockService: {getScriptLock: () => ({
      tryLock: () => true, releaseLock: () => released++
    })},
    UrlFetchApp: {fetch: () => { fetches++; return {
      getResponseCode: () => 200, getContentText: () => JSON.stringify({
        status: 'completed', id: 'r1',
        output: [{type: 'message', content: [{type: 'output_text', text: 'Report'}]}]
      })
    };}},
    logRun_: (...args) => events.push(args),
    getStoredAIReport_: key => reports[key] || null,
    saveAIReport_: r => {saved.push(r); reports[ctx.buildAIReportKey_(r)] = {status: 'OK', aiText: r.aiText};},
    buildAIReportKey_: r => r.reportType + '|' + r.date + '|SHIFT_' + r.shift
  });
  for (const file of ['Config.js', 'Utils.js', 'AIReliability.js', 'AIClient.js', 'AIAutomation.js', 'AIEmail.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx, {filename: file});
  }
  state.OPENAI_API_KEY = 'secret-test-key';
  return {ctx, state, events, sent, saved, reports, fetches: () => fetches, released: () => released};
}
function response(h, status, body) {
  let count = 0;
  h.ctx.UrlFetchApp.fetch = () => {count++; return {
    getResponseCode: () => status,
    getContentText: () => typeof body === 'string' ? body : JSON.stringify(body)
  };};
  return () => count;
}
const now = s => new Date(s);

test('successful completed response returns text and makes one request', () => {
  const h = harness();
  assert.equal(h.ctx.callOpenAI_('private instructions', 'private data').text, 'Report');
  assert.equal(h.fetches(), 1);
});
for (const [status, body, code] of [
  [401, {error: {message: 'secret-test-key'}}, 'HTTP_401'],
  [403, {error: {}}, 'HTTP_403'],
  [429, {error: {code: 'insufficient_quota'}}, 'INSUFFICIENT_QUOTA'],
  [429, {error: {}}, 'HTTP_429'],
  [500, {error: {}}, 'HTTP_500'],
  [503, '<html>secret-test-key</html>', 'INVALID_JSON'],
  [200, 'invalid', 'INVALID_JSON'],
  [200, {status: 'incomplete', output: []}, 'RESPONSE_NOT_COMPLETED'],
  [200, {status: 'failed'}, 'RESPONSE_NOT_COMPLETED'],
  [200, {status: 'completed', output: []}, 'EMPTY_RESPONSE']
]) test('API failure ' + code + ' ' + status, () => {
  const h = harness(), count = response(h, status, body);
  assert.throws(() => h.ctx.callOpenAI_('private prompt', 'private data'), {code});
  assert.throws(() => h.ctx.callOpenAI_('', ''), {code: 'API_COOLDOWN'});
  assert.equal(count(), 1);
  assert.equal(h.saved.length, 0);
  const {OPENAI_API_KEY, ...technicalState} = h.state;
  const stored = JSON.stringify([technicalState, h.events, h.sent]);
  assert.ok(!stored.includes('secret-test-key'));
  assert.ok(!JSON.stringify([h.events, h.sent]).includes('private'));
});

test('missing API key is controlled without exposing configuration', () => {
  const h = harness(); delete h.state.OPENAI_API_KEY;
  assert.throws(() => h.ctx.callOpenAI_('', ''), {code: 'TRANSPORT_OR_CONFIG'});
});
test('transport exception is sanitized', () => {
  const h = harness(); h.ctx.UrlFetchApp.fetch = () => {throw Error('Bearer SECRET');};
  assert.throws(() => h.ctx.callOpenAI_('', ''), {code: 'TRANSPORT_OR_CONFIG'});
  assert.ok(!JSON.stringify(h.events).includes('SECRET'));
});
test('administrator alert deduplicates recipients and throttles', () => {
  const h = harness(); h.state.AI_ADMIN_EMAILS = 'ADMIN@example.com;admin@example.com;bad';
  h.ctx.aiNotifyAdmin_('a', 'HTTP_401'); h.ctx.aiNotifyAdmin_('b', 'HTTP_401');
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].to, 'admin@example.com');
});
test('administrator quota shortage remains retryable', () => {
  const h = harness(); h.state.AI_ADMIN_EMAILS = 'a@example.com';
  h.ctx.MailApp.getRemainingDailyQuota = () => 0;
  h.ctx.aiNotifyAdmin_('a', 'HTTP_401');
  assert.equal(h.sent.length, 0); assert.equal(h.state.AI_ADMIN_ALERT, undefined);
});
test('ambiguous administrator delivery is not repeated', () => {
  const h = harness(); h.state.AI_ADMIN_EMAILS = 'a@example.com'; let calls = 0;
  h.ctx.MailApp.sendEmail = () => {calls++; throw Error('timeout');};
  h.ctx.aiNotifyAdmin_('a', 'HTTP_401'); h.ctx.aiNotifyAdmin_('a', 'HTTP_401');
  assert.equal(calls, 1);
});

test('daily recovery includes previous seven dates and only due shifts', () => {
  const h = harness();
  const targets = h.ctx.getDueDailyReportTargets_(now('2026-11-26T04:59:00Z'));
  assert.equal(targets[0].date, '2026-11-19');
  assert.ok(!targets.some(t => t.date < '2026-11-19'));
  assert.ok(!targets.some(t => t.date === '2026-11-25' && t.shift === 2));
  assert.ok(!targets.some(t => t.date === '2026-11-26'));
});
test('07:00 and 17:00 Kyiv boundaries', () => {
  const h = harness();
  assert.ok(h.ctx.getDueDailyReportTargets_(now('2026-11-26T05:00:00Z')).some(t => t.date === '2026-11-25' && t.shift === 2));
  assert.ok(!h.ctx.getDueDailyReportTargets_(now('2026-11-26T14:59:00Z')).some(t => t.date === '2026-11-26'));
  assert.ok(h.ctx.getDueDailyReportTargets_(now('2026-11-26T15:00:00Z')).some(t => t.date === '2026-11-26' && t.shift === 1));
});
test('DST boundary uses calendar dates', () => {
  const h = harness();
  const t = h.ctx.getDueDailyReportTargets_(now('2026-10-25T05:00:00Z'));
  assert.equal(t[0].date, '2026-10-18');
  assert.equal(new Set(t.map(t => t.date + '|' + t.shift)).size, t.length);
});
test('weekly boundary and monthly catch-up use due dates', () => {
  const h = harness();
  assert.equal(h.ctx.getDueWeeklyReportTarget_(now('2026-11-28T14:59:00Z')).to, '2026-11-21');
  assert.equal(h.ctx.getDueWeeklyReportTarget_(now('2026-11-28T15:00:00Z')).to, '2026-11-28');
  const targets = h.ctx.aiRecoveryTargets_(now('2026-12-07T10:00:00Z'), false);
  assert.ok(targets.some(t => t.key === 'MONTHLY|2026-11-01|2026-11-30'));
  assert.ok(!h.ctx.aiRecoveryTargets_(now('2026-12-09T10:00:00Z'), false).some(t => t.key.startsWith('MONTHLY')));
  assert.equal(h.ctx.getDueMonthlyReportTarget_(now('2026-12-01T05:59:00Z')), null);
});
test('success skips API and failed or empty stored rows remain recoverable', () => {
  const h = harness();
  h.reports.a = {status: 'OK', aiText: 'done', emailStatus: 'SENT'};
  h.reports.b = {status: 'ERROR', aiText: ''};
  assert.equal(h.ctx.aiRunTarget_('a', () => {throw Error('must not call');}), false);
  assert.equal(h.ctx.aiReportExists_('b'), false);
  h.reports.b.status = 'OK'; assert.equal(h.ctx.aiReportExists_('b'), false);
});
test('empty source does not create a report', () => {
  const h = harness();
  assert.equal(h.ctx.aiRunTarget_('a', () => null), false);
  assert.equal(h.saved.length, 0);
});
test('failed report has backoff surviving a new invocation', () => {
  const h = harness(); let calls = 0;
  const build = () => {calls++; throw Error('sensitive details');};
  assert.equal(h.ctx.aiRunTarget_('a', build), true);
  assert.equal(h.ctx.aiRunTarget_('a', build), false);
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(h.events).includes('sensitive'));
});
test('saved report clears retry state and is not duplicated', () => {
  const h = harness(), key = 'DAILY|2026-11-25|SHIFT_1';
  h.state['AI_RETRY|' + key] = JSON.stringify({attempts: 2, nextAt: 1});
  const build = () => ({reportType: 'DAILY', date: '2026-11-25', shift: 1, aiText: 'valid'});
  h.ctx.aiRunTarget_(key, build); h.ctx.aiRunTarget_(key, build);
  assert.equal(h.saved.length, 1); assert.equal(h.state['AI_RETRY|' + key], undefined);
});
test('mismatched key is rejected before saving', () => {
  const h = harness();
  h.ctx.aiRunTarget_('expected', () => ({reportType: 'DAILY', date: 'x', shift: 1, aiText: 'text'}));
  assert.equal(h.saved.length, 0);
});
test('scheduler locks are released on failure and denied locks do no work', () => {
  const h = harness();
  assert.throws(() => h.ctx.aiWithSchedulerLock_(() => {throw Error('failure');}));
  assert.equal(h.released(), 1);
  h.ctx.LockService.getScriptLock = () => ({tryLock: () => false});
  h.ctx.aiWithSchedulerLock_(() => {throw Error('must not run');});
});
for (const status of ['SENT', 'SENDING', 'REVIEW', 'ERROR']) {
  test('email status ' + status + ' prevents automatic resend', () => {
    const h = harness(); h.reports.a = {emailStatus: status, status: 'OK', aiText: 'text'};
    h.ctx.sendStoredAIReportEmail_('a'); assert.equal(h.sent.length, 0);
  });
}
test('email is reserved before send and ambiguous failure becomes REVIEW', () => {
  const h = harness(); h.state.AI_REPORT_EMAILS = 'a@example.com';
  h.reports.a = {row: 2, status: 'OK', aiText: 'text', emailStatus: 'PENDING'};
  h.ctx.setAIReportEmailStatus_ = (r, status) => {h.reports.a.emailStatus = status;};
  let calls = 0;
  h.ctx.MailApp.sendEmail = () => {
    assert.equal(h.reports.a.emailStatus, 'SENDING');
    calls++; throw Error('timeout');
  };
  assert.throws(() => h.ctx.sendStoredAIReportEmail_('a'));
  assert.equal(h.reports.a.emailStatus, 'REVIEW');
  h.ctx.sendStoredAIReportEmail_('a'); assert.equal(calls, 1);
});
test('automatic recovery limits work per execution', () => {
  const h = harness(); let count = 0;
  h.ctx.aiRecoveryTargets_ = () => Array.from({length: 10}, (_, i) => ({key: String(i), build() {}}));
  h.ctx.aiRunTarget_ = () => {count++; return true;};
  h.ctx.aiRunRecovery_(false); assert.equal(count, 2);
});
test('all repository JavaScript files parse in Apps Script V8 syntax', () => {
  for (const file of fs.readdirSync(root).filter(f => f.endsWith('.js'))) {
    new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), {filename: file});
  }
});

test('real store refuses changed headers without writing', () => {
  const h = harness(); let writes = 0;
  vm.runInContext(fs.readFileSync(path.join(root, 'AIReportStore.js'), 'utf8'), h.ctx);
  const sheet = {getLastRow: () => 3, getRange: () => ({
    getValue: () => 'createdAt', getValues: () => [['createdAt', 'moved column']],
    setValues: () => writes++
  })};
  assert.throws(() => h.ctx.ensureAIReportHeaders_(sheet), {code: 'REPORT_HEADERS_CHANGED'});
  assert.equal(writes, 0);
});
test('real source reader refuses changed headers before reading tasks', () => {
  const h = harness(); let reads = 0;
  vm.runInContext(fs.readFileSync(path.join(root, 'DataReader.js'), 'utf8'), h.ctx);
  h.ctx.getSourceSheet_ = () => ({getLastRow: () => 100,
    getRange: () => {reads++; return {getValues: () => [['wrong headers']]};}});
  assert.throws(() => h.ctx.readRawTaskRows_(), {code: 'SOURCE_HEADERS_CHANGED'});
  assert.equal(reads, 1);
});
test('real report store preserves SENT history when recovering an existing row', () => {
  const h = harness();
  vm.runInContext(fs.readFileSync(path.join(root, 'AIReportStore.js'), 'utf8'), h.ctx);
  const old = Array(20).fill('');
  old[0] = 'created'; old[17] = 'SENT'; old[18] = 'sent-date'; old[19] = 'a@example.com';
  let written;
  const sheet = {getRange: () => ({
    getValues: () => [old], setValues: v => {written = v[0];},
    setWrap() {return this;}, setVerticalAlignment() {return this;}
  })};
  h.ctx.getOrCreateAIReportSheet_ = () => sheet;
  h.ctx.findAIReportRow_ = () => 2;
  h.ctx.refreshAIDashboard_ = () => {};
  h.ctx.saveAIReport_({reportType: 'DAILY', date: '2026-11-25', shift: 1, aiText: 'recovered'});
  assert.equal(written[0], 'created');
  assert.deepEqual(Array.from(written.slice(17)), ['SENT', 'sent-date', 'a@example.com']);
  assert.equal(written[16], 'OK');
});
test('actual recovery does not call AI for empty source or already saved reports', () => {
  const h = harness(); let calls = 0;
  h.ctx.buildDailyReportPackage_ = () => ({press: {summary: {}}, cnc: {summary: {}}});
  h.ctx.analyzeDailyReportPackage_ = () => {calls++; throw Error('must not call');};
  h.ctx.aiRunRecovery_(true);
  assert.equal(calls, 0); assert.equal(h.saved.length, 0);
});

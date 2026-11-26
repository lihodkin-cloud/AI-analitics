// Persistent retry state contains technical metadata only; never API bodies or prompts.
function aiReliabilityConfig_() {
  return { retryMs: 30 * 60000, maxRetryMs: 6 * 3600000,
    alertMs: 6 * 3600000, maxReports: 2, budgetMs: 210000 };
}

function aiReadState_(key) {
  const raw = PropertiesService.getScriptProperties().getProperty(key);
  return raw ? JSON.parse(raw) : {};
}

function aiWriteState_(key, state) {
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(state));
}

function aiTechnicalEvent_(key, status, details) {
  logRun_('AI_CONTROL', key, null, status === 'ERROR' ? 1 : 0,
    status, 0, JSON.stringify(details || {}));
}

function aiFailure_(code, retryable, httpStatus) {
  const err = new Error('AI request failed: ' + code);
  err.code = code;
  err.retryable = retryable;
  err.httpStatus = httpStatus || 0;
  return err;
}

function aiNotifyAdmin_(key, code) {
  const props = PropertiesService.getScriptProperties();
  const recipients = [...new Set((props.getProperty('AI_ADMIN_EMAILS') || '')
    .split(/[;,]/).map(s => s.trim().toLowerCase())
    .filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)))];
  if (!recipients.length) {
    aiTechnicalEvent_(key, 'ADMIN_NOT_CONFIGURED', {code: code});
    return;
  }
  const stateKey = 'AI_ADMIN_ALERT';
  const state = aiReadState_(stateKey);
  const now = Date.now();
  if (now < (state.nextAt || 0)) return;
  if (MailApp.getRemainingDailyQuota() < recipients.length) {
    aiTechnicalEvent_(key, 'ADMIN_WAITING_QUOTA', {code: code});
    return;
  }
  // Reserve before sending: an ambiguous MailApp failure must not spam administrators.
  aiWriteState_(stateKey, {nextAt: now + aiReliabilityConfig_().alertMs});
  try {
    MailApp.sendEmail({to: recipients.join(','), subject: 'ГКД: збій AI-аналітика',
      body: 'Ключ: ' + key + '\nКод: ' + code +
        '\nЧас: ' + Utilities.formatDate(new Date(), CFG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss') +
        '\nДеталі: AI_LOG. Відновлення буде повторено після паузи.'});
    aiTechnicalEvent_(key, 'ADMIN_SENT', {code: code});
  } catch (err) {
    aiTechnicalEvent_(key, 'ADMIN_REVIEW', {code: code});
  }
}

function aiRecordFailure_(key, err) {
  const cfg = aiReliabilityConfig_();
  const stateKey = 'AI_RETRY|' + key;
  const previous = aiReadState_(stateKey);
  const attempts = (previous.attempts || 0) + 1;
  const delay = Math.min(cfg.maxRetryMs, cfg.retryMs * Math.pow(2, Math.min(attempts - 1, 8)));
  const state = {attempts: attempts, nextAt: Date.now() + delay,
    code: err.code || 'REPORT_FAILED'};
  aiWriteState_(stateKey, state);
  aiTechnicalEvent_(key, 'ERROR', state);
  aiNotifyAdmin_(key, state.code);
}

function aiRunTarget_(key, buildResult) {
  if (aiReportExists_(key)) return false;
  const state = aiReadState_('AI_RETRY|' + key);
  if (Date.now() < (state.nextAt || 0)) return false;
  const circuit = aiReadState_('AI_API_CIRCUIT');
  if (Date.now() < (circuit.nextAt || 0)) return false;
  try {
    const result = buildResult();
    if (!result) return false;
    if (buildAIReportKey_(result) !== key || !String(result.aiText || '').trim()) {
      throw aiFailure_('INVALID_REPORT', false);
    }
    saveAIReport_(result);
    PropertiesService.getScriptProperties().deleteProperty('AI_RETRY|' + key);
    aiTechnicalEvent_(key, 'SAVED', {});
  } catch (err) {
    aiRecordFailure_(key, err);
  }
  return true;
}

function aiWithSchedulerLock_(work) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try { work(); }
  catch (err) { aiRecordFailure_('SCHEDULER', err); throw err; }
  finally { lock.releaseLock(); }
}

// Only old retry entries are pruned; the seven-day scan rechecks late source data.
function aiPruneRetryState_() {
  const props = PropertiesService.getScriptProperties();
  const now = Date.now();
  const entries = props.getProperties();
  Object.keys(entries).filter(k => k.indexOf('AI_RETRY|') === 0).forEach(k => {
    const state = JSON.parse(entries[k]);
    if (now - (state.nextAt || now) > 8 * 86400000) props.deleteProperty(k);
  });
}


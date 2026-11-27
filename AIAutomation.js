// All automatic entry points share one script lock, including weekly/monthly and email.
function aiReportExists_(key) {
  const report = getStoredAIReport_(key);
  return !!(report && report.status === 'OK' && String(report.aiText || '').trim());
}

function getDueDailyReportTargets_(now) {
  now = now || new Date();
  const today = Utilities.formatDate(now, CFG.TIMEZONE, 'yyyy-MM-dd');
  const hour = Number(Utilities.formatDate(now, CFG.TIMEZONE, 'H'));
  const targets = [];
  for (let days = 7; days >= 0; days--) {
    const date = addDaysToDateKey_(today, -days);
    if (days > 0 || hour >= 17) targets.push({date: date, shift: 1, scheduledTime: '17:00', catchUp: days > 0});
    if (days > 1 || (days === 1 && hour >= 7)) targets.push({date: date, shift: 2, scheduledTime: '07:00', catchUp: days > 1});
  }
  return targets;
}

function aiWithinRecoveryWindow_(dueDate, now) {
  const today = Utilities.formatDate(now, CFG.TIMEZONE, 'yyyy-MM-dd');
  return dueDate >= addDaysToDateKey_(today, -7) && dueDate <= today;
}

function aiRecoveryTargets_(now, dailyOnly) {
  const targets = getDueDailyReportTargets_(now).map(t => ({
    key: buildDailyAutomationKey_(t.date, t.shift),
    build: function() {
      // Empty date/shift pairs need no full metrics or traceability computation.
      if (!aiSourceHasTarget_(t.date, t.shift)) return null;
      const pkg = buildDailyReportPackage_(t.date, t.shift);
      if (!isDailyReportReady_(pkg)) return null;
      if (!aiHasTime_(60000)) return null;
      return analyzeDailyReportPackage_(pkg);
    }
  }));
  if (dailyOnly) return targets;
  const weekly = getDueWeeklyReportTarget_(now);
  if (weekly.from >= CFG.AI.FIRST_AUTO_WEEK && aiWithinRecoveryWindow_(weekly.to, now)) {
    targets.push({key: buildWeeklyAutomationKey_(weekly),
      build: function() { return analyzeWeeklyReport_(weekly.anchorDate); }});
  }
  const monthly = getDueMonthlyReportTarget_(now);
  if (monthly && monthly.from >= CFG.AI.FIRST_AUTO_MONTH &&
      aiWithinRecoveryWindow_(addDaysToDateKey_(monthly.to, 1), now)) {
    targets.push({key: buildMonthlyAutomationKey_(monthly),
      build: function() { return analyzeMonthlyReport_(monthly.anchorDate); }});
  }
  return targets;
}

function aiSourceHasTarget_(date, shift) {
  let index = AI_RUN_CONTEXT_ && AI_RUN_CONTEXT_.sourceTargets;
  if (!index) {
    index = new Set(readRawTaskRows_().map(r => r.dateKey + '|' + r.shift));
    if (AI_RUN_CONTEXT_) AI_RUN_CONTEXT_.sourceTargets = index;
  }
  return index.has(date + '|' + shift);
}

function aiRunRecovery_(dailyOnly) {
  const started = Date.now();
  const cfg = aiReliabilityConfig_();
  let attempted = 0;
  aiPruneRetryState_();
  const targets = aiRecoveryTargets_(new Date(), dailyOnly);
  for (const target of targets) {
    if (attempted >= cfg.maxReports || Date.now() - started >= cfg.budgetMs || !aiHasTime_(60000)) break;
    if (aiRunTarget_(target.key, target.build)) attempted++;
  }
  aiTechnicalEvent_('SCHEDULER', 'FINISHED', {attempted: attempted, scanned: targets.length});
}

function runDailyAIScheduler() {
  aiWithSchedulerLock_(function() { aiRunRecovery_(true); });
}

// Compatibility entry points use the same lock and recovery window.
function runWeeklyAIScheduler_() {
  aiRunPeriodRecovery_('WEEKLY|');
}

function runMonthlyAIScheduler_() {
  aiRunPeriodRecovery_('MONTHLY|');
}

function aiRunPeriodRecovery_(prefix) {
  aiWithSchedulerLock_(function() {
    aiRecoveryTargets_(new Date(), false).filter(t => t.key.indexOf(prefix) === 0)
      .forEach(t => aiRunTarget_(t.key, t.build));
  });
}

function installDailyAISchedulerTrigger() {
  installAISchedulerTrigger();
}

function testPeriodAISchedulerStatus() {
  aiRecoveryTargets_(new Date(), false).filter(t => t.key.indexOf('DAILY|') !== 0)
    .forEach(t => console.log(t.key));
}

function runAIScheduler() {
  aiWithSchedulerLock_(function() {
    // Drain existing mail first; generation and sending use separate executions.
    let delivery;
    try { delivery = deliverPendingAIReportEmailsUnlocked_(); }
    catch (err) { aiRecordFailure_('EMAIL_DELIVERY', err); return; }
    if (delivery && delivery.attempted > 0 && !delivery.waitingQuota) {
      aiTechnicalEvent_('SCHEDULER', 'EMAIL_PHASE_FINISHED', delivery);
      return;
    }
    aiRunRecovery_(false);
  });
}

function testDailyAISchedulerStatus() {
  getDueDailyReportTargets_(new Date()).forEach(t => console.log(
    buildDailyAutomationKey_(t.date, t.shift)));
}

function buildDailyAutomationKey_(
  date,
  shift
) {

  return (
    'DAILY|' +
    date +
    '|SHIFT_' +
    shift
  );
}

function isDailyReportReady_(
  reportPackage
) {

  const press =
    reportPackage.press.summary;


  const cnc =
    reportPackage.cnc.summary;


  const rows =
    (press.productionRows || 0) +
    (press.auxiliaryRows || 0) +
    (cnc.productionRows || 0) +
    (cnc.auxiliaryRows || 0);


  return rows > 0;
}

function getDueWeeklyReportTarget_(
  now
) {

  now =
    now || new Date();


  const today =
    Utilities.formatDate(
      now,
      CFG.TIMEZONE,
      'yyyy-MM-dd'
    );


  const hour =
    Number(
      Utilities.formatDate(
        now,
        CFG.TIMEZONE,
        'H'
      )
    );


  const todayDate =
    dateKeyToUtcNoon_(
      today
    );


  const day =
    todayDate.getUTCDay();


  /*
   * Скільки днів минуло
   * від останньої суботи.
   */

  let daysSinceSaturday =
    (day - 6 + 7) % 7;


  /*
   * Якщо сьогодні субота,
   * але ще немає 17:00,
   * поточний тижневий звіт
   * ще не настав.
   *
   * Беремо попередню суботу.
   */

  if (
    day === 6 &&
    hour < 17
  ) {

    daysSinceSaturday =
      7;
  }


  const saturday =
    addDaysToDateKey_(
      today,
      -daysSinceSaturday
    );


  const monday =
    addDaysToDateKey_(
      saturday,
      -5
    );


  return {

    anchorDate:
      saturday,

    from:
      monday,

    to:
      saturday,

    scheduledTime:
      'SATURDAY 17:00'

  };
}

function buildWeeklyAutomationKey_(
  target
) {

  return (
    'WEEKLY|' +
    target.from +
    '|' +
    target.to
  );
}

function getDueMonthlyReportTarget_(
  now
) {

  now =
    now || new Date();


  const today =
    Utilities.formatDate(
      now,
      CFG.TIMEZONE,
      'yyyy-MM-dd'
    );


  const dayOfMonth =
    Number(
      Utilities.formatDate(
        now,
        CFG.TIMEZONE,
        'd'
      )
    );


  const hour =
    Number(
      Utilities.formatDate(
        now,
        CFG.TIMEZONE,
        'H'
      )
    );


  /*
   * До 08:00 першого числа
   * звіт за попередній місяць
   * ще не настав.
   */

  if (
    dayOfMonth === 1 &&
    hour < 8
  ) {

    return null;
  }


  /*
   * Останній день
   * попереднього місяця.
   */

  const previousMonthDate =
    addDaysToDateKey_(
      today,
      -dayOfMonth
    );


  const range =
    getMonthRange_(
      previousMonthDate
    );


  return {

    anchorDate:
      previousMonthDate,

    from:
      range.from,

    to:
      range.to,

    scheduledTime:
      'DAY 1 08:00'

  };
}

function buildMonthlyAutomationKey_(
  target
) {

  return (
    'MONTHLY|' +
    target.from +
    '|' +
    target.to
  );
}

function installAISchedulerTrigger() {

  const handlers = [

    'runDailyAIScheduler',
    'runAIScheduler',
    'runAIDashboardRefresh'

  ];


  /*
   * Видаляємо старий
   * денний scheduler
   * та можливий старий master.
   */

  ScriptApp
    .getProjectTriggers()
    .forEach(
      trigger => {

        if (
          handlers.includes(
            trigger
              .getHandlerFunction()
          )
        ) {

          ScriptApp.deleteTrigger(
            trigger
          );
        }

      }
    );


  ScriptApp
    .newTrigger(
      'runAIScheduler'
    )
    .timeBased()
    .everyMinutes(
      CFG.AI
        .SCHEDULER_MINUTES
    )
    .create();

  ScriptApp.newTrigger('runAIDashboardRefresh').timeBased().everyMinutes(10).create();


  console.log(
    'Master AI Scheduler встановлено.'
  );


  console.log(
    'Інтервал: ' +
    CFG.AI.SCHEDULER_MINUTES +
    ' хв.'
  );
}
function removeDailyAISchedulerTrigger() {

  const handler =
    'runDailyAIScheduler';


  let removed = 0;


  ScriptApp
    .getProjectTriggers()
    .forEach(
      trigger => {

        if (
          trigger
            .getHandlerFunction() ===
          handler
        ) {

          ScriptApp.deleteTrigger(
            trigger
          );

          removed++;
        }

      }
    );


  console.log(
    'Видалено тригерів: ' +
    removed
  );
}

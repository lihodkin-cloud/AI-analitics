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

function aiReportExists_(
  reportKey
) {

  const sheet =
    getOrCreateAIReportSheet_();


  return (
    findAIReportRow_(
      sheet,
      reportKey
    ) !== null
  );
}

function getDueDailyReportTargets_(
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


  const yesterday =
    addDaysToDateKey_(
      today,
      -1
    );


  const dayBeforeYesterday =
    addDaysToDateKey_(
      today,
      -2
    );


  const targets = [];


  /*
   * 1 зміна вчорашнього дня
   * вже точно мала бути
   * сформована о 17:00.
   *
   * Це catch-up на випадок,
   * якщо дані внесли із запізненням.
   */

  targets.push({

    date:
      yesterday,

    shift:
      1,

    scheduledTime:
      '17:00',

    catchUp:
      true

  });


  /*
   * Остання друга зміна,
   * час якої вже настав.
   */

  if (
    hour >= 7
  ) {

    targets.push({

      date:
        yesterday,

      shift:
        2,

      scheduledTime:
        '08:00',

      catchUp:
        false

    });

  } else {

    /*
     * До 08:00 друга зміна
     * вчорашнього дня ще
     * формально не закрита.
     *
     * Перевіряємо попередню.
     */

    targets.push({

      date:
        dayBeforeYesterday,

      shift:
        2,

      scheduledTime:
        '07:00',

      catchUp:
        true

    });

  }


  /*
   * Сьогоднішня 1 зміна
   * після 17:00.
   */

  if (
    hour >= 17
  ) {

    targets.push({

      date:
        today,

      shift:
        1,

      scheduledTime:
        '17:00',

      catchUp:
        false

    });

  }


  /*
   * Захист від випадкового
   * дублювання цілей.
   */

  const seen =
    new Set();


  return targets.filter(
    target => {

      const key =
        target.date +
        '|' +
        target.shift;


      if (
        seen.has(key)
      ) {
        return false;
      }


      seen.add(key);

      return true;
    }
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

function runDailyAIScheduler() {

  /*
   * Захист від двох
   * одночасних запусків.
   */

  const lock =
    LockService
      .getScriptLock();


  if (
    !lock.tryLock(
      5000
    )
  ) {

    console.log(
      'AI Scheduler: інший запуск уже виконується.'
    );

    return;
  }


  try {

    const now =
      new Date();


    const nowText =
      Utilities.formatDate(
        now,
        CFG.TIMEZONE,
        'yyyy-MM-dd HH:mm:ss'
      );


    console.log(
      'AI Scheduler: ' +
      nowText
    );


    const targets =
      getDueDailyReportTargets_(
        now
      );


    if (
      targets.length === 0
    ) {

      console.log(
        'Зараз немає звітів, час яких уже настав.'
      );

      return;
    }


    targets.forEach(
      target => {

        const reportKey =
          buildDailyAutomationKey_(
            target.date,
            target.shift
          );


        /*
         * Звіт уже є.
         *
         * OpenAI НЕ викликаємо.
         */

        if (
          aiReportExists_(
            reportKey
          )
        ) {

          console.log(
            reportKey +
            ' — вже існує. Пропускаємо.'
          );

          return;
        }


        try {

          console.log(
            reportKey +
            ' — перевірка даних...'
          );


          /*
           * Спочатку лише
           * детермінований аналіз.
           */

          const reportPackage =
            buildDailyReportPackage_(
              target.date,
              target.shift
            );


          /*
           * Даних ще немає.
           *
           * Не викликаємо AI.
           */

          if (
            !isDailyReportReady_(
              reportPackage
            )
          ) {

            console.log(
              reportKey +
              ' — дані ще не готові.'
            );

            return;
          }


          console.log(
            reportKey +
            ' — запускаємо AI.'
          );


          const result =
            analyzeDailyReportPackage_(
              reportPackage
            );


          const storage =
            saveAIReport_(
              result
            );


          console.log(
            reportKey +
            ' — успішно збережено. ' +
            'Рядок: ' +
            storage.row
          );


        } catch (err) {

          /*
           * Помилка одного звіту
           * не повинна зупиняти
           * scheduler повністю.
           *
           * Наступний запуск через
           * 10 хв спробує знову,
           * оскільки reportKey
           * ще не існуватиме.
           */

          console.error(
            reportKey +
            ' — ПОМИЛКА: ' +
            err.message
          );

        }

      }
    );


  } finally {

    lock.releaseLock();

  }
}

function testDailyAISchedulerStatus() {

  const now =
    new Date();


  const nowText =
    Utilities.formatDate(
      now,
      CFG.TIMEZONE,
      'yyyy-MM-dd HH:mm:ss'
    );


  console.log(
    '=============================='
  );

  console.log(
    'AI SCHEDULER TEST'
  );

  console.log(
    'Київський час: ' +
    nowText
  );

  console.log(
    '=============================='
  );


  const targets =
    getDueDailyReportTargets_(
      now
    );


  if (
    targets.length === 0
  ) {

    console.log(
      'Зараз звіт не запланований.'
    );

    return;
  }


  targets.forEach(
    target => {

      const reportKey =
        buildDailyAutomationKey_(
          target.date,
          target.shift
        );


      const exists =
        aiReportExists_(
          reportKey
        );


      console.log(
        reportKey +
        ' | час: ' +
        target.scheduledTime +
        ' | ' +
        (
          exists
            ? 'ВЖЕ ІСНУЄ'
            : 'ПОТРІБНО СТВОРИТИ'
        )
      );

    }
  );
}

function installDailyAISchedulerTrigger() {

  const handler =
    'runDailyAIScheduler';


  /*
   * Спочатку видаляємо
   * старі тригери цієї функції.
   *
   * Таким чином випадково
   * не створимо два scheduler.
   */

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
        }

      }
    );


  ScriptApp
    .newTrigger(
      handler
    )
    .timeBased()
    .everyMinutes(
      CFG.AI
        .SCHEDULER_MINUTES
    )
    .create();


  console.log(
    'AI Scheduler встановлено: ' +
    'кожні ' +
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

function runWeeklyAIScheduler_() {

  const target =
    getDueWeeklyReportTarget_(
      new Date()
    );

  if (
    target.from <
    CFG.AI.FIRST_AUTO_WEEK
  ) {

    console.log(
      'WEEKLY: історичний період ' +
      target.from +
      ' — ' +
      target.to +
      ' пропускаємо.'
    );

  return;
}


  const reportKey =
    buildWeeklyAutomationKey_(
      target
    );


  if (
    aiReportExists_(
      reportKey
    )
  ) {

    console.log(
      reportKey +
      ' — вже існує.'
    );

    return;
  }


  console.log(
    reportKey +
    ' — запускаємо тижневий AI-аналіз.'
  );


  const result =
    analyzeWeeklyReport_(
      target.anchorDate
    );


  const storage =
    saveAIReport_(
      result
    );


  console.log(
    reportKey +
    ' — збережено. Рядок: ' +
    storage.row
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

function runMonthlyAIScheduler_() {

  const target =
    getDueMonthlyReportTarget_(
      new Date()
    );


  if (!target) {

    console.log(
      'Місячний звіт ще не настав.'
    );

    return;
  }

  if (
    target.from <
    CFG.AI.FIRST_AUTO_MONTH
  ) {

    console.log(
      'MONTHLY: історичний період ' +
      target.from +
      ' — ' +
      target.to +
      ' пропускаємо.'
    );

  return;
}

  const reportKey =
    buildMonthlyAutomationKey_(
      target
    );


  if (
    aiReportExists_(
      reportKey
    )
  ) {

    console.log(
      reportKey +
      ' — вже існує.'
    );

    return;
  }


  console.log(
    reportKey +
    ' — запускаємо місячний AI-аналіз.'
  );


  const result =
    analyzeMonthlyReport_(
      target.anchorDate
    );


  const storage =
    saveAIReport_(
      result
    );


  console.log(
    reportKey +
    ' — збережено. Рядок: ' +
    storage.row
  );
}

function runAIScheduler() {

  console.log(
    '=============================='
  );

  console.log(
    'AI MASTER SCHEDULER'
  );

  console.log(
    Utilities.formatDate(
      new Date(),
      CFG.TIMEZONE,
      'yyyy-MM-dd HH:mm:ss'
    )
  );

  console.log(
    '=============================='
  );


  /*
   * Денний scheduler уже
   * має власний LockService.
   */

  runDailyAIScheduler();


  try {

    runWeeklyAIScheduler_();

  } catch (err) {

    console.error(
      'WEEKLY ERROR: ' +
      err.message
    );
  }


  try {

    runMonthlyAIScheduler_();

  } catch (err) {

    console.error(
      'MONTHLY ERROR: ' +
      err.message
    );
  }

  try {

    deliverPendingAIReportEmails_();

  } catch (err) {

    console.error(
      'EMAIL DELIVERY ERROR: ' +
      err.message
    );
  }
}

function testPeriodAISchedulerStatus() {

  const now =
    new Date();


  console.log(
    'Київський час: ' +
    Utilities.formatDate(
      now,
      CFG.TIMEZONE,
      'yyyy-MM-dd HH:mm:ss'
    )
  );


  /*
   * ==========================
   * WEEKLY
   * ==========================
   */

  const weekly =
    getDueWeeklyReportTarget_(
      now
    );


  if (
    weekly.from <
    CFG.AI.FIRST_AUTO_WEEK
  ) {

    console.log(
      'WEEKLY: ще не настав час ' +
      'першого автоматичного тижневого звіту.'
    );

    console.log(
      'Перший автоматичний період: ' +
      CFG.AI.FIRST_AUTO_WEEK +
      ' — ' +
      addDaysToDateKey_(
        CFG.AI.FIRST_AUTO_WEEK,
        5
      )
    );

  } else {

    const weeklyKey =
      buildWeeklyAutomationKey_(
        weekly
      );


    console.log(
      'WEEKLY: ' +
      weeklyKey +
      ' | ' +
      (
        aiReportExists_(
          weeklyKey
        )
          ? 'ВЖЕ ІСНУЄ'
          : 'ПОТРІБНО СТВОРИТИ'
      )
    );
  }


  /*
   * ==========================
   * MONTHLY
   * ==========================
   */

  const monthly =
    getDueMonthlyReportTarget_(
      now
    );


  if (!monthly) {

    console.log(
      'MONTHLY: час ще не настав.'
    );

  } else if (
    monthly.from <
    CFG.AI.FIRST_AUTO_MONTH
  ) {

    const firstRange =
      getMonthRange_(
        CFG.AI.FIRST_AUTO_MONTH
      );


    console.log(
      'MONTHLY: ще не настав час ' +
      'першого автоматичного місячного звіту.'
    );

    console.log(
      'Перший автоматичний період: ' +
      firstRange.from +
      ' — ' +
      firstRange.to
    );

  } else {

    const monthlyKey =
      buildMonthlyAutomationKey_(
        monthly
      );


    console.log(
      'MONTHLY: ' +
      monthlyKey +
      ' | ' +
      (
        aiReportExists_(
          monthlyKey
        )
          ? 'ВЖЕ ІСНУЄ'
          : 'ПОТРІБНО СТВОРИТИ'
      )
    );
  }
}


function installAISchedulerTrigger() {

  const handlers = [

    'runDailyAIScheduler',
    'runAIScheduler'

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


  console.log(
    'Master AI Scheduler встановлено.'
  );


  console.log(
    'Інтервал: ' +
    CFG.AI.SCHEDULER_MINUTES +
    ' хв.'
  );
}
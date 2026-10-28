
const AI5 = {
  REPORT: 'AI_ORDERS_TEST',
  STATE: 'AI_ORDER_STATE',
  LOG: 'AI_EMAIL_LOG',
  PREVIEW: 'AI_EMAIL_PREVIEW',

  EMAIL: 'lihodkin@gmail.com, nadiy.choban@gmail.com, sergiy.odarych@gmail.com',   // Email відповідального
  SEND_EMAIL: true,        // Увімкнемо надсилання
  TIMEZONE: 'Europe/Kyiv'
};

const AI5_STATE_HEADERS = [
  'Замовлення', 'Статус', 'Клієнт', 'Дата перевірки'
];

const AI5_LOG_HEADERS = [
  'Дата', 'Замовлення', 'Клієнт', 'Адресат',
  'Статус відправлення', 'Зауважень', 'Примітка'
];



function ai5Recipients_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('AI_SETTINGS');

  if (!sheet) {
    throw new Error('Аркуш AI_SETTINGS не знайдено');
  }

  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    throw new Error('Не задано отримувачів email');
  }

  // A — email, B — прапорець, C — роль
  const data = sheet.getRange(
    2, 1, lastRow - 1, 3
  ).getValues();

  const emails = [];

  for (let i = 0; i < data.length; i++) {
    const email = String(data[i][0] || '')
      .trim().toLowerCase();

    const enabled = data[i][1] === true;

    if (!enabled) continue;

    if (!email ||
        !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) {
      throw new Error(
        'Некоректна email-адреса в AI_SETTINGS, рядок ' +
        (i + 2)
      );
    }

    emails.push(email);
  }

  const unique = [...new Set(emails)];

  if (unique.length === 0) {
    throw new Error(
      'Немає активних отримувачів у AI_SETTINGS'
    );
  }

  return unique;
}



// Читання готового звіту V4
function ai5ReadOrders_(ss) {
  const sheet = ss.getSheetByName(AI5.REPORT);
  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('Немає звіту V4');
  }

  const data = sheet.getDataRange().getDisplayValues();
  if (data[0][0] !== 'Замовлення' ||
      data[0][5] !== 'Статус') {
    throw new Error('Змінилась структура звіту V4');
  }

  return data.slice(1)
    .filter(r => String(r[0]).trim())
    .map(r => {
      const status = String(r[5] || '').trim();
      const total = Number(r[2]);
      const done = Number(r[3]);

      const ready = (
        status === 'Готове до відвантаження' ||
        status === 'Готове до відвантаження (є зауваження)'
      ) && total > 0 && done === total;

      return {
        id: String(r[0]).trim(),
        client: String(r[1] || ''),
        total,
        done,
        ready,
        warnings: Number(r[6]) || 0,
        notes: String(r[7] || '')
      };
    });
}

// Створення службового аркуша
function ai5Sheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) ||
    ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers]);

    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#D9EAD3');
  } else {
    const existing = sheet.getRange(
      1, 1, 1, headers.length
    ).getDisplayValues()[0];

    if (existing.join('|') !== headers.join('|')) {
      throw new Error('Невірні заголовки: ' + name);
    }
  }

  return sheet;
}

function ai5EnsureRows_(sheet, needed) {
  if (sheet.getMaxRows() < needed) {
    sheet.insertRowsAfter(
      sheet.getMaxRows(),
      needed - sheet.getMaxRows()
    );
  }
}

// Попередні статуси
function ai5ReadState_(sheet) {
  const map = new Map();
  const last = sheet.getLastRow();
  if (last < 2) return map;

  const rows = sheet.getRange(
    2, 1, last - 1, 4
  ).getDisplayValues();

  for (const r of rows) {
    if (r[0]) {
      map.set(String(r[0]), {
        status: String(r[1]),
        client: String(r[2] || '')
      });
    }
  }

  return map;
}

function ai5SaveState_(sheet, map) {
  const rows = [...map.entries()].map(([id, v]) => [
    id, v.status, v.client, new Date()
  ]);

  const oldLast = sheet.getLastRow();
  if (oldLast > 1) {
    sheet.getRange(2, 1, oldLast - 1, 4)
      .clearContent();
  }

  if (rows.length) {
    ai5EnsureRows_(sheet, rows.length + 1);
    sheet.getRange(2, 1, rows.length, 4)
      .setValues(rows);
  }
}

// Номери замовлень, уже зареєстрованих у журналі
function ai5LoggedIds_(sheet) {
  const ids = new Set();
  const last = sheet.getLastRow();

  if (last < 2) return ids;

  const values = sheet.getRange(
    2, 2, last - 1, 1
  ).getDisplayValues();

  for (const r of values) {
    if (r[0]) ids.add(String(r[0]).trim());
  }

  return ids;
}

// ПЕРШИЙ ЗАПУСК: створення початкової бази
function ai5Initialize() {
  // Спочатку отримуємо актуальні дані V4
  checkOrdersAI_V4();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const state = ai5Sheet_(
      ss, AI5.STATE, AI5_STATE_HEADERS
    );

    const log = ai5Sheet_(
      ss, AI5.LOG, AI5_LOG_HEADERS
    );

    if (state.getLastRow() > 1 ||
        log.getLastRow() > 1) {
      throw new Error(
        'Початкову базу вже створено. ' +
        'Повторна ініціалізація заборонена.'
      );
    }

    const orders = ai5ReadOrders_(ss);
    const statuses = new Map();
    const baseline = [];

    for (const o of orders) {
      statuses.set(o.id, {
        status: o.ready ? 'READY' : 'NOT_READY',
        client: o.client
      });

      // Старі готові замовлення не розсилаємо
      if (o.ready) {
        baseline.push([
          new Date(), o.id, o.client, '',
          'BASELINE', o.warnings,
          'Було готове до початку контролю. ' +
          'Email не надсилався.'
        ]);
      }
    }

    ai5SaveState_(state, statuses);

    if (baseline.length) {
      ai5EnsureRows_(log, baseline.length + 1);
      log.getRange(2, 1, baseline.length, 7)
        .setValues(baseline);
    }

    console.log(
      'Створено початкову базу: ' + orders.length
    );
    console.log(
      'Історичних готових: ' + baseline.length
    );

  } finally {
    lock.releaseLock();
  }
}

// Перевірка нових завершень без відправлення
function ai5Preview() {
  checkOrdersAI_V4();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stateSheet = ss.getSheetByName(AI5.STATE);
  const logSheet = ss.getSheetByName(AI5.LOG);

  if (!stateSheet || stateSheet.getLastRow() < 2 ||
      !logSheet) {
    throw new Error('Спочатку запустіть ai5Initialize');
  }

  const states = ai5ReadState_(stateSheet);
  const logged = ai5LoggedIds_(logSheet);
  const orders = ai5ReadOrders_(ss);

  const preview = [[
    'Замовлення', 'Клієнт', 'Попередній стан',
    'Поточний стан', 'Зауважень', 'Email'
  ]];

  for (const o of orders) {
    const previous = states.get(o.id)?.status || 'NEW';

    if (o.ready &&
        previous !== 'READY' &&
        !logged.has(o.id)) {
      preview.push([
        o.id, o.client, previous,
        'Готове до відвантаження',
        o.warnings, 'Буде надіслано'
      ]);
    }
  }

  const sheet = ss.getSheetByName(AI5.PREVIEW) ||
    ss.insertSheet(AI5.PREVIEW);

  ai5EnsureRows_(sheet, preview.length);
  sheet.clearContents();

  sheet.getRange(
    1, 1, preview.length, preview[0].length
  ).setValues(preview);

  sheet.setFrozenRows(1);

  console.log(
    'Нових готових замовлень: ' + (preview.length - 1)
  );
}

// Текст листа
function ai5Message_(ss, o) {
  const message = [
    'ЗАМОВЛЕННЯ № ' + o.id,
    '',
    'Клієнт: ' + o.client,
    '',
    'Виробництво завершено.',
    'Готових найменувань: ' +
      o.done + ' із ' + o.total,
    'Виконання: 100%',
    '',
    'СТАТУС: ГОТОВЕ ДО ВІДВАНТАЖЕННЯ',
    ''
  ];

  if (o.warnings > 0) {
    message.push(
      'УВАГА: Є ЗАУВАЖЕННЯ ДО ОБЛІКУ.',
      'Кількість зауважень: ' + o.warnings,
      '',
      'Деталі:',
      o.notes.slice(0, 8000),
      ''
    );

    if (o.notes.length > 8000) {
      message.push(
        'Повний перелік зауважень — у AI_WARNINGS.',
        ''
      );
    }
  } else {
    message.push('Зауважень немає.', '');
  }

  message.push(
    'Таблиця ГКД 2026:',
    ss.getUrl(),
    '',
    'Автоматичне повідомлення AI-агента.'
  );

  return message.join('\n');
}

// Обробка нових готових замовлень

function ai5ProcessEmails_() {
  if (!AI5.SEND_EMAIL) {
    console.log('Email вимкнено. Стан не змінено.');
    return;
  }

  // Отримуємо активні email-адреси з AI_SETTINGS
  const recipients = ai5Recipients_();
  const emailTo = recipients.join(',');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const state = ss.getSheetByName(AI5.STATE);
    const log = ss.getSheetByName(AI5.LOG);

    if (!state || state.getLastRow() < 2 || !log) {
      throw new Error(
        'Спочатку створіть початкову базу ai5Initialize'
      );
    }

    const statuses = ai5ReadState_(state);
    const logged = ai5LoggedIds_(log);
    const orders = ai5ReadOrders_(ss);

    let sentCount = 0;

    for (const o of orders) {
      const previous =
        statuses.get(o.id)?.status || 'NEW';

      if (!o.ready) {
        statuses.set(o.id, {
          status: 'NOT_READY',
          client: o.client
        });
        continue;
      }

      // Надсилаємо лише про нове завершення замовлення
      if (previous !== 'READY' &&
          !logged.has(o.id)) {

        // Перевіряємо квоту з урахуванням
        // кількості активних отримувачів
        if (
          MailApp.getRemainingDailyQuota() <
          recipients.length
        ) {
          ai5SaveState_(state, statuses);
          throw new Error(
            'Недостатня квота email для ' +
            recipients.length + ' отримувачів'
          );
        }

        const subject =
          'Готове до відвантаження: замовлення № ' +
          o.id +
          (o.warnings ? ' (є зауваження)' : '');

        // Записуємо спробу до журналу
        // ДО відправлення повідомлення
        const logRow = log.getLastRow() + 1;

        log.appendRow([
          new Date(),
          o.id,
          o.client,
          emailTo,
          'SENDING',
          o.warnings,
          ''
        ]);

        logged.add(o.id);

        try {
          // Надсилаємо один лист усім
          // активним адресатам з AI_SETTINGS
          MailApp.sendEmail(
            emailTo,
            subject,
            ai5Message_(ss, o)
          );

          // Фіксуємо успішне надсилання
          log.getRange(logRow, 5)
            .setValue('SENT');

          sentCount++;

          console.log(
            'Замовлення № ' + o.id +
            ': повідомлення надіслано ' +
            recipients.length + ' отримувачам'
          );

        } catch (error) {
          // Помилку реєструємо без автоматичного
          // повторного надсилання
          log.getRange(logRow, 5)
            .setValue('REVIEW');

          log.getRange(logRow, 7)
            .setValue(
              'Перевірити вручну: ' + String(error)
            );

          console.error(
            'Помилка email для № ' + o.id +
            ': ' + String(error)
          );
        }
      }

      // Оновлюємо стан замовлення
      statuses.set(o.id, {
        status: 'READY',
        client: o.client
      });
    }

    // Зберігаємо актуальні статуси замовлень
    ai5SaveState_(state, statuses);

    console.log(
      'Усього надіслано повідомлень: ' + sentCount
    );

    console.log(
      'Активних отримувачів: ' + recipients.length
    );

  } finally {
    lock.releaseLock();
  }
}


// Основна функція для автоматичного запуску
function ai5ScheduledRun() {
  // 1. Оновлення виробничого контролю
  checkOrdersAI_V4();

  // 2. Надсилання тільки нових повідомлень
  ai5ProcessEmails_();
}

// Окремий тест доставки листа

function ai5SendTestEmail() {
  const recipients = ai5Recipients_();

  MailApp.sendEmail(
    recipients.join(','),
    'Тест AI-агента ГКД 2026',
    'Це тестове повідомлення.\n\n' +
    'Автоматична розсилка працює.\n' +
    'Кількість отримувачів: ' + recipients.length
  );

  console.log(
    'Тестовий лист надіслано: ' +
    recipients.join(', ')
  );
}


// Встановлення двох щоденних запусків
function ai5InstallTriggers() {
  if (!AI5.SEND_EMAIL) {
    throw new Error('Email-розсилка вимкнена');
  }

  ai5Recipients_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const state = ss.getSheetByName(AI5.STATE);

  if (!state || state.getLastRow() < 2) {
    throw new Error(
      'Спочатку виконайте ai5Initialize'
    );
  }

  // Прибираємо тільки старі тригери V5
  ScriptApp.getProjectTriggers()
    .filter(t =>
      t.getHandlerFunction() === 'ai5ScheduledRun'
    )
    .forEach(t => ScriptApp.deleteTrigger(t));

  for (const hour of [8, 18]) {
    ScriptApp.newTrigger('ai5ScheduledRun')
      .timeBased()
      .atHour(hour)
      .nearMinute(0)
      .everyDays(1)
      .inTimezone(AI5.TIMEZONE)
      .create();
  }

  console.log('Встановлено 2 щоденні тригери');
}

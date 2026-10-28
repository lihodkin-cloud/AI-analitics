// тестова функція реалізації

const AI = {
  SOURCE: 'Замовлення',
  ORDERS_REPORT: 'AI_ORDERS_TEST',
  ITEMS_REPORT: 'AI_ITEMS_TEST',
  FIRST_ROW: 4
};

// Визначення стану однієї операції
function checkStage(operation, remaining, direction) {
  const op = String(operation ?? '').trim().toLowerCase();

  if (op === 'вд') {
    return { required: false, state: 'Не потрібно' };
  }

  if (!op || op.startsWith('#')) {
    return { required: false, state: 'Помилка операції',
             error: true };
  }

  if (typeof remaining !== 'number' ||
      !Number.isFinite(remaining)) {
    return { required: true, state: 'Помилка залишку',
             error: true };
  }

  const done = direction === 'LE'
    ? remaining <= 0
    : remaining >= 0;

  return {
    required: true,
    state: done ? 'Готово' : 'Не завершено',
    done,
    remaining
  };
}

// Перевірка виробу за останнім етапом
function analyzeOrderItem(r) {
  const stages = [
    {
      name: 'Пресування',
      result: checkStage(r[11], r[17], 'LE')
    },
    {
      name: 'Фрезерування',
      result: checkStage(r[21], r[24], 'LE')
    },
    {
      name: 'Шліфування',
      result: checkStage(r[28], r[30], 'GE')
    }
  ];

  const warnings = [];
  const qty = r[4];

  const invalidConfig = stages.some(s =>
    s.result.error && !s.result.required
  );

  const required = stages.filter(s => s.result.required);
  const last = required[required.length - 1];

  let ready = false;
  let status = 'У виробництві';

  if (typeof qty !== 'number' || qty <= 0 ||
      invalidConfig || !last || last.result.error) {
    status = 'Потребує перевірки';
  } else {
    ready = last.result.done;

    status = ready ? 'Готово' : 'У виробництві';
  }

  // Перевіряємо всі попередні операції
  if (last) {
    for (const stage of stages) {
      if (stage === last) break;

      if (!stage.result.required) continue;

      if (stage.result.error) {
        warnings.push(
          stage.name + ': помилка обліку'
        );
      } else if (!stage.result.done) {
        warnings.push(
          stage.name + ': залишок ' +
          stage.result.remaining
        );
      }
    }
  }

  // Помилки в описі технологічних операцій
  for (const stage of stages) {
    if (stage.result.error && !stage.result.required) {
      warnings.push(
        stage.name + ': невизначена операція'
      );
    }
  }

  if (ready && warnings.length > 0) {
    status = 'Готово (є зауваження)';
  }

  let color = '';
  let mark = '';

  if (ready) {
    color = '#D9EAD3';
    mark = 1;
  } else if (stages[0].result.done === true) {
    color = '#FFF2CC';
  }

  return {
    ready,
    status,
    lastStage: last ? last.name : 'Не визначено',
    stages: stages.map(s => s.result.state),
    warnings,
    color,
    mark
  };
}

function checkOrdersAI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(AI.SOURCE);

  if (!sheet) {
    throw new Error('Не знайдено аркуш Замовлення');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < AI.FIRST_ROW) return;

  const rows = sheet.getRange(
    AI.FIRST_ROW, 1,
    lastRow - AI.FIRST_ROW + 1, 31
  ).getValues();

  const orders = new Map();
  const items = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const id = String(r[0] ?? '').trim();
    const client = String(r[2] ?? '').trim();
    const part = String(r[3] ?? '').trim();

    if (!id) continue;

    if (!orders.has(id)) {
      orders.set(id, {
        client: '',
        total: 0,
        ready: 0,
        errors: 0,
        warnings: []
      });
    }

    const order = orders.get(id);
    if (client) order.client = client;
    if (!part) continue;

    const result = analyzeOrderItem(r);

    order.total++;

    if (result.ready) {
      order.ready++;
    } else if (result.status === 'Потребує перевірки') {
      order.errors++;
    }

    for (const warning of result.warnings) {
      const message = part + ': ' + warning;
      order.warnings.push(message);
    }

    items.push({
      id,
      client: order.client,
      row: AI.FIRST_ROW + i,
      part,
      currentB: r[1],
      result
    });
  }

  const itemReport = [[
    'Замовлення', 'Клієнт', 'Рядок', 'Виріб',
    'Пресування', 'Фрезерування', 'Шліфування',
    'Останній етап', 'Статус', 'Зауваження',
    'Поточний B', 'Майбутній B', 'Колір D'
  ]];

  for (const item of items) {
    itemReport.push([
      item.id,
      orders.get(item.id).client,
      item.row,
      item.part,
      ...item.result.stages,
      item.result.lastStage,
      item.result.status,
      item.result.warnings.join('; '),
      item.currentB,
      item.result.mark,
      item.result.color
    ]);
  }

  const orderReport = [[
    'Замовлення', 'Клієнт', 'Усього виробів',
    'Готово', 'Прогрес %', 'Статус',
    'Кількість зауважень', 'Зауваження',
    'Дата перевірки'
  ]];

  for (const [id, order] of orders) {
    if (order.total === 0) continue;

    let status = 'У виробництві';

    if (order.ready === order.total) {
      status = order.warnings.length > 0
        ? 'Готове до відвантаження (є зауваження)'
        : 'Готове до відвантаження';
    } else if (order.errors > 0) {
      status = 'Потребує перевірки';
    }

    orderReport.push([
      id,
      order.client,
      order.total,
      order.ready,
      Math.round(order.ready / order.total * 100),
      status,
      order.warnings.length,
      order.warnings.join('; '),
      new Date()
    ]);
  }

  writeAIReport(ss, AI.ITEMS_REPORT, itemReport);
  writeAIReport(ss, AI.ORDERS_REPORT, orderReport);

  console.log('Перевірено замовлень: ' + orders.size);
  console.log('Аналіз завершено');
}

function writeAIReport(ss, name, data) {
  const sheet = ss.getSheetByName(name)
    || ss.insertSheet(name);

  sheet.clearContents();

  sheet.getRange(1, 1, data.length, data[0].length)
    .setValues(data);

  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, data[0].length)
    .setBackground('#D9EAD3')
    .setFontWeight('bold');
}


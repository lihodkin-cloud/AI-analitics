//
// ОСНОВНА РЕАЛІЗАЦІЯ ПЕРЕВІРКИ ГОТОВНОСТІ ЗАМОВЛЕННЯ

const AI4 = {
  SOURCE: 'Замовлення',
  ORDERS: 'AI_ORDERS_TEST',
  ITEMS: 'AI_ITEMS_TEST',
  WARNINGS: 'AI_WARNINGS',
  FIRST_ROW: 4,
  GREEN: '#D9EAD3',
  YELLOW: '#FFF2CC'
};

// 1. Перевірка технологічної операції
function ai4Stage(name, opValue, balance, direction) {
  const op = String(opValue ?? '').trim().toLowerCase();

  if (op === 'вд') {
    return {
      name, required: false, done: false,
      error: false, state: 'Не потрібно'
    };
  }

  if (!op || op.startsWith('#')) {
    return {
      name, required: false, done: false,
      error: true, state: 'Помилка операції'
    };
  }

  if (typeof balance !== 'number' ||
      !Number.isFinite(balance)) {
    return {
      name, required: true, done: false,
      error: true, state: 'Помилка залишку'
    };
  }

  const done = direction === 'LE'
    ? balance <= 0
    : balance >= 0;

  return {
    name,
    required: true,
    done,
    error: false,
    balance,
    state: done ? 'Готово' : 'Не завершено'
  };
}

// 2. Групування пресування за A + M
function ai4BuildPressGroups(rows) {
  const groups = new Map();

  for (const r of rows) {
    const order = String(r[0] ?? '').trim();
    const item = String(r[3] ?? '').trim();
    const op = String(r[11] ?? '').trim().toLowerCase();
    const shield = String(r[12] ?? '').trim();

    if (!order || !item || !op ||
        op === 'вд' || op.startsWith('#') ||
        !shield || shield.startsWith('#')) {
      continue;
    }

    const key = JSON.stringify([order, shield]);

    if (!groups.has(key)) {
      groups.set(key, {
        shield,
        balance: 0,
        error: false,
        count: 0
      });
    }

    const group = groups.get(key);
    const balance = r[17]; // R

    group.count++;

    if (typeof balance !== 'number' ||
        !Number.isFinite(balance)) {
      group.error = true;
    } else {
      group.balance += balance;
    }
  }

  return groups;
}

// 3. Стан пресування для всіх виробів щита
function ai4PressStage(r, groups) {
  const order = String(r[0] ?? '').trim();
  const op = String(r[11] ?? '').trim();
  const shield = String(r[12] ?? '').trim();

  if (op.toLowerCase() === 'вд') {
    return ai4Stage('Пресування', op, 0, 'LE');
  }

  if (!op || op.startsWith('#')) {
    return ai4Stage('Пресування', op, null, 'LE');
  }

  if (!shield || shield.startsWith('#')) {
    return {
      name: 'Пресування',
      required: true, done: false,
      error: true,
      shield,
      state: 'Помилка назви щита'
    };
  }

  const key = JSON.stringify([order, shield]);
  const group = groups.get(key);

  if (!group || group.error) {
    return {
      name: 'Пресування',
      required: true, done: false,
      error: true,
      shield,
      state: 'Помилка залишку групи'
    };
  }

  const result = ai4Stage(
    'Пресування', op, group.balance, 'LE'
  );

  result.shield = shield;
  return result;
}

// 4. Аналіз одного виробу
function ai4Analyze(r, pressGroups) {
  const stages = [
    ai4PressStage(r, pressGroups),
    ai4Stage('Фрезерування', r[21], r[24], 'LE'),
    ai4Stage('Шліфування', r[28], r[30], 'GE')
  ];

  const required = stages.filter(s => s.required);
  const last = required[required.length - 1];
  const warnings = [];

  const qty = r[4];

  const badQty =
    typeof qty !== 'number' || qty <= 0;

  const badOperation = stages.some(
    s => s.error && !s.required
  );

  // Виріб готовий за ОСТАННЬОЮ операцією
  const ready = Boolean(
    !badQty &&
    !badOperation &&
    last &&
    !last.error &&
    last.done
  );

  // Перевіряємо попередні етапи.
  // Незавершеність не скасовує готовність.
  for (let i = 0; i < required.length - 1; i++) {
    const current = required[i];

    const laterDone = required
      .slice(i + 1)
      .find(s => s.done);

    if (!laterDone || current.done) continue;

    
    const reason = current.error
      ? 'помилка обліку'
      : 'залишок ' + Math.ceil(current.balance);


    const shieldInfo = current.shield
      ? ' (щит ' + current.shield + ')'
      : '';

    warnings.push(
      current.name + shieldInfo + ': ' + reason +
      '. Операцію "' + laterDone.name +
      '" уже завершено. Потрібна перевірка.'
    );
  }

  if (badQty) {
    warnings.push('Некоректна кількість виробів');
  }

  for (const s of stages) {
    if (s.error && !s.required) {
      warnings.push(s.name + ': помилка операції');
    }
  }

  if (last && last.error) {
    warnings.push(
      last.name + ': помилка останнього етапу'
    );
  }

  let status;

  if (badQty || badOperation || !last || last.error) {
    status = 'Потребує перевірки';
  } else if (ready) {
    status = warnings.length
      ? 'Готово (є зауваження)'
      : 'Готово';
  } else {
    status = 'У виробництві';
  }

  // Зелений має пріоритет над жовтим
  let color = null;

  if (ready) {
    color = AI4.GREEN;
  } else if (stages[0].required &&
             stages[0].done) {
    color = AI4.YELLOW;
  }

  return {
    ready,
    status,
    stages: stages.map(s => s.state),
    lastStage: last ? last.name : 'Не визначено',
    warnings,
    color
  };
}

// 5. Групове оновлення B і D
function ai4Apply(sheet, addresses, action, value) {
  const size = 100;

  for (let i = 0; i < addresses.length; i += size) {
    const list = sheet.getRangeList(
      addresses.slice(i, i + size)
    );

    if (action === 'one') {
      list.setValue(1);
    } else if (action === 'clear') {
      list.clearContent();
    } else if (action === 'background') {
      list.setBackground(value);
    }
  }
}

// 6. Запис службового звіту
function ai4WriteReport(ss, name, data) {
  const sheet = ss.getSheetByName(name)
    || ss.insertSheet(name);

  sheet.clearContents();

  sheet.getRange(1, 1, data.length, data[0].length)
    .setValues(data);

  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, data[0].length)
    .setFontWeight('bold')
    .setBackground('#D9EAD3');
}

// 7. Головна функція аналізу
function ai4Run(onlyOrder = '') {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(10000)) {
    throw new Error('Інша перевірка вже виконується');
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(AI4.SOURCE);

    if (!sheet) {
      throw new Error('Аркуш Замовлення не знайдено');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < AI4.FIRST_ROW) return;

    const count = lastRow - AI4.FIRST_ROW + 1;

    const rows = sheet.getRange(
      AI4.FIRST_ROW, 1, count, 31
    ).getValues();

    const backgrounds = sheet.getRange(
      AI4.FIRST_ROW, 4, count, 1
    ).getBackgrounds();

    // ГРУПИ ФОРМУЄМО З УСІХ РЯДКІВ.
    // Це важливо навіть для тесту одного замовлення.
    const pressGroups = ai4BuildPressGroups(rows);

    const changes = {
      one: [],
      clear: [],
      green: [],
      yellow: [],
      reset: []
    };

    const orders = new Map();
    const itemData = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      const id = String(r[0] ?? '').trim();
      const client = String(r[2] ?? '').trim();
      const part = String(r[3] ?? '').trim();

      if (!id) continue;
      if (onlyOrder && id !== String(onlyOrder)) {
        continue;
      }

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

      // Пропуск заголовків замовлень
      if (!part) continue;

      const rowNumber = AI4.FIRST_ROW + i;

      const result = ai4Analyze(r, pressGroups);

      order.total++;

      if (result.ready) {
        order.ready++;
      }

      if (result.status === 'Потребує перевірки') {
        order.errors++;
      }

      for (const warning of result.warnings) {
        order.warnings.push({
          row: rowNumber,
          part,
          status: result.status,
          text: warning
        });
      }

      // Автоматичне оновлення B
      const oldB = String(r[1] ?? '').trim();

      if (result.ready && oldB !== '1') {
        changes.one.push('B' + rowNumber);
      }

      if (!result.ready && oldB !== '') {
        changes.clear.push('B' + rowNumber);
      }

      // Автоматичне оновлення кольору D
      const oldColor = String(
        backgrounds[i][0] || ''
      ).toLowerCase();

      const newColor = result.color
        ? result.color.toLowerCase()
        : null;

      if (newColor === AI4.GREEN.toLowerCase() &&
          oldColor !== newColor) {
        changes.green.push('D' + rowNumber);

      } else if (
        newColor === AI4.YELLOW.toLowerCase() &&
        oldColor !== newColor
      ) {
        changes.yellow.push('D' + rowNumber);

      } else if (
        newColor === null &&
        (
          oldColor === AI4.GREEN.toLowerCase() ||
          oldColor === AI4.YELLOW.toLowerCase()
        )
      ) {
        changes.reset.push('D' + rowNumber);
      }

      itemData.push({
        id, rowNumber, part, oldB, result
      });
    }

    // Звіт по виробах
    const items = [[
      'Замовлення', 'Клієнт', 'Рядок',
      'Виріб', 'Пресування', 'Фрезерування',
      'Шліфування', 'Останній етап',
      'Статус', 'Зауваження', 'B до',
      'Новий B', 'Колір D'
    ]];

    for (const item of itemData) {
      items.push([
        item.id,
        orders.get(item.id).client,
        item.rowNumber,
        item.part,
        ...item.result.stages,
        item.result.lastStage,
        item.result.status,
        item.result.warnings.join('; '),
        item.oldB,
        item.result.ready ? 1 : '',
        item.result.color || ''
      ]);
    }

    // Звіт по замовленнях
    const summary = [[
      'Замовлення', 'Клієнт', 'Виробів',
      'Готово', 'Прогрес %', 'Статус',
      'Зауважень', 'Деталі зауважень',
      'Дата перевірки'
    ]];

    const warnings = [[
      'Дата', 'Замовлення', 'Клієнт',
      'Рядок', 'Виріб', 'Статус', 'Зауваження'
    ]];

    for (const [id, o] of orders) {
      if (!o.total) continue;

      let status = 'У виробництві';

      if (o.ready === o.total) {
        status = o.warnings.length
          ? 'Готове до відвантаження (є зауваження)'
          : 'Готове до відвантаження';
      } else if (o.errors > 0) {
        status = 'Потребує перевірки';
      }

      summary.push([
        id, o.client, o.total, o.ready,
        Math.round(o.ready / o.total * 100),
        status,
        o.warnings.length,
        o.warnings.map(w =>
          w.part + ': ' + w.text
        ).join('; '),
        new Date()
      ]);

      for (const w of o.warnings) {
        warnings.push([
          new Date(), id, o.client,
          w.row, w.part, w.status, w.text
        ]);
      }
    }

    // Спочатку звіти
    ai4WriteReport(ss, AI4.ITEMS, items);
    ai4WriteReport(ss, AI4.ORDERS, summary);
    ai4WriteReport(ss, AI4.WARNINGS, warnings);

    // Потім оновлення виробничого аркуша
    ai4Apply(sheet, changes.one, 'one');
    ai4Apply(sheet, changes.clear, 'clear');

    ai4Apply(sheet, changes.green,
             'background', AI4.GREEN);
    ai4Apply(sheet, changes.yellow,
             'background', AI4.YELLOW);
    ai4Apply(sheet, changes.reset,
             'background', null);

    SpreadsheetApp.flush();

    console.log('Замовлень: ' + orders.size);
    console.log('B=1: ' + changes.one.length);
    console.log('Очищено B: ' + changes.clear.length);
    console.log('Зелених: ' + changes.green.length);
    console.log('Жовтих: ' + changes.yellow.length);
    console.log('Зауважень: ' + (warnings.length - 1));

  } finally {
    lock.releaseLock();
  }
}

// Тестування замовлення №166 зі спільними щитами
function checkOrdersAI_V4_test166() {
  ai4Run('166');
}

// Перевірка всіх замовлень
function checkOrdersAI_V4() {
  ai4Run('');
}

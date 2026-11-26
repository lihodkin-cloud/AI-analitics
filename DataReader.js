// Ця функція читає всі дані лише одним зверненням до Google Sheets, що важливо для швидкості Apps Script.

function readRawTaskRows_() {

  if (AI_RUN_CONTEXT_ && AI_RUN_CONTEXT_.rawRows !== null) {
    return AI_RUN_CONTEXT_.rawRows;
  }

  const sh =
    getSourceSheet_();

  const lastRow =
    sh.getLastRow();

  const headers = sh.getRange(CFG.HEADER_ROW, 1, 1, CFG.LAST_READ_COLUMN).getValues()[0];
  const expected = {2: 'дата', 3: 'зміна', 5: 'операція', 6: 'верстат',
    7: '№ замовлення', 9: 'виріб', 11: 'норма', 12: 'план', 13: 'факт',
    15: 'план', 16: 'факт', 18: 'факт', 19: '% виконання', 20: 'Виконавець',
    21: 'Причина відхилення (заповнює майстер цеху)'};
  Object.keys(expected).forEach(col => {
    if (String(headers[Number(col) - 1] || '').trim() !== expected[col]) {
      throw aiFailure_('SOURCE_HEADERS_CHANGED', false);
    }
  });


  if (
    lastRow <
    CFG.FIRST_DATA_ROW
  ) {

    if (AI_RUN_CONTEXT_) AI_RUN_CONTEXT_.rawRows = [];
    return [];
  }


  const values =
    sh.getRange(
      CFG.FIRST_DATA_ROW,
      1,
      lastRow -
        CFG.FIRST_DATA_ROW +
        1,
      CFG.LAST_READ_COLUMN
    )
    .getValues();


  const out = [];

  let currentDateKey = null;
  let currentShift = null;


  values.forEach(
    (row, i) => {

      const sourceRow =
        CFG.FIRST_DATA_ROW + i;


      const operation =
        cell_(
          row,
          CFG.COL.OPERATION
        );

      const machine =
        cell_(
          row,
          CFG.COL.MACHINE
        );

      const order =
        cell_(
          row,
          CFG.COL.ORDER
        );

      const product =
        cell_(
          row,
          CFG.COL.PRODUCT
        );

      const norm =
        cell_(
          row,
          CFG.COL.NORM_PER_HOUR
        );

      const actualHours =
        cell_(
          row,
          CFG.COL.ACTUAL_HOURS
        );

      const actualQty =
        cell_(
          row,
          CFG.COL.ACTUAL_QTY
        );


      /*
       * Чи є це реальним
       * рядком завдання
       */

      const hasTaskPayload =
        [
          operation,
          machine,
          order,
          product,
          norm,
          actualHours,
          actualQty
        ]
        .some(
          v => text_(v) !== ''
        );


      /*
       * Дата
       */

      const rawDate =
        cell_(
          row,
          CFG.COL.DATE
        );


      const parsedDate =
        parseDateKey_(
          rawDate,
          currentDateKey
        );


      if (parsedDate) {
        currentDateKey =
          parsedDate;
      }


      /*
       * Зміна
       */

      const parsedShift =
        shift_(
          cell_(
            row,
            CFG.COL.SHIFT
          )
        );


      if (parsedShift) {
        currentShift =
          parsedShift;
      }


      /*
       * Рядок може бути
       * просто заголовком дати
       */

      if (!hasTaskPayload) {

        if (
          text_(rawDate) !== '' &&
          !parsedShift
        ) {

          currentShift = null;
        }

        return;
      }


      out.push({

        sourceRow,

        dateKey:
          parsedDate ||
          currentDateKey,

        shift:
          parsedShift ||
          currentShift,

        raw: row

      });

    }
  );


  if (AI_RUN_CONTEXT_) AI_RUN_CONTEXT_.rawRows = out;
  return out;
}

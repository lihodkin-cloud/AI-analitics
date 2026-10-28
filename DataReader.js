// Ця функція читає всі дані лише одним зверненням до Google Sheets, що важливо для швидкості Apps Script.

function readRawTaskRows_() {

  const sh =
    getSourceSheet_();

  const lastRow =
    sh.getLastRow();


  if (
    lastRow <
    CFG.FIRST_DATA_ROW
  ) {

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


  return out;
}
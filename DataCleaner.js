// Спочатку визначаємо процес
function mapOperation_(operation) {

  const op =
    text_(operation)
      .toLowerCase();


  if (
    op ===
    CFG.OPERATION.PRESS
      .toLowerCase()
  ) {

    return 'PRESS';
  }


  if (
    op ===
    CFG.OPERATION.CNC
      .toLowerCase()
  ) {

    return 'CNC';
  }


  if (
    operation ===
    CFG.OPERATION.SANDING
  ) {

    return 'SANDING';
  }


  return null;
}

//Додаємо резервну перевірку по верстату.

function inferProcessFromMachine_(
  machine
) {

  const m =
    text_(machine)
      .toLowerCase();


  if (!m) {
    return null;
  }


  if (
    m.startsWith('прес')
  ) {

    return 'PRESS';
  }


  if (
    m.startsWith('бачі') ||
    m === 'twin'
  ) {

    return 'CNC';
  }


  return null;
}

// система попереджень

function addWarning_(
  warnings,
  rec,
  code,
  message
) {

  warnings.push({

    sourceRow:
      rec.sourceRow,

    date:
      rec.date,

    shift:
      rec.shift,

    process:
      rec.process ||
      rec.suspectedProcess,

    machine:
      rec.machine,

    order:
      rec.order,

    product:
      rec.product,

    code,

    message

  });
}

// основна нормалізація

function normalizeTaskRows_(
  rawRows
) {
  
  const records = [];
  const warnings = [];


  rawRows.forEach(
    item => {

      const row =
        item.raw;


      const rec = {

        sourceRow:
          item.sourceRow,

        date:
          item.dateKey,

        shift:
          item.shift,

        operation:
          text_(
            cell_(
              row,
              CFG.COL.OPERATION
            )
          ),

        machine:
          text_(
            cell_(
              row,
              CFG.COL.MACHINE
            )
          ),

        order:
          text_(
            cell_(
              row,
              CFG.COL.ORDER
            )
          ),

        product:
          text_(
            cell_(
              row,
              CFG.COL.PRODUCT
            )
          ),

        normPerHour:
          num_(
            cell_(
              row,
              CFG.COL.NORM_PER_HOUR
            )
          ),

        planHours:
          num_(
            cell_(
              row,
              CFG.COL.PLAN_HOURS
            )
          ),

        actualHours:
          num_(
            cell_(
              row,
              CFG.COL.ACTUAL_HOURS
            )
          ),

        planQty:
          num_(
            cell_(
              row,
              CFG.COL.PLAN_QTY
            )
          ),

        actualQty:
          num_(
            cell_(
              row,
              CFG.COL.ACTUAL_QTY
            )
          ),

        defectQty:
          num_(
            cell_(
              row,
              CFG.COL.DEFECT_QTY
            )
          ),

        sheetPerformancePct:
          pctCellToPct_(
            cell_(
              row,
              CFG.COL.PERFORMANCE
            )
          ),

        worker:
          text_(
            cell_(
              row,
              CFG.COL.WORKER
            )
          ),

        reason:
          text_(
            cell_(
              row,
              CFG.COL.REASON
            )
          )

      };


      /*
       * ==========================
       * ВИЗНАЧЕННЯ ПРОЦЕСУ
       * ==========================
       *
       * Спочатку дивимось на E.
       * Якщо E пошкоджена —
       * PRESS/CNC можемо відновити
       * через машину F.
       */

      const processByOperation =
        mapOperation_(
          rec.operation
        );


      const processByMachine =
        inferProcessFromMachine_(
          rec.machine
        );


      rec.process =
        processByOperation ||
        processByMachine ||
        null;


      rec.processSource =
        processByOperation
          ? 'OPERATION'
          : (
              processByMachine
                ? 'MACHINE'
                : null
            );


      /*
       * ==========================
       * ЦІЛЬОВІ ПРОЦЕСИ
       * ==========================
       */

      rec.isTargetCandidate =
        rec.process === 'PRESS' ||
        rec.process === 'CNC' ||
        rec.process === 'SANDING';


      /*
       * Інші операції
       * поки не аналізуємо.
       */

      if (
        !rec.isTargetCandidate
      ) {

        return;
      }


      /*
       * ==========================
       * ШЛІФУВАННЯ
       * ==========================
       *
       * Шліфування не оцінюємо
       * за продуктивністю.
       *
       * K та M тут не є
       * обов'язковими.
       *
       * Головна задача:
       * аналіз P, R та % браку.
       */

      if (
        rec.process === 'SANDING'
      ) {


        /*
         * Для Ш машина може бути
         * порожньою — це НЕ помилка.
         *
         * Продуктивність не рахуємо.
         */

        rec.kpiReady =
          false;

        rec.timeAccountable =
          false;

        rec.normHoursForActual =
          null;

        rec.calculatedPerformancePct =
          null;


        /*
         * Базова перевірка
         * дати та зміни.
         */

        if (!rec.date) {

          addWarning_(
            warnings,
            rec,
            'DATE_MISSING',
            'Не визначена дата завдання.'
          );
        }


        const validShift =
          rec.shift === 1 ||
          rec.shift === 2;


        if (!validShift) {

          addWarning_(
            warnings,
            rec,
            'SHIFT_INVALID',
            'Не визначена зміна 1/2.'
          );
        }


        /*
         * Для аналізу браку
         * критично потрібні:
         *
         * G — номер замовлення
         * I — виріб
         */

        if (!rec.order) {

          addWarning_(
            warnings,
            rec,
            'ORDER_MISSING_QUALITY',
            'Для шліфування не зазначений номер замовлення.'
          );
        }


        if (!rec.product) {

          addWarning_(
            warnings,
            rec,
            'PRODUCT_MISSING',
            'Не зазначений виріб.'
          );
        }


        /*
         * Чи вже є результат
         * шліфування.
         *
         * P = придатні
         * R = брак
         */

        const goodQty =
          rec.actualQty !== null
            ? rec.actualQty
            : 0;


        const defectQty =
          rec.defectQty !== null
            ? rec.defectQty
            : 0;


        const inspectedQty =
          goodQty +
          defectQty;


        const hasQualityResult =
          (
            rec.actualQty !== null ||
            rec.defectQty !== null
          ) &&
          inspectedQty > 0;


        /*
         * Якщо кількості ще
         * не внесені —
         * це майбутній / незавершений
         * рядок.
         */

        if (
          !hasQualityResult
        ) {

          rec.isCompleted =
            false;

          rec.activityType =
            'QUALITY';

          rec.status =
            'PENDING';

          rec.qualityReady =
            false;

          rec.defectPct =
            null;


          records.push(
            rec
          );


          return;
        }


        /*
         * Кількості вже є,
         * отже операція фактично
         * завершена.
         */

        rec.isCompleted =
          true;


        /*
         * Повна готовність
         * до аналітики якості.
         */

        const qualityReady =
          isSandingQualityReady_(
            rec
          ) &&
          !!rec.product &&
          validShift;


        if (
          !qualityReady
        ) {

          /*
           * Дані про результат є,
           * але ключові реквізити
           * відсутні.
           */

          rec.activityType =
            'INVALID';

          rec.status =
            'INVALID';

          rec.qualityReady =
            false;


          rec.defectPct =
            calculateDefectPct_(
              goodQty,
              defectQty
            );


          records.push(
            rec
          );


          return;
        }


        /*
         * Повноцінний рядок
         * контролю якості.
         */

        rec.activityType =
          'QUALITY';

        rec.status =
          'QUALITY';

        rec.qualityReady =
          true;


        rec.defectPct =
          calculateDefectPct_(
            goodQty,
            defectQty
          );


        records.push(
          rec
        );


        return;
      }


      /*
       * ==========================
       * PRESS / CNC
       * ==========================
       *
       * Нижче залишається
       * ваша існуюча логіка.
       */


      rec.isCompleted =
        rec.actualHours !== null &&
        rec.actualHours > 0;


      rec.activityType =
        rec.isCompleted
          ? 'INVALID'
          : 'PENDING';


      rec.kpiReady =
        false;


      rec.timeAccountable =
        false;


      rec.normHoursForActual =
        null;


      rec.calculatedPerformancePct =
        null;


      rec.defectPct =
        null;


      /*
       * Базова перевірка
       * дати та зміни.
       */

      if (!rec.date) {

        addWarning_(
          warnings,
          rec,
          'DATE_MISSING',
          'Не визначена дата завдання.'
        );
      }


      if (
        rec.shift !== 1 &&
        rec.shift !== 2
      ) {

        addWarning_(
          warnings,
          rec,
          'SHIFT_INVALID',
          'Не визначена зміна 1/2.'
        );
      }


      /*
       * Ще не виконувалося.
       */

      if (
        !rec.isCompleted
      ) {

        records.push(
          rec
        );

        return;
      }


      /*
       * Виконавець / верстат
       * потрібні і для виробництва,
       * і для допоміжного часу.
       */

      if (!rec.machine) {

        addWarning_(
          warnings,
          rec,
          'MACHINE_MISSING',
          'Не зазначений верстат.'
        );
      }


      if (!rec.worker) {

        const warningCode =
          rec.order
            ? 'WORKER_MISSING_PRODUCTION'
            : 'WORKER_MISSING_AUXILIARY';


        const warningMessage =
          rec.order
            ? 'Для виробничого завдання не зазначений виконавець.'
            : 'Для допоміжної роботи не зазначений виконавець.';


        addWarning_(
          warnings,
          rec,
          warningCode,
          warningMessage
        );
      }


      /*
       * ==========================
       * ДОПОМІЖНА /
       * НЕНOРМОВАНА РОБОТА
       * ==========================
       *
       * Якщо немає G,
       * але є фактичний час M —
       * це не нормоване
       * виробництво.
       */

      if (
        !rec.order
      ) {

        rec.activityType =
          'NON_PRODUCTIVE';


        rec.timeAccountable =
          true;


        rec.nonProductiveType =
          classifyNonProductiveActivity_(
            rec
          );


        records.push(
          rec
        );


        return;
      }


      /*
       * ==========================
       * ВИРОБНИЧИЙ РЯДОК
       * ==========================
       */

      const validNorm =
        rec.normPerHour !== null &&
        rec.normPerHour > 0;


      const validQty =
        rec.actualQty !== null &&
        rec.actualQty >= 0;


      if (!rec.product) {

        addWarning_(
          warnings,
          rec,
          'PRODUCT_MISSING',
          'Не зазначений виріб.'
        );
      }


      if (!validNorm) {

        addWarning_(
          warnings,
          rec,
          'NORM_INVALID',
          'Норма K відсутня або <= 0.'
        );
      }


      if (!validQty) {

        addWarning_(
          warnings,
          rec,
          'ACTUAL_QTY_INVALID',
          'Фактична кількість P відсутня або < 0.'
        );
      }


      /*
       * Якщо E зламана,
       * але верстат і виробничі
       * дані дозволяють однозначно
       * визначити процес —
       * рядок НЕ втрачаємо.
       */

      if (
        !processByOperation &&
        processByMachine &&
        validNorm &&
        validQty
      ) {

        addWarning_(
          warnings,
          rec,
          'OPERATION_RECOVERED',

          `Операція "${rec.operation || 'порожньо'}" ` +
          `відновлена як ${rec.process} ` +
          `за верстатом "${rec.machine}".`
        );
      }


      const productionReady =

        !!rec.process &&

        !!rec.date &&

        (
          rec.shift === 1 ||
          rec.shift === 2
        ) &&

        validNorm &&

        validQty;


      if (
        !productionReady
      ) {

        rec.activityType =
          'INVALID';


        records.push(
          rec
        );


        return;
      }


      /*
       * ==========================
       * НОРМОВАНЕ ВИРОБНИЦТВО
       * ==========================
       */

      rec.activityType =
        'PRODUCTION';


      rec.kpiReady =
        true;


      rec.timeAccountable =
        true;


      rec.normHoursForActual =
        rec.actualQty /
        rec.normPerHour;


      rec.calculatedPerformancePct =
        (
          rec.normHoursForActual /
          rec.actualHours
        ) * 100;


      rec.defectPct =
        calculateDefectPct_(
          rec.actualQty,
          rec.defectQty
        );


      /*
       * Контроль S
       */

      if (

        rec.sheetPerformancePct !==
          null &&

        Math.abs(
          rec.sheetPerformancePct -
          rec.calculatedPerformancePct
        ) >

        CFG.THRESHOLDS
          .PERFORMANCE_TOLERANCE_PP

      ) {

        addWarning_(
          warnings,
          rec,
          'PERFORMANCE_MISMATCH',

          `S=${round_(
            rec.sheetPerformancePct,
            1
          )}%, ` +

          `розрахунок=${round_(
            rec.calculatedPerformancePct,
            1
          )}%.`
        );
      }


      records.push(
        rec
      );

    }
  );


  /*
   * ==========================
   * РЕЗУЛЬТАТ
   * ==========================
   */

  return {

    records,

    warnings,

    stats: {

      rawTaskRows:
        rawRows.length,

      targetRows:
        records.length,

      completedRows:
        records.filter(
          r =>
            r.isCompleted
        ).length,

      productionRows:
        records.filter(
          r =>
            r.activityType ===
            'PRODUCTION'
        ).length,

      nonProductiveRows:
        records.filter(
          r =>
            r.activityType ===
            'NON_PRODUCTIVE'
        ).length,

      /*
       * Новий показник:
       * завершені рядки
       * контролю якості Ш.
       */

      qualityRows:
        records.filter(
          r =>
            r.activityType ===
            'QUALITY' &&
            r.qualityReady ===
            true
        ).length,

      /*
       * Шліфування,
       * яке ще не має
       * результату P/R.
       */

      sandingPendingRows:
        records.filter(
          r =>
            r.process ===
              'SANDING' &&
            r.status ===
              'PENDING'
        ).length,

      invalidRows:
        records.filter(
          r =>
            r.activityType ===
            'INVALID'
        ).length,

      warningCount:
        warnings.length

    }

  };
}

function loadAnalyticsData_() {

  return normalizeTaskRows_(
    readRawTaskRows_()
  );
}

function classifyNonProductiveActivity_(
  rec
) {

  const source =
    (
      `${rec.product || ''} ` +
      `${rec.reason || ''}`
    )
    .toLowerCase();


  if (
    source.includes(
      'переналад'
    )
  ) {
    return 'SETUP';
  }


  if (
    source.includes(
      'прибиран'
    )
  ) {
    return 'CLEANING';
  }


  if (
    source.includes(
      'калібров'
    )
  ) {
    return 'CALIBRATION';
  }


  if (
    source.includes(
      'робота по цеху'
    )
  ) {
    return 'SHOP_WORK';
  }


  if (
    source.includes(
      'розкрій шаблону'
    )
  ) {
    return 'TEMPLATE_WORK';
  }


  if (
    source.includes(
      'взірц'
    )
  ) {
    return 'SAMPLE_WORK';
  }


  return 'OTHER';
}

function isSandingQualityReady_(
  rec
) {

  if (
    !rec.date ||
    !rec.shift ||
    !rec.order
  ) {

    return false;
  }


  const goodQty =
    num_(
      rec.actualQty
    );


  const defectQty =
    num_(
      rec.defectQty
    );


  if (
    goodQty === null &&
    defectQty === null
  ) {

    return false;
  }


  const good =
    goodQty === null
      ? 0
      : goodQty;


  const defect =
    defectQty === null
      ? 0
      : defectQty;


  return (
    good >= 0 &&
    defect >= 0 &&
    good + defect > 0
  );
}
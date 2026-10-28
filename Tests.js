// Поки не підключаємо ні AI, ні тригери. Спочатку тестуємо цифри.

function testDailyAnalysis() {

  const result =
    buildDailyAnalysis_(
      '2026-09-22',
      1
    );


  console.log(
    '================================'
  );

  console.log(
    `ДЕННИЙ АНАЛІЗ: ${result.date}, зміна ${result.shift}`
  );

  console.log(
    '================================'
  );


  printProcessSummary_(
    'ПРЕСУВАННЯ',
    result.press
  );


  printProcessSummary_(
    'ЧПУ',
    result.cnc
  );


  console.log('');
  console.log(
    `ПОПЕРЕДЖЕННЯ ДАНИХ: ${result.dataWarnings.length}`
  );


  result.dataWarnings
    .slice(0, 30)
    .forEach(
      w => {

        console.log(
          `рядок ${w.sourceRow} | ` +
          `${w.machine || '-'} | ` +
          `${w.code} | ` +
          `${w.message}`
        );

      }
    );


  if (
    result.dataWarnings.length > 30
  ) {

    console.log(
      `... ще ${
        result.dataWarnings.length - 30
      } попереджень`
    );
  }
}

function printProcessSummary_(
  title,
  data
) {

  console.log('');
  console.log(
    '--------------------------------'
  );

  console.log(title);

  console.log(
    '--------------------------------'
  );


  console.log(
    `Верстатів у KPI: ${data.machineCount}`
  );

  console.log(
    `Рядків завдань: ${data.taskRowCount}`
  );

  console.log(
    `Виконаних рядків у KPI: ${data.eligibleRowCount}`
  );

  console.log(
    `Ще не завершено: ${data.pendingRowCount}`
  );

  console.log(
    `Виключено через дані: ${data.excludedCompletedRowCount}`
  );


  /*
   * >95%
   */

  printMachineGroup_(
    '>95%',
    data.above95
  );


  /*
   * 90–95%
   */

  printMachineGroup_(
    '90–95%',
    data.between90and95
  );


  /*
   * <90%
   */

  printMachineGroup_(
    '<90%',
    data.below90
  );


  /*
   * Брак >3%
   */

  console.log('');
  console.log(
    'БРАК >3%'
  );


  if (
    data.highDefect.length === 0
  ) {

    console.log(
      'немає'
    );

  } else {

    data.highDefect.forEach(
      m => {

        console.log(
          `${m.machine} | ` +
          `${m.defectPct}% | ` +
          `${m.defectQty} шт | ` +
          `виконавець: ${
            m.workers.join(', ') || '-'
          }`
        );

      }
    );
  }


  /*
   * Локальні відхилення
   * на верстатах із нормальним
   * загальним KPI
   */

  printLocalTaskExceptions_(
    data.machines
  );
}

function printMachineGroup_(
  title,
  machines
) {

  console.log('');
  console.log(title);


  if (
    machines.length === 0
  ) {

    console.log(
      'немає'
    );

    return;
  }


  machines.forEach(
    m => {

      console.log(
        `${m.machine} | ` +
        `${m.performancePct}% | ` +
        `факт ${m.actualHours} год | ` +
        `норматив ${m.normHoursForActual} год | ` +
        `виконавець: ${
          m.workers.join(', ') || '-'
        }`
      );


      /*
       * Для проблемних верстатів
       * показуємо роботи
       */

      if (
        m.performancePct <= 95
      ) {

        m.tasks.forEach(
          t => {

            console.log(
              `   • ${t.product} | ` +
              `${t.performancePct}% | ` +
              `${t.actualQty} шт | ` +
              `${t.actualHours} год | ` +
              `виконавець: ${
                 t.worker || '-'
              }` +
              (
                t.reason
                  ? ` | причина: ${t.reason}`
                  : ''
              )
            );

          }
        );
      }

    }
  );
}

// ТИЖДЕНЬ

function testWeeklyAnalysis() {

  const result =
    buildWeeklyAnalysis_(
      '2026-09-14'
    );


  console.log(
    '================================'
  );

  console.log(
    'ТИЖНЕВИЙ АНАЛІЗ'
  );

  console.log(
    `${result.period.from} — ${result.period.to}`
  );

  console.log(
    '================================'
  );


  /*
   * ПРАЦІВНИКИ
   */

  printWorkersWeekly_(
    'ПРАЦІВНИКИ — ПРЕСУВАННЯ',
    result.workers.press
  );


  printWorkersWeekly_(
    'ПРАЦІВНИКИ — ЧПУ',
    result.workers.cnc
  );


  /*
   * Найпроблемніші вироби
   */

  printWorstProducts_(
    'ВИРОБИ — ПРЕСУВАННЯ',
    result.products.PRESS,
    15
  );


  printWorstProducts_(
    'ВИРОБИ — ЧПУ',
    result.products.CNC,
    15
  );


  console.log('');
  console.log(
    `ПОПЕРЕДЖЕННЯ ДАНИХ: ${
      result.dataWarnings.length
    }`
  );


  result.dataWarnings
    .slice(0, 20)
    .forEach(
      w => {

        console.log(
          `рядок ${w.sourceRow} | ` +
          `${w.date || '-'} | ` +
          `${w.machine || '-'} | ` +
          `${w.code} | ` +
          `${w.message}`
        );

      }
    );


  if (
    result.dataWarnings.length > 20
  ) {

    console.log(
      `... ще ${
        result.dataWarnings.length - 20
      } попереджень`
    );
  }
}

// МІСЯЦЬ

function testMonthlyAnalysis() {

  const result =
    buildMonthlyAnalysis_(
      '2026-09-22'
    );


  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}

function printLocalTaskExceptions_(
  machines
) {

  console.log('');
  console.log(
    'ЛОКАЛЬНІ ВІДХИЛЕННЯ <90%'
  );

  console.log(
    '(на верстатах із загальним KPI >=90%)'
  );


  const exceptions = [];


  machines.forEach(
    m => {

      /*
       * Якщо сам верстат уже <90%,
       * його роботи ми й так бачимо
       * у відповідному розділі.
       */

      if (
        m.performancePct === null ||
        m.performancePct < 90
      ) {
        return;
      }


      (
        m.taskExceptions || []
      )
      .forEach(
        t => {

          exceptions.push({
            machine:
              m.machine,

            ...t
          });

        }
      );

    }
  );


  if (
    exceptions.length === 0
  ) {

    console.log(
      'немає'
    );

    return;
  }


  exceptions.forEach(
    t => {

      console.log(
        `${t.machine} | ` +
        `${t.product} | ` +
        `${t.performancePct}% | ` +
        `${t.actualQty} шт | ` +
        `${t.actualHours} год | ` +
        `виконавець: ${
          t.worker || '-'
        }` +
        (
          t.reason
            ? ` | причина: ${t.reason}`
            : ''
        )
      );

    }
  );
}

function printWorkersWeekly_(
  title,
  workers
) {

  console.log('');
  console.log(
    '--------------------------------'
  );

  console.log(title);

  console.log(
    '--------------------------------'
  );


  if (
    workers.length === 0
  ) {

    console.log(
      'немає даних'
    );

    return;
  }


  workers.forEach(
    w => {

      console.log(
        `${w.worker} | ` +
        `змін: ${w.shiftsTotal} | ` +
        `>95%: ${w.above95} | ` +
        `90–95%: ${w.between90and95} | ` +
        `<90%: ${w.below90} | ` +
        `брак >3%: ${w.defectAbove3} | ` +
        `KPI періоду: ${
          w.overallPerformancePct
        }%`
      );

    }
  );
}

function printWorstProducts_(
  title,
  products,
  limit
) {

  console.log('');
  console.log(
    '--------------------------------'
  );

  console.log(title);

  console.log(
    'найнижчі KPI'
  );

  console.log(
    '--------------------------------'
  );


  if (
    products.length === 0
  ) {

    console.log(
      'немає даних'
    );

    return;
  }


  products
    .slice(0, limit)
    .forEach(
      p => {

        console.log(
          `${p.product} | ` +
          `${p.actualQty} шт | ` +
          `факт: ${p.actualHours} год | ` +
          `норматив: ${p.normHoursForActual} год | ` +
          `KPI: ${p.performancePct}% | ` +
          `змін: ${p.shiftCount}`
        );

      }
    );
}

function testDailyReportBuilder() {

  const text =
    buildDailyReportText_(
      '2026-09-22',
      1
    );


  console.log(text);
}

function testWeeklyReportBuilder() {

  const text =
    buildWeeklyReportText_(
      '2026-09-14'
    );


  console.log(text);
}

function testMonthlyReportBuilder() {

  const text =
    buildMonthlyReportText_(
      '2026-09-15'
    );


  console.log(text);
}

function testOpenAIConnection() {

  console.log(
    'Перевірка з’єднання з OpenAI...'
  );


  const result =
    callOpenAI_(

      'Відповідай дуже коротко українською мовою.',

      'Напиши тільки фразу: Зв’язок з OpenAI працює.'

    );


  console.log(
    '=============================='
  );

  console.log(
    'OPENAI CONNECTION TEST'
  );

  console.log(
    '=============================='
  );


  console.log(
    result.text
  );


  console.log('');


  console.log(
    'MODEL: ' +
    result.model
  );


  console.log(
    'RESPONSE ID: ' +
    result.responseId
  );


  if (
    result.usage
  ) {

    console.log(
      'USAGE: ' +
      JSON.stringify(
        result.usage
      )
    );
  }
}

function analyzeMonthlyReport_(
  anchorDate
) {

  const reportPackage =
    buildMonthlyReportPackage_(
      anchorDate
    );


  const instructions =
    getProductionAnalystInstructions_();


  const input =
    buildMonthlyAIInput_(
      reportPackage
    );


  const aiResult =
    callOpenAI_(
      instructions,
      input
    );


  return {

    reportType:
      'MONTHLY',

    period:
      reportPackage.period,

    aiText:
      aiResult.text,

    model:
      aiResult.model,

    responseId:
      aiResult.responseId,

    usage:
      aiResult.usage

  };
}

function testAIDailyAnalysis() {

  console.log(
    '=============================='
  );

  console.log(
    'AI АНАЛІЗ ЗМІНИ'
  );

  console.log(
    '=============================='
  );


  const result =
    analyzeDailyReport_(
      '2026-09-22',
      1
    );


  console.log(
    result.aiText
  );


  console.log('');

  console.log(
    '------------------------------'
  );

  console.log(
    'MODEL: ' +
    result.model
  );


  console.log(
    'RESPONSE ID: ' +
    result.responseId
  );


  if (
    result.usage
  ) {

    console.log(
      'USAGE: ' +
      JSON.stringify(
        result.usage
      )
    );
  }
}

function testAIWeeklyAnalysis() {

  console.log(
    '=============================='
  );

  console.log(
    'AI ТИЖНЕВИЙ АНАЛІЗ'
  );

  console.log(
    '=============================='
  );


  const result =
    analyzeWeeklyReport_(
      '2026-09-14'
    );


  console.log(
    result.aiText
  );


  console.log('');

  console.log(
    '------------------------------'
  );

  console.log(
    'ПЕРІОД: ' +
    result.period.from +
    ' — ' +
    result.period.to
  );


  console.log(
    'MODEL: ' +
    result.model
  );


  console.log(
    'RESPONSE ID: ' +
    result.responseId
  );


  if (
    result.usage
  ) {

    console.log(
      'USAGE: ' +
      JSON.stringify(
        result.usage
      )
    );
  }
}

function testSaveAIDailyReport() {

  console.log(
    'Формую та зберігаю AI-звіт...'
  );


  const result =
    analyzeAndSaveDailyReport_(
      '2026-09-22',
      1
    );


  console.log(
    '=============================='
  );


  console.log(
    'AI REPORT SAVED'
  );


  console.log(
    '=============================='
  );


  console.log(
    'REPORT KEY: ' +
    result.storage.reportKey
  );


  console.log(
    'ROW: ' +
    result.storage.row
  );


  console.log(
    'ACTION: ' +
    result.storage.action
  );


  console.log('');

  console.log(
    result.aiText
  );
}

function testAIReportHeaders() {

  const sheet =
    getOrCreateAIReportSheet_();


  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        20
      )
      .getValues()[0];


  console.log(
    headers.join(' | ')
  );


  console.log(
    'R: ' + headers[17]
  );

  console.log(
    'S: ' + headers[18]
  );

  console.log(
    'T: ' + headers[19]
  );
}

function testAIEmailDelivery() {

  const reportKey =
    'DAILY|2026-09-22|SHIFT_1';


  queueAIReportEmail_(
    reportKey
  );


  const result =
    sendStoredAIReportEmail_(
      reportKey
    );


  console.log(
    JSON.stringify(
      result
    )
  );
}

function testAIEmailDelivery() {

  const reportKey =
    'DAILY|2026-09-22|SHIFT_1';


  queueAIReportEmail_(
    reportKey
  );


  const result =
    sendStoredAIReportEmail_(
      reportKey
    );


  console.log(
    JSON.stringify(
      result
    )
  );
}

function testAIDashboard() {

  refreshAIDashboard_();

  console.log(
    'AI_DASHBOARD оновлено.'
  );
}

function testSandingQualityNormalization() {

  const rawRows =
    readRawTaskRows_();


  const result =
    normalizeTaskRows_(
      rawRows
    );


  /*
   * normalizeTaskRows_()
   * повертає:
   *
   * {
   *   records,
   *   warnings,
   *   stats
   * }
   */

  const rows =
    result.records || [];


  console.log(
    'NORMALIZED RECORDS: ' +
    rows.length
  );


  const sandingRows =
    rows.filter(
      row =>
        row.process ===
        'SANDING'
    );


  const readyRows =
    sandingRows.filter(
      row =>
        row.activityType ===
          'QUALITY' &&
        row.qualityReady ===
          true
    );


  const pendingRows =
    sandingRows.filter(
      row =>
        row.status ===
        'PENDING'
    );


  const invalidRows =
    sandingRows.filter(
      row =>
        row.status ===
        'INVALID'
    );


  console.log(
    '=============================='
  );

  console.log(
    'SANDING QUALITY TEST'
  );

  console.log(
    'Всього рядків Ш: ' +
    sandingRows.length
  );

  console.log(
    'Готові до аналізу: ' +
    readyRows.length
  );

  console.log(
    'Pending: ' +
    pendingRows.length
  );

  console.log(
    'Invalid: ' +
    invalidRows.length
  );


  if (result.stats) {

    console.log(
      'stats.qualityRows: ' +
      (
        result.stats.qualityRows ||
        0
      )
    );

    console.log(
      'stats.sandingPendingRows: ' +
      (
        result.stats
          .sandingPendingRows ||
        0
      )
    );
  }


  console.log(
    '=============================='
  );


  readyRows
    .slice(-20)
    .forEach(
      row => {

        const good =
          row.actualQty !== null
            ? row.actualQty
            : 0;


        const defect =
          row.defectQty !== null
            ? row.defectQty
            : 0;


        const inspected =
          good +
          defect;


        const defectPct =
          inspected > 0
            ? defect /
              inspected *
              100
            : 0;


        console.log(
          [
            'row=' +
              row.sourceRow,

            'date=' +
              row.date,

            'shift=' +
              row.shift,

            'order=' +
              row.order,

            'product=' +
              row.product,

            'P=' +
              good,

            'R=' +
              defect,

            'TOTAL=' +
              inspected,

            'DEFECT=' +
              defectPct.toFixed(2) +
              '%'

          ].join(' | ')
        );

      }
    );
}

function testRawSandingOperation() {

  const rows =
    readRawTaskRows_();


  const sandingRows =
    rows.filter(
      item => {

        const operation =
          String(
            item.raw[
              CFG.COL.OPERATION - 1
            ] || ''
          ).trim();


        return (
          operation === 'Ш'
        );
      }
    );


  console.log(
    'RAW рядків з E = Ш: ' +
    sandingRows.length
  );


  sandingRows
    .slice(-20)
    .forEach(
      item => {

        const row =
          item.raw;


        console.log(
          [
            'row=' + item.sourceRow,
            'date=' + item.dateKey,
            'shift=' + item.shift,

            'operation=[' +
              row[
                CFG.COL.OPERATION - 1
              ] +
              ']',

            'machine=' +
              row[
                CFG.COL.MACHINE - 1
              ],

            'order=' +
              row[
                CFG.COL.ORDER - 1
              ],

            'product=' +
              row[
                CFG.COL.PRODUCT - 1
              ],

            'P=' +
              row[
                CFG.COL.ACTUAL_QTY - 1
              ],

            'R=' +
              row[
                CFG.COL.DEFECT_QTY - 1
              ]

          ].join(' | ')
        );

      }
    );
}

function testSandingOperationMapping() {

  console.log(
    'CFG.OPERATION.SANDING = [' +
    CFG.OPERATION.SANDING +
    ']'
  );


  console.log(
    'mapOperation_("Ш") = [' +
    mapOperation_('Ш') +
    ']'
  );
}

function testSandingCleanerDiagnostic() {

  const rawRows =
    readRawTaskRows_();


  const rawSandingRows =
    rawRows.filter(
      item => {

        const operation =
          String(
            item.raw[
              CFG.COL.OPERATION - 1
            ] || ''
          ).trim();


        return operation === 'Ш';
      }
    );


  console.log(
    'RAW SANDING: ' +
    rawSandingRows.length
  );


  const result =
    normalizeTaskRows_(
      rawRows
    );


  console.log(
    'normalizeTaskRows_ type: ' +
    typeof result
  );


  console.log(
    'Array.isArray(result): ' +
    Array.isArray(result)
  );


  if (
    result &&
    typeof result === 'object' &&
    !Array.isArray(result)
  ) {

    console.log(
      'Result keys: ' +
      Object.keys(result).join(', ')
    );


    /*
     * Перевіряємо всі масиви,
     * які повернула normalizeTaskRows_().
     */

    Object.keys(result)
      .forEach(
        key => {

          if (
            !Array.isArray(
              result[key]
            )
          ) {
            return;
          }


          const arr =
            result[key];


          const sanding =
            arr.filter(
              row =>
                row &&
                row.process ===
                  'SANDING'
            );


          console.log(
            key +
            ': rows=' +
            arr.length +
            ' | SANDING=' +
            sanding.length
          );

        }
      );
  }


  /*
   * Тепер беремо перший сирий рядок Ш
   * і дивимось, що саме з нього
   * бачить cleaner.
   */

  if (
    rawSandingRows.length > 0
  ) {

    const item =
      rawSandingRows[0];


    const raw =
      item.raw;


    console.log(
      '=============================='
    );

    console.log(
      'FIRST RAW SANDING'
    );

    console.log(
      'sourceRow=' +
      item.sourceRow
    );

    console.log(
      'date=' +
      item.dateKey
    );

    console.log(
      'shift=' +
      item.shift
    );

    console.log(
      'operation=[' +
      raw[
        CFG.COL.OPERATION - 1
      ] +
      ']'
    );

    console.log(
      'mapOperation=[' +
      mapOperation_(
        raw[
          CFG.COL.OPERATION - 1
        ]
      ) +
      ']'
    );

    console.log(
      'machine=[' +
      raw[
        CFG.COL.MACHINE - 1
      ] +
      ']'
    );

    console.log(
      'order=[' +
      raw[
        CFG.COL.ORDER - 1
      ] +
      ']'
    );

    console.log(
      'product=[' +
      raw[
        CFG.COL.PRODUCT - 1
      ] +
      ']'
    );

    console.log(
      'P=[' +
      raw[
        CFG.COL.ACTUAL_QTY - 1
      ] +
      ']'
    );

    console.log(
      'R=[' +
      raw[
        CFG.COL.DEFECT_QTY - 1
      ] +
      ']'
    );
  }
}

function testSandingTraceability() {

  const rawRows =
    readRawTaskRows_();


  const result =
    normalizeTaskRows_(
      rawRows
    );


  const rows =
    result.records || [];

  const productShieldMap =
    buildProductShieldMap_();

  /*
   * Беремо тільки завершене
   * шліфування з фактичним браком.
   */

  const sandingRows =
    rows.filter(
      row =>
        row.process ===
          'SANDING' &&
        row.qualityReady ===
          true &&
        (
          row.defectQty || 0
        ) > 0
    );


  console.log(
    '=============================='
  );

  console.log(
    'SANDING TRACEABILITY TEST'
  );

  console.log(
    'Рядків Ш з браком: ' +
    sandingRows.length
  );

  console.log(
    '=============================='
  );


  /*
   * Останні 15 випадків.
   */

  sandingRows
    .slice(-15)
    .forEach(
      sandingRow => {

        const trace =
          buildSandingTraceability_(
            sandingRow,
            rows,
            productShieldMap
          );


        console.log(
          '------------------------------'
        );


        console.log(
          'row=' +
          sandingRow.sourceRow +
          ' | date=' +
          sandingRow.date +
          ' | shift=' +
          sandingRow.shift
        );


        console.log(
          'ORDER: ' +
          sandingRow.order
        );


        console.log(
          'PRODUCT: ' +
          sandingRow.product
        );

        console.log(
         'SHIELD: ' +
         (
           trace.shield ||
           'НЕ ЗНАЙДЕНО'
         )
       );

        console.log(
          'QUALITY: P=' +
          sandingRow.actualQty +
          ' | R=' +
          sandingRow.defectQty +
          ' | defect=' +
          round_(
            sandingRow.defectPct,
            2
          ) +
          '%'
        );


        /*
         * PRESS
         */

        if (
          trace.press &&
          trace.press.assignments.length
        ) {

          console.log(
            'PRESS:'
          );


          trace.press
            .assignments
            .forEach(
              assignment => {

                console.log(
                  '  ' +
                  (
                    assignment.machine ||
                    'без верстата'
                  ) +
                  ' | ' +
                  (
                    assignment.worker ||
                    'без працівника'
                  ) +
                  ' | qty=' +
                  assignment.actualQty +
                  ' | shifts=' +
                  assignment.shiftCount
                );

              }
            );

        } else {

          console.log(
            'PRESS: НЕ ЗНАЙДЕНО'
          );
        }


        /*
         * CNC
         */

        if (
          trace.cnc &&
          trace.cnc.assignments.length
        ) {

          console.log(
            'CNC:'
          );


          trace.cnc
            .assignments
            .forEach(
              assignment => {

                console.log(
                  '  ' +
                  (
                    assignment.machine ||
                    'без верстата'
                  ) +
                  ' | ' +
                  (
                    assignment.worker ||
                    'без працівника'
                  ) +
                  ' | qty=' +
                  assignment.actualQty +
                  ' | shifts=' +
                  assignment.shiftCount
                );

              }
            );

        } else {

          console.log(
            'CNC: НЕ ЗНАЙДЕНО'
          );
        }

      }
    );
}

function testQualityAnalysis() {

  const rawRows =
    readRawTaskRows_();


  const normalized =
    normalizeTaskRows_(
      rawRows
    );


  const allRows =
    normalized.records || [];


  /*
   * Знаходимо останню дату,
   * для якої є готове
   * шліфування.
   */

  const sandingDates =
    allRows
      .filter(
        row =>
          row.process ===
            'SANDING' &&
          row.qualityReady ===
            true &&
          row.date
      )
      .map(
        row =>
          row.date
      )
      .sort();


  if (
    sandingDates.length === 0
  ) {

    console.log(
      'Немає готових рядків SANDING.'
    );

    return;
  }


  const testDate =
    sandingDates[
      sandingDates.length - 1
    ];


  const periodRows =
    allRows.filter(
      row =>
        row.date ===
        testDate
    );


  const productShieldMap =
    buildProductShieldMap_();


  const quality =
    buildQualityAnalysis_(
      periodRows,
      allRows,
      productShieldMap
    );


  console.log(
    '=============================='
  );

  console.log(
    'QUALITY ANALYSIS TEST'
  );

  console.log(
    'DATE: ' +
    testDate
  );


  console.log(
    'QUALITY CASES: ' +
    quality.totals
      .qualityCaseCount
  );


  console.log(
    'GOOD: ' +
    quality.totals.goodQty
  );


  console.log(
    'DEFECT: ' +
    quality.totals.defectQty
  );


  console.log(
    'INSPECTED: ' +
    quality.totals.inspectedQty
  );


  console.log(
    'DEFECT %: ' +
    round_(
      quality.totals.defectPct,
      2
    ) +
    '%'
  );


  console.log(
    'HIGH DEFECT CASES > ' +
    quality.thresholdDefectPct +
    '%: ' +
    quality.totals
      .highDefectCaseCount
  );


  console.log(
    '=============================='
  );

  console.log(
    'TOP ORDER + PRODUCT'
  );


  quality.byOrderProduct
    .slice(0, 10)
    .forEach(
      item => {

        console.log(
          [
            'order=' +
              item.order,

            'product=' +
              item.product,

            'P=' +
              item.goodQty,

            'R=' +
              item.defectQty,

            'defect=' +
              round_(
                item.defectPct,
                2
              ) +
              '%',

            'cases=' +
              item.qualityCaseCount

          ].join(' | ')
        );

      }
    );


  console.log(
    '=============================='
  );

  console.log(
    'PRESS MACHINES'
  );


  quality.pressMachines
    .slice(0, 10)
    .forEach(
      item => {

        console.log(
          [
            item.machine,

            'cases=' +
              item.caseCount,

            'high=' +
              item.highDefectCaseCount,

            'highRate=' +
              round_(
                item.highDefectCaseRatePct,
                1
              ) +
              '%',

            'linkedDefect=' +
              round_(
                item.linkedDefectPct,
                2
              ) +
              '%'

          ].join(' | ')
        );

      }
    );


  console.log(
    '=============================='
  );

  console.log(
    'CNC MACHINES'
  );


  quality.cncMachines
    .slice(0, 10)
    .forEach(
      item => {

        console.log(
          [
            item.machine,

            'cases=' +
              item.caseCount,

            'high=' +
              item.highDefectCaseCount,

            'highRate=' +
              round_(
                item.highDefectCaseRatePct,
                1
              ) +
              '%',

            'linkedDefect=' +
              round_(
                item.linkedDefectPct,
                2
              ) +
              '%'

          ].join(' | ')
        );

      }
    );


  console.log(
    '=============================='
  );

  console.log(
    'PRESS WORKERS'
  );


  quality.pressWorkers
    .slice(0, 10)
    .forEach(
      item => {

        console.log(
          [
            item.worker,

            'cases=' +
              item.caseCount,

            'high=' +
              item.highDefectCaseCount,

            'highRate=' +
              round_(
                item.highDefectCaseRatePct,
                1
              ) +
              '%'

          ].join(' | ')
        );

      }
    );


  console.log(
    '=============================='
  );

  console.log(
    'CNC WORKERS'
  );


  quality.cncWorkers
    .slice(0, 10)
    .forEach(
      item => {

        console.log(
          [
            item.worker,

            'cases=' +
              item.caseCount,

            'high=' +
              item.highDefectCaseCount,

            'highRate=' +
              round_(
                item.highDefectCaseRatePct,
                1
              ) +
              '%'

          ].join(' | ')
        );

      }
    );


  console.log(
    '=============================='
  );
}

function testQualityAIContext() {

  const rawRows =
    readRawTaskRows_();


  const normalized =
    normalizeTaskRows_(
      rawRows
    );


  const allRows =
    normalized.records || [];


  const testDate =
    '2026-09-29';


  const periodRows =
    allRows.filter(
      row =>
        row.date ===
        testDate
    );


  const productShieldMap =
    buildProductShieldMap_();


  const quality =
    buildQualityAnalysis_(
      periodRows,
      allRows,
      productShieldMap
    );


  const aiContext =
    buildQualityAIContext_(
      quality
    );


  console.log(
    JSON.stringify(
      aiContext,
      null,
      2
    )
  );
}

function testReportBuilderQuality() {

  const daily =
    buildDailyReportPackage_(
      '2026-09-29',
      1
    );


  console.log(
    '=============================='
  );

  console.log(
    'DAILY QUALITY'
  );

  console.log(
    JSON.stringify(
      daily.quality
        ? daily.quality.totals
        : null,
      null,
      2
    )
  );


  const weekly =
    buildWeeklyReportPackage_(
      '2026-09-29'
    );


  console.log(
    '=============================='
  );

  console.log(
    'WEEKLY QUALITY'
  );

  console.log(
    JSON.stringify(
      weekly.quality
        ? weekly.quality.totals
        : null,
      null,
      2
    )
  );


  const monthly =
    buildMonthlyReportPackage_(
      '2026-09-29'
    );


  console.log(
    '=============================='
  );

  console.log(
    'MONTHLY QUALITY'
  );

  console.log(
    JSON.stringify(
      monthly.quality
        ? monthly.quality.totals
        : null,
      null,
      2
    )
  );


  console.log(
    '=============================='
  );
}

function testAIDailyQualityAnalysis() {

  const result =
    analyzeDailyReport_(
      '2026-09-29',
      1
    );


  console.log(
    '=============================='
  );

  console.log(
    'AI DAILY QUALITY TEST'
  );


  console.log(
    'DATE: ' +
    result.date
  );


  console.log(
    'SHIFT: ' +
    result.shift
  );


  console.log(
    '=============================='
  );


  console.log(
    result.aiText
  );


  console.log(
    ''
  );


  console.log(
    'MODEL: ' +
    result.model
  );


  console.log(
    'RESPONSE ID: ' +
    result.responseId
  );


  if (
    result.usage
  ) {

    console.log(
      'USAGE: ' +
      JSON.stringify(
        result.usage
      )
    );
  }


  console.log(
    '=============================='
  );
}

function testAIWeeklyQualityAnalysis() {

  const result =
    analyzeWeeklyReport_(
      '2026-09-29'
    );


  console.log(
    '=============================='
  );

  console.log(
    'AI WEEKLY QUALITY TEST'
  );


  console.log(
    'PERIOD: ' +
    result.period.from +
    ' - ' +
    result.period.to
  );


  console.log(
    '=============================='
  );


  console.log(
    result.aiText
  );


  console.log(
    ''
  );


  console.log(
    'MODEL: ' +
    result.model
  );


  console.log(
    'RESPONSE ID: ' +
    result.responseId
  );


  if (
    result.usage
  ) {

    console.log(
      'USAGE: ' +
      JSON.stringify(
        result.usage
      )
    );
  }


  console.log(
    '=============================='
  );
}

function testAIMonthlyQualityAnalysis() {

  const result =
    analyzeMonthlyReport_(
      '2026-09-29'
    );


  console.log(
    '=============================='
  );

  console.log(
    'AI MONTHLY QUALITY TEST'
  );


  console.log(
    'PERIOD: ' +
    result.period.from +
    ' - ' +
    result.period.to
  );


  console.log(
    '=============================='
  );


  logLargeText_(
  result.aiText
  );


  console.log(
    ''
  );


  console.log(
    'MODEL: ' +
    result.model
  );


  console.log(
    'RESPONSE ID: ' +
    result.responseId
  );


  if (
    result.usage
  ) {

    console.log(
      'USAGE: ' +
      JSON.stringify(
        result.usage
      )
    );
  }


  console.log(
    '=============================='
  );
}

function logLargeText_(
  text
) {

  const value =
    String(
      text || ''
    );


  const chunkSize =
    7000;


  for (
    let i = 0;
    i < value.length;
    i += chunkSize
  ) {

    console.log(
      value.substring(
        i,
        i + chunkSize
      )
    );

  }
}

function testDashboardQuality() {

  refreshAIDashboard_();


  console.log(
    'Dashboard quality refreshed.'
  );
}

function testDashboardEquipmentSignalsDebug() {

  const ss =
    SpreadsheetApp.openById(
      CFG.SPREADSHEET_ID
    );

  const sheet =
    ss.getSheetByName(
      'AI_DASHBOARD'
    );

  const reports =
    readStoredAIReports_();


  console.log(
    'REPORTS COUNT: ' +
    reports.length
  );


  const monthly =
    getLatestQualityDashboardReport_(
      reports,
      'MONTHLY'
    );


  console.log(
    'MONTHLY KEY: ' +
    monthly.reportKey
  );


  if (!monthly) {

    console.log(
      'STOP: MONTHLY NOT FOUND'
    );

    return;
  }


  const data =
    loadAnalyticsData_();


  const allRows =
    data.records || [];


  console.log(
    'ALL ROWS: ' +
    allRows.length
  );


  console.log(
    'MONTHLY FROM: ' +
    dashboardDateKey_(
      monthly.dateFrom
    )
  );


  console.log(
    'MONTHLY TO: ' +
    dashboardDateKey_(
      monthly.dateTo
    )
  );


  const periodRows =
    allRows.filter(
      row =>
        inDateRange_(
          row.date,
          dashboardDateKey_(
            monthly.dateFrom
          ),
          dashboardDateKey_(
            monthly.dateTo
          )
        )
    );


  console.log(
    'PERIOD ROWS: ' +
    periodRows.length
  );


  const productShieldMap =
    buildProductShieldMap_();


  const qualityAnalysis =
    buildQualityAnalysis_(
      periodRows,
      allRows,
      productShieldMap
    );


  console.log(
    'PRESS MACHINES: ' +
    JSON.stringify(
      qualityAnalysis.pressMachines
    )
  );


  console.log(
    'CNC MACHINES: ' +
    JSON.stringify(
      qualityAnalysis.cncMachines
    )
  );


  const startRow =
    getDashboardSafeAppendRow_(
      sheet
    );


  console.log(
    'SAFE START ROW: ' +
    startRow
  );


  console.log(
    'DASHBOARD LAST ROW: ' +
    sheet.getLastRow()
  );

}

function testDashboardEquipmentSignalsDirect() {

  const ss =
    SpreadsheetApp.openById(
      CFG.SPREADSHEET_ID
    );

  const sheet =
    ss.getSheetByName(
      'AI_DASHBOARD'
    );

  const reports =
    readStoredAIReports_();


  console.log(
    'BEFORE LAST ROW: ' +
    sheet.getLastRow()
  );


  renderDashboardEquipmentSignals_(
    sheet,
    reports
  );


  console.log(
    'AFTER LAST ROW: ' +
    sheet.getLastRow()
  );

}
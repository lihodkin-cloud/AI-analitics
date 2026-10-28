// ДОПОМІЖНІ ФУНКЦІЇ ФОРМАТУВАННЯ

function reportNumber_(
  value,
  digits
) {

  if (
    value === null ||
    value === undefined
  ) {
    return '-';
  }


  return String(
    round_(
      value,
      digits === undefined
        ? 1
        : digits
    )
  );
}


function reportPct_(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {
    return '-';
  }


  return (
    reportNumber_(
      value,
      1
    ) +
    '%'
  );
}


function auxiliaryTypeLabel_(
  type
) {

  const labels = {

    SETUP:
      'переналагодження',

    CLEANING:
      'прибирання',

    CALIBRATION:
      'калібрування',

    SHOP_WORK:
      'робота по цеху',

    TEMPLATE_WORK:
      'робота з шаблоном',

    SAMPLE_WORK:
      'пробні взірці',

    OTHER:
      'інше'

  };


  return (
    labels[type] ||
    type ||
    'інше'
  );
}

// КОМПАКТНИЙ ОПИС ЗАВДАННЯ

function reportTask_(
  task
) {

  return {

    order:
      task.order,

    product:
      task.product,

    worker:
      task.worker,

    performancePct:
      task.performancePct,

    actualQty:
      task.actualQty,

    actualHours:
      task.actualHours,

    defectQty:
      task.defectQty,

    defectPct:
      task.defectPct,

    reason:
      task.reason

  };
}

// КОМПАКТНИЙ ОПИС ВЕРСТАТ

function reportMachine_(
  machine,
  includeTasks
) {

  return {

    machine:
      machine.machine,

    performancePct:
      machine.performancePct,

    productiveHours:
      machine.productiveHours,

    normHours:
      machine.normHoursForActual,

    auxiliaryHours:
      machine.nonProductiveHours,

    defectQty:
      machine.defectQty,

    defectPct:
      machine.defectPct,

    workers:
      machine.workers,

    reasons:
      machine.reasons,

    tasks:

      includeTasks

        ? machine.tasks.map(
            reportTask_
          )

        : []

  };
}

// ДЕНИЙ ПАКЕТ ДЛЯ АІ

function buildDailyProcessReport_(
  processData
) {

  /*
   * Локальні відхилення
   * на нормальному верстаті.
   */

  const localExceptions = [];


  processData.machines
    .forEach(
      machine => {

        if (
          machine.performancePct ===
            null ||
          machine.performancePct < 90
        ) {
          return;
        }


        (
          machine.taskExceptions ||
          []
        )
        .forEach(
          task => {

            localExceptions.push({

              machine:
                machine.machine,

              ...reportTask_(
                task
              )

            });

          }
        );

      }
    );


  /*
   * Допоміжні роботи.
   */

  const auxiliaryWork = [];


  const allMachines =
    []
      .concat(
        processData.machines || []
      )
      .concat(
        processData
          .nonProductiveOnlyMachines ||
        []
      );


  allMachines.forEach(
    machine => {

      (
        machine
          .nonProductiveActivities ||
        []
      )
      .forEach(
        activity => {

          auxiliaryWork.push({

            machine:
              machine.machine,

            activity:
              activity.activity,

            activityType:
              activity.activityType,

            worker:
              activity.worker,

            hours:
              activity.actualHours,

            reason:
              activity.reason

          });

        }
      );

    }
  );


  const auxiliaryHours =
    auxiliaryWork.reduce(
      (sum, item) =>
        sum +
        (item.hours || 0),
      0
    );


  return {

    summary: {

      machineCount:
        processData.machineCount,

      productionRows:
        processData.eligibleRowCount,

      auxiliaryRows:
        processData.nonProductiveRowCount ||
        0,

      pendingRows:
        processData.pendingRowCount,

      excludedRows:
        processData
          .excludedCompletedRowCount,

      auxiliaryHours:
        round_(
          auxiliaryHours,
          2
        )

    },


    above95:

      processData.above95.map(
        machine =>
          reportMachine_(
            machine,
            false
          )
      ),


    between90and95:

      processData
        .between90and95
        .map(
          machine =>
            reportMachine_(
              machine,
              true
            )
        ),


    below90:

      processData.below90.map(
        machine =>
          reportMachine_(
            machine,
            true
          )
      ),


    highDefect:

      processData.highDefect.map(
        machine =>
          reportMachine_(
            machine,
            false
          )
      ),


    localExceptions,

    auxiliaryWork

  };
}

// ГОЛОВНИЙ ДЕННИЙ REPORT BUILDER

function buildDailyReportPackage_(
  date,
  shift
) {

  const analysis =
    buildDailyAnalysis_(
      date,
      shift
    );


  return {

    reportType:
      'DAILY',

    date:
      analysis.date,

    shift:
      analysis.shift,

    generatedAt:
      analysis.generatedAt,


    press:
      buildDailyProcessReport_(
        analysis.press
      ),


    cnc:
      buildDailyProcessReport_(
        analysis.cnc
      ),

    quality:
      analysis.quality || null,

    dataQuality: {

      warningCount:
        analysis
          .dataWarnings
          .length,

      warnings:

        analysis
          .dataWarnings
          .map(
            w => ({

              row:
                w.sourceRow,

              process:
                w.process,

              machine:
                w.machine,

              order:
                w.order,

              product:
                w.product,

              code:
                w.code,

              message:
                w.message

            })
          )

    }

  };
}

// ТЕКСТ ДЕННОГО ЗВІТу

function buildDailyReportText_(
  date,
  shift
) {

  const report =
    buildDailyReportPackage_(
      date,
      shift
    );


  const lines = [];


  lines.push(
    `ЗМІННИЙ ЗВІТ ${report.date}`
  );

  lines.push(
    `Зміна: ${report.shift}`
  );


  lines.push('');


  appendDailyProcessText_(
    lines,
    'ПРЕСУВАННЯ',
    report.press
  );


  lines.push('');


  appendDailyProcessText_(
    lines,
    'ЧПУ',
    report.cnc
  );


  if (
    report.dataQuality
      .warningCount > 0
  ) {

    lines.push('');

    lines.push(
      'ЯКІСТЬ ДАНИХ'
    );

    lines.push(
      `Попереджень: ${
        report.dataQuality
          .warningCount
      }`
    );


    report.dataQuality
      .warnings
      .forEach(
        w => {

          lines.push(
            `• рядок ${w.row}: ` +
            `${w.message}`
          );

        }
      );

  }


  return lines.join('\n');
}

// Форматування одного процесу

function appendDailyProcessText_(
  lines,
  title,
  data
) {

  lines.push(
    `=== ${title} ===`
  );


  /*
   * >95
   */

  lines.push(
    '>95%'
  );


  if (
    data.above95.length === 0
  ) {

    lines.push(
      '• немає'
    );

  } else {

    data.above95.forEach(
      m => {

        lines.push(
          `• ${m.machine} — ` +
          `${reportPct_(
            m.performancePct
          )}`
        );

      }
    );
  }


  /*
   * 90–95
   */

  lines.push('');
  lines.push(
    '90–95%'
  );


  if (
    data.between90and95.length ===
    0
  ) {

    lines.push(
      '• немає'
    );

  } else {

    data.between90and95
      .forEach(
        m => {

          lines.push(
            `• ${m.machine} — ` +
            `${reportPct_(
              m.performancePct
            )}; ` +
            `виконавець: ${
              m.workers.join(', ') ||
              '-'
            }`
          );


          m.tasks.forEach(
            t => {

              lines.push(
                `   - ${t.product}: ` +
                `${reportPct_(
                  t.performancePct
                )}` +
                (
                  t.reason
                    ? `; причина: ${
                        t.reason
                      }`
                    : ''
                )
              );

            }
          );

        }
      );

  }


  /*
   * <90
   */

  lines.push('');
  lines.push(
    '<90%'
  );


  if (
    data.below90.length === 0
  ) {

    lines.push(
      '• немає'
    );

  } else {

    data.below90.forEach(
      m => {

        lines.push(
          `• ${m.machine} — ` +
          `${reportPct_(
            m.performancePct
          )}; ` +
          `виконавець: ${
            m.workers.join(', ') ||
            '-'
          }`
        );


        m.tasks.forEach(
          t => {

            lines.push(
              `   - ${t.product}: ` +
              `${reportPct_(
                t.performancePct
              )}` +
              (
                t.reason
                  ? `; причина: ${
                      t.reason
                    }`
                  : ''
              )
            );

          }
        );

      }
    );

  }


  /*
   * Брак
   */

  lines.push('');
  lines.push(
    'БРАК >3%'
  );


  if (
    data.highDefect.length === 0
  ) {

    lines.push(
      '• немає'
    );

  } else {

    data.highDefect.forEach(
      m => {

        lines.push(
          `• ${m.machine} — ` +
          `${reportPct_(
            m.defectPct
          )} браку`
        );

      }
    );

  }


  /*
   * Локальні проблеми
   */

  lines.push('');
  lines.push(
    'ЛОКАЛЬНІ ВІДХИЛЕННЯ <90%'
  );


  if (
    data.localExceptions.length ===
    0
  ) {

    lines.push(
      '• немає'
    );

  } else {

    data.localExceptions
      .forEach(
        x => {

          lines.push(
            `• ${x.machine} — ` +
            `${x.product}: ` +
            `${reportPct_(
              x.performancePct
            )}; ` +
            `виконавець: ${
              x.worker || '-'
            }`
          );

        }
      );

  }


  /*
   * Допоміжний час
   */

  lines.push('');
  lines.push(
    'ДОПОМІЖНІ / НЕНOРМОВАНІ РОБОТИ'
  );


  if (
    data.auxiliaryWork.length === 0
  ) {

    lines.push(
      '• немає'
    );

  } else {

    lines.push(
      `Усього: ${
        reportNumber_(
          data.summary
            .auxiliaryHours,
          2
        )
      } год`
    );


    data.auxiliaryWork
      .forEach(
        a => {

          lines.push(
            `• ${a.machine} — ` +
            `${a.activity || 'робота'}; ` +
            `${reportNumber_(
              a.hours,
              2
            )} год; ` +
            `${
              auxiliaryTypeLabel_(
                a.activityType
              )
            }; ` +
            `виконавець: ${
              a.worker || '-'
            }`
          );

        }
      );

  }
}

// ТИЖНЕВИЙ/МІСЯЧНИЙ ПАКЕТ ДЛЯ АІ

function buildPeriodReportPackageFromAnalysis_(
  analysis
) {

  return {

    reportType:
      analysis.reportType,

    period:
      analysis.period,

    generatedAt:
      analysis.generatedAt,


    processSummary:
      analysis.processSummary,


    workers: {

      press:
        analysis.workers.press,

      cnc:
        analysis.workers.cnc

    },


    products: {

      press:
        analysis.products.PRESS,

      cnc:
        analysis.products.CNC

    },


    auxiliary:
      analysis.auxiliary,

    quality:
      analysis.quality || null,

    dataQuality: {

      warningCount:
        analysis
          .dataWarnings
          .length,

      warnings:
        analysis.dataWarnings

    }

  };
}

function buildWeeklyReportPackage_(
  anchorDate
) {

  return (
    buildPeriodReportPackageFromAnalysis_(

      buildWeeklyAnalysis_(
        anchorDate
      )

    )
  );
}

function buildMonthlyReportPackage_(
  anchorDate
) {

  return (
    buildPeriodReportPackageFromAnalysis_(

      buildMonthlyAnalysis_(
        anchorDate
      )

    )
  );
}

// ТЕКСТ ТИЖНЕВОГО/МІСЯЧНОГО ЗВІТУ

function buildPeriodReportTextFromPackage_(
  report
) {

  const lines = [];


  lines.push(
    report.reportType === 'MONTHLY'
      ? 'МІСЯЧНИЙ ЗВІТ'
      : 'ТИЖНЕВИЙ ЗВІТ'
  );


  lines.push(
    `${report.period.from} — ` +
    `${report.period.to}`
  );


  lines.push('');


  appendPeriodProcessSummary_(
    lines,
    'ПРЕСУВАННЯ',
    report.processSummary.press,
    report.workers.press,
    report.products.press,
    report.auxiliary.press
  );


  lines.push('');


  appendPeriodProcessSummary_(
    lines,
    'ЧПУ',
    report.processSummary.cnc,
    report.workers.cnc,
    report.products.cnc,
    report.auxiliary.cnc
  );


  lines.push('');

  lines.push(
    `ПОПЕРЕДЖЕННЯ ДАНИХ: ${
      report.dataQuality
        .warningCount
    }`
  );


  report.dataQuality
    .warnings
    .slice(0, 20)
    .forEach(
      w => {

        lines.push(
          `• рядок ${
            w.sourceRow
          }: ${w.message}`
        );

      }
    );


  return lines.join('\n');
}

// ФОРМАТ ПЕРІОДУ

function appendPeriodProcessSummary_(
  lines,
  title,
  processSummary,
  workers,
  products,
  auxiliary
) {

  lines.push(
    `=== ${title} ===`
  );


  lines.push(
    `KPI процесу: ${
      reportPct_(
        processSummary
          .performancePct
      )
    }`
  );


  lines.push(
    `Нормативний час: ${
      reportNumber_(
        processSummary
          .normHoursForActual,
        2
      )
    } год`
  );


  lines.push(
    `Фактичний виробничий час: ${
      reportNumber_(
        processSummary
          .productiveHours,
        2
      )
    } год`
  );


  lines.push(
    `Допоміжні роботи: ${
      reportNumber_(
        auxiliary.totalHours,
        2
      )
    } год`
  );


  /*
   * Працівники
   */

  lines.push('');
  lines.push(
    'ПРАЦІВНИКИ'
  );


  workers.forEach(
    w => {

      lines.push(
        `• ${w.worker}: ` +
        `змін ${w.shiftsTotal}; ` +
        `>95% — ${w.above95}; ` +
        `90–95% — ${
          w.between90and95
        }; ` +
        `<90% — ${w.below90}; ` +
        `брак >3% — ${
          w.defectAbove3
        }; ` +
        `KPI — ${
          reportPct_(
            w.overallPerformancePct
          )
        }`
      );

    }
  );


  /*
   * Проблемні вироби
   */

  lines.push('');
  lines.push(
    'ВИРОБИ З KPI <95%'
  );


  const badProducts =
    products.filter(
      p =>
        p.performancePct !== null &&
        p.performancePct < 95
    );


  if (
    badProducts.length === 0
  ) {

    lines.push(
      '• немає'
    );

  } else {

    badProducts.forEach(
      p => {

        lines.push(
          `• ${p.product}: ` +
          `${p.actualQty} шт; ` +
          `факт ${
            p.actualHours
          } год; ` +
          `норматив ${
            p.normHoursForActual
          } год; ` +
          `KPI ${
            reportPct_(
              p.performancePct
            )
          }`
        );

      }
    );

  }


  /*
   * Допоміжні роботи
   */

  lines.push('');
  lines.push(
    'ДОПОМІЖНИЙ ЧАС'
  );


  if (
    auxiliary.totalHours === 0
  ) {

    lines.push(
      '• немає'
    );

  } else {

    auxiliary.byType
      .forEach(
        item => {

          lines.push(
            `• ${
              auxiliaryTypeLabel_(
                item.name
              )
            }: ${
              item.hours
            } год`
          );

        }
      );

  }
}

function buildWeeklyReportText_(
  anchorDate
) {

  return (
    buildPeriodReportTextFromPackage_(

      buildWeeklyReportPackage_(
        anchorDate
      )

    )
  );
}

function buildMonthlyReportText_(
  anchorDate
) {

  return (
    buildPeriodReportTextFromPackage_(

      buildMonthlyReportPackage_(
        anchorDate
      )

    )
  );
}


// ЗАДАЧА 1. Щоденний аналіз виконання змінних завдань

function buildDailyProcess_(
  relevantRows,
  process
) {

  const processRows =
    relevantRows.filter(
      r =>
        r.process ===
        process
    );


  const production =
    processRows.filter(
      r =>
        r.activityType ===
          'PRODUCTION' &&
        r.kpiReady &&
        r.machine
    );


  const nonProductive =
    processRows.filter(
      r =>
        r.activityType ===
          'NON_PRODUCTIVE' &&
        r.machine
    );


  const pending =
    processRows.filter(
      r =>
        r.activityType ===
        'PENDING'
    );


  const excludedCompleted =
    processRows.filter(
      r =>
        r.activityType ===
        'INVALID'
    );


  /*
   * До верстата передаємо
   * виробництво +
   * ненормований час.
   */

  const accountedRows =

    production.concat(
      nonProductive
    );


  const byMachine =
    new Map();


  accountedRows.forEach(
    r => {

      if (
        !byMachine.has(
          r.machine
        )
      ) {

        byMachine.set(
          r.machine,
          []
        );
      }


      byMachine
        .get(r.machine)
        .push(r);

    }
  );


  const allMachines =

    [
      ...byMachine.entries()
    ]

    .map(
      ([machine, rows]) =>

        buildMachineSummary_(
          machine,
          rows
        )
    )

    .sort(
      sortByMachine_
    );


  /*
   * До категорій KPI
   * потрапляють лише верстати,
   * на яких було нормоване
   * виробництво.
   */

  const machines =
    allMachines.filter(
      m =>
        m.productionRowCount > 0
    );


  const nonProductiveOnlyMachines =
    allMachines.filter(
      m =>
        m.productionRowCount === 0
    );


  return {

    machineCount:
      machines.length,

    taskRowCount:
      processRows.length,

    eligibleRowCount:
      production.length,

    nonProductiveRowCount:
      nonProductive.length,

    pendingRowCount:
      pending.length,

    excludedCompletedRowCount:
      excludedCompleted.length,


    above95:

      machines.filter(
        m =>
          m.performanceBand ===
          'ABOVE_95'
      ),


    between90and95:

      machines.filter(
        m =>
          m.performanceBand ===
          'BETWEEN_90_95'
      ),


    below90:

      machines.filter(
        m =>
          m.performanceBand ===
          'BELOW_90'
      ),


    highDefect:

      machines.filter(
        m =>
          m.highDefect
      ),


    machines,

    nonProductiveOnlyMachines

  };
}

// Головна функція денного аналізу:

function buildDailyAnalysis_(
  dateInput,
  shiftInput
) {

  const started =
    Date.now();


  const date =
    normalizeDateInput_(
      dateInput
    );


  const shift =
    Number(
      shiftInput
    );


  if (
    shift !== 1 &&
    shift !== 2
  ) {

    throw new Error(
      'Зміна повинна бути 1 або 2.'
    );
  }


  const data =
    loadAnalyticsData_();


  const relevantRows =

    data.records.filter(
      r =>

        r.date === date &&

        r.shift === shift
    );

  const productShieldMap =
    buildProductShieldMap_();


  const qualityAnalysis =
    buildQualityAnalysis_(
      relevantRows,
      data.records,
      productShieldMap
    );

  const quality =
    buildQualityAIContext_(
      qualityAnalysis
    );

  const relevantWarnings =

    data.warnings.filter(
      w =>

        w.date === date &&

        w.shift === shift
    );


  const result = {

    reportType:
      'DAILY',

    date,

    shift,

    generatedAt:
      Utilities.formatDate(
        new Date(),
        CFG.TIMEZONE,
        "yyyy-MM-dd'T'HH:mm:ss"
      ),


    /*
     * ОКРЕМО
     * ПРЕСУВАННЯ
     */

    press:
      buildDailyProcess_(
        relevantRows,
        'PRESS'
      ),


    /*
     * ОКРЕМО
     * ЧПУ
     */

    cnc:
      buildDailyProcess_(
        relevantRows,
        'CNC'
      ),


    /*
     * ОКРЕМО
     * ЯКІСТЬ / ШЛІФУВАННЯ
     */

    quality,


    dataWarnings:
      relevantWarnings,


    sourceStats: {

      relevantRows:
        relevantRows.length,

      completedRows:
        relevantRows.filter(
          r => r.isCompleted
        ).length,

      kpiReadyRows:
        relevantRows.filter(
          r => r.kpiReady
        ).length,

      qualityReadyRows:
        relevantRows.filter(
          r =>
            r.process === 'SANDING' &&
            r.qualityReady === true
        ).length

    }

  };


  logRun_(
    'DAILY',
    `${date}|SHIFT${shift}`,
    result.sourceStats,
    result.dataWarnings.length,
    'OK',
    Date.now() - started,
    ''
  );


  return result;
}
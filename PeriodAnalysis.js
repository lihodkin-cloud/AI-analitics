//універсальне групування

function groupRows_(
  rows,
  keyFn
) {

  const map =
    new Map();


  rows.forEach(
    r => {

      const key =
        keyFn(r);


      if (
        !map.has(key)
      ) {

        map.set(
          key,
          []
        );
      }


      map.get(key)
        .push(r);

    }
  );


  return map;
}

// ПРАЦІВНИК × ЗМІНА
// Це дуже важлива частина.
// Ми не рахуємо рядки.
// Рахуємо:
// Працівник + Дата + Зміна

function buildWorkerShiftMetrics_(
  rows,
  includeProcess
) {

  const valid =
  rows.filter(
    r =>
      r.worker &&
      (
        r.activityType ===
          'PRODUCTION' ||
        r.activityType ===
          'NON_PRODUCTIVE'
      )
  );

  const groups =
    groupRows_(
      valid,

      r => {

        const base =
          `${r.worker}|${r.date}|${r.shift}`;


        return includeProcess

          ? `${base}|${r.process}`

          : base;
      }
    );


  return [

    ...groups.values()

  ].map(
    group => {

      const first =
        group[0];


      const metrics =
        summarizeKpiRows_(
          group
        );


      return {

        worker:
          first.worker,

        date:
          first.date,

        shift:
          first.shift,

        process:
          includeProcess
            ? first.process
            : 'ALL',

        ...metrics

      };
    }
  )
   .filter(
      item =>
      item.productionRowCount > 0
  );
}

// підрахунок кількості змін

function summarizeWorkerShifts_(
  workerShiftRows
) {

  const byWorker =
    groupRows_(
      workerShiftRows,
      r => r.worker
    );


  return [

    ...byWorker.entries()

  ]

  .map(
    ([worker, shifts]) => {

      const totals = {

        above95: 0,

        between90and95: 0,

        below90: 0,

        defectAbove3: 0

      };


      shifts.forEach(
        s => {

          if (
            s.performanceBand ===
            'ABOVE_95'
          ) {

            totals.above95++;

          } else if (
            s.performanceBand ===
            'BETWEEN_90_95'
          ) {

            totals.between90and95++;

          } else if (
            s.performanceBand ===
            'BELOW_90'
          ) {

            totals.below90++;
          }


          if (
            s.highDefect
          ) {

            totals.defectAbove3++;
          }

        }
      );


      /*
       * Загальний KPI
       * за весь період
       */

      const totalActualHours =
        shifts.reduce(
          (a, s) =>
            a +
            (s.actualHours || 0),
          0
        );


      const totalNormHours =
        shifts.reduce(
          (a, s) =>
            a +
            (
              s.normHoursForActual ||
              0
            ),
          0
        );


      const overallPerformancePct =

        totalActualHours > 0

          ? (
              totalNormHours /
              totalActualHours
            ) * 100

          : null;


      return {

        worker,

        shiftsTotal:
          shifts.length,

        ...totals,

        overallPerformancePct:
          round_(
            overallPerformancePct,
            1
          )

      };

    }
  )

  .sort(
    (a, b) =>
      a.worker.localeCompare(
        b.worker,
        'uk'
      )
  );
}

// АНАЛІЗ ПО ВИРОБАХ

function summarizeProducts_(
  rows
) {

  const valid =
    rows.filter(
      r =>
        r.activityType ===
          'PRODUCTION' &&
        r.kpiReady &&
        r.product
    );

  /*
   * Важливо:
   *
   * Пресування одного виробу
   * і ЧПУ того самого виробу
   * — різні KPI.
   */

  const groups =
    groupRows_(
      valid,

      r =>
        `${r.process}|${r.product}`
    );


  const out = {

    PRESS: [],

    CNC: []

  };


  [
    ...groups.values()
  ]
  .forEach(
    group => {

      const first =
        group[0];


      const metrics =
        summarizeKpiRows_(
          group
        );


      const shiftKeys =
        new Set(

          group.map(
            r =>
              `${r.date}|${r.shift}`
          )

        );


      out[
        first.process
      ].push({

        product:
          first.product,

        ...metrics,

        shiftCount:
          shiftKeys.size,

        machines:
          uniqueNonBlank_(
            group.map(
              r => r.machine
            )
          ),

        workers:
          uniqueNonBlank_(
            group.map(
              r => r.worker
            )
          )

      });

    }
  );


  /*
   * Найнижча продуктивність
   * буде зверху.
   *
   * Це буде зручно для AI.
   */

  [
    'PRESS',
    'CNC'
  ]
  .forEach(
    process => {

      out[
        process
      ].sort(
        (a, b) => {

          const ap =
            a.performancePct ===
              null
              ? Infinity
              : a.performancePct;

          const bp =
            b.performancePct ===
              null
              ? Infinity
              : b.performancePct;


          return (
            ap -
            bp
          ) ||
          a.product.localeCompare(
            b.product,
            'uk'
          );
        }
      );

    }
  );


  return out;
}

// ДОПОМІЖНИЙ АНАЛІЗ ДО АНАЛІЗУ ПЕРІОДУ

function summarizeAuxiliaryWork_(
  rows
) {

  const auxRows =
    rows.filter(
      r =>
        r.activityType ===
        'NON_PRODUCTIVE' &&
        r.actualHours !== null &&
        r.actualHours > 0
    );


  return {

    press:
      summarizeAuxiliaryProcess_(
        auxRows.filter(
          r => r.process === 'PRESS'
        )
      ),

    cnc:
      summarizeAuxiliaryProcess_(
        auxRows.filter(
          r => r.process === 'CNC'
        )
      )

  };
}


function summarizeAuxiliaryProcess_(
  rows
) {

  const totalHours =
    rows.reduce(
      (sum, r) =>
        sum +
        (r.actualHours || 0),
      0
    );


  function aggregate_(field) {

    const map =
      new Map();


    rows.forEach(
      r => {

        let key =
          r[field];


        if (!key) {

          key =
            field === 'nonProductiveType'
              ? 'OTHER'
              : '(не зазначено)';
        }


        const old =
          map.get(key) || {
            hours: 0,
            count: 0
          };


        old.hours +=
          r.actualHours || 0;

        old.count++;


        map.set(
          key,
          old
        );

      }
    );


    return [

      ...map.entries()

    ]
    .map(
      ([name, value]) => ({

        name,

        hours:
          round_(
            value.hours,
            2
          ),

        count:
          value.count

      })
    )
    .sort(
      (a, b) =>
        b.hours -
        a.hours
    );
  }


  return {

    totalHours:
      round_(
        totalHours,
        2
      ),

    activityCount:
      rows.length,

    byType:
      aggregate_(
        'nonProductiveType'
      ),

    byMachine:
      aggregate_(
        'machine'
      ),

    byWorker:
      aggregate_(
        'worker'
      ),

    activities:

      rows.map(
        r => ({

          row:
            r.sourceRow,

          date:
            r.date,

          shift:
            r.shift,

          machine:
            r.machine,

          worker:
            r.worker,

          activity:
            r.product,

          activityType:
            r.nonProductiveType ||
            'OTHER',

          hours:
            round_(
              r.actualHours,
              2
            )

        })
      )

  };
}

// ГОЛОВНИЙ АНАЛІЗ ПЕРІОДУ

function buildPeriodAnalysis_(
  fromInput,
  toInput,
  reportType
) {

  const started =
    Date.now();


  const from =
    normalizeDateInput_(
      fromInput
    );


  const to =
    normalizeDateInput_(
      toInput
    );


  if (
    from > to
  ) {

    throw new Error(
      `Початкова дата ${from} ` +
      `більша за кінцеву ${to}.`
    );
  }


  const data =
    loadAnalyticsData_();


  const rows =
    data.records.filter(
      r =>
        inDateRange_(
          r.date,
          from,
          to
        )
    );


  const warnings =
    data.warnings.filter(
      w =>
        inDateRange_(
          w.date,
          from,
          to
        )
    );


  /*
   * Працівник:
   *
   * загалом
   */

  const workerOverallShiftRows =
    buildWorkerShiftMetrics_(
      rows,
      false
    );


  /*
   * Працівник:
   *
   * окремо
   * PRESS / CNC
   */

  const workerProcessShiftRows =
    buildWorkerShiftMetrics_(
      rows,
      true
    );
  
  const productShieldMap =
    buildProductShieldMap_();


  const qualityAnalysis =
    buildQualityAnalysis_(
      rows,
      data.records,
      productShieldMap
    );


  const quality =
    buildQualityAIContext_(
      qualityAnalysis
    );

  const result = {

    reportType:
      reportType ||
      'PERIOD',


    period: {
      from,
      to
    },

    processSummary: {

      press:
        summarizeKpiRows_(

          rows.filter(
            r =>
              r.process ===
              'PRESS'
          )

        ),

      cnc:
        summarizeKpiRows_(

          rows.filter(
            r =>
              r.process ===
              'CNC'
          )

        )

    },


    auxiliary:
      summarizeAuxiliaryWork_(
        rows
      ),

    generatedAt:
      Utilities.formatDate(
        new Date(),
        CFG.TIMEZONE,
        "yyyy-MM-dd'T'HH:mm:ss"
      ),


    workers: {

      overall:
        summarizeWorkerShifts_(
          workerOverallShiftRows
        ),


      press:
        summarizeWorkerShifts_(

          workerProcessShiftRows
            .filter(
              r =>
                r.process ===
                'PRESS'
            )

        ),


      cnc:
        summarizeWorkerShifts_(

          workerProcessShiftRows
            .filter(
              r =>
                r.process ===
                'CNC'
            )

        )

    },


    products:
      summarizeProducts_(
        rows
      ),

    quality,

    dataWarnings:
      warnings,


    sourceStats: {

      relevantRows:
        rows.length,

      completedRows:
        rows.filter(
          r =>
            r.isCompleted
        ).length,

      kpiReadyRows:
        rows.filter(
          r =>
            r.kpiReady
        ).length,

      qualityReadyRows:
        rows.filter(
          r =>
            r.process === 'SANDING' &&
            r.qualityReady === true
        ).length

    }

  };


  logRun_(
    result.reportType,
    `${from}|${to}`,
    result.sourceStats,
    warnings.length,
    'OK',
    Date.now() - started,
    ''
  );


  return result;
}

// ТИЖДЕНЬ

function buildWeeklyAnalysis_(
  anchorDate
) {

  const range =
    getProductionWeekRange_(
      anchorDate
    );


  return (
    buildPeriodAnalysis_(
      range.from,
      range.to,
      'WEEKLY'
    )
  );
}

// МІСЯЦЬ

function buildMonthlyAnalysis_(
  anchorDate
) {

  const range =
    getMonthRange_(
      anchorDate
    );


  return buildPeriodAnalysis_(

    range.from,

    range.to,

    'MONTHLY'

  );
}
// РОЗРАХУНОК БРАКУ

function calculateDefectPct_(
  actualQty,
  defectQty
) {

  if (
    actualQty === null ||
    actualQty < 0
  ) {

    return null;
  }


  let defect =
    defectQty;


  if (
    defect === null &&
    CFG.BLANK_DEFECT_AS_ZERO
  ) {

    defect = 0;
  }


  if (
    defect === null ||
    defect < 0
  ) {

    return null;
  }


  let denominator;


  if (
    CFG.DEFECT_MODE ===
    'ACTUAL_INCLUDES_DEFECT'
  ) {

    denominator =
      actualQty;

  } else {

    denominator =
      actualQty +
      defect;
  }


  if (
    denominator <= 0
  ) {

    return defect > 0
      ? 100
      : 0;
  }


  return (
    defect /
    denominator
  ) * 100;
}

// Головна формула агрегування

function summarizeKpiRows_(
  rows
) {

  const productionRows =
    rows.filter(
      r =>
        r.activityType ===
        'PRODUCTION' &&
        r.kpiReady
    );


  const nonProductiveRows =
    rows.filter(
      r =>
        r.activityType ===
        'NON_PRODUCTIVE'
    );


  let actualQty = 0;

  let productiveHours = 0;

  let nonProductiveHours = 0;

  let normHours = 0;

  let planHours = 0;

  let defectQty = 0;


  productionRows.forEach(
    r => {

      actualQty +=
        r.actualQty || 0;


      productiveHours +=
        r.actualHours || 0;


      normHours +=
        r.normHoursForActual || 0;


      if (
        r.planHours !== null &&
        r.planHours > 0
      ) {

        planHours +=
          r.planHours;
      }


      if (
        r.defectQty !== null &&
        r.defectQty > 0
      ) {

        defectQty +=
          r.defectQty;
      }

    }
  );


  nonProductiveRows.forEach(
    r => {

      nonProductiveHours +=
        r.actualHours || 0;

    }
  );


  const totalRecordedHours =

    productiveHours +
    nonProductiveHours;


  /*
   * ОСНОВНИЙ KPI:
   *
   * тільки нормоване
   * виробництво.
   */

  const performancePct =

    productiveHours > 0

      ? (
          normHours /
          productiveHours
        ) * 100

      : null;


  /*
   * ДОДАТКОВИЙ KPI:
   *
   * нормативні години /
   * весь зафіксований час.
   *
   * Поки НЕ використовуємо
   * для категорій >95 тощо.
   */

  const shiftEfficiencyPct =

    totalRecordedHours > 0

      ? (
          normHours /
          totalRecordedHours
        ) * 100

      : null;


  const defectPct =
    calculateDefectPct_(
      actualQty,
      defectQty
    );


  return {

    actualQty:
      round_(
        actualQty,
        2
      ),


    /*
     * Для сумісності
     * actualHours залишається
     * продуктивним часом.
     */

    actualHours:
      round_(
        productiveHours,
        2
      ),

    productiveHours:
      round_(
        productiveHours,
        2
      ),

    nonProductiveHours:
      round_(
        nonProductiveHours,
        2
      ),

    totalRecordedHours:
      round_(
        totalRecordedHours,
        2
      ),

    normHoursForActual:
      round_(
        normHours,
        2
      ),

    scheduledPlanHours:
      round_(
        planHours,
        2
      ),

    performancePct:
      round_(
        performancePct,
        1
      ),

    shiftEfficiencyPct:
      round_(
        shiftEfficiencyPct,
        1
      ),

    performanceBand:
      classifyPerformance_(
        performancePct
      ),

    defectQty:
      round_(
        defectQty,
        2
      ),

    defectPct:
      round_(
        defectPct,
        2
      ),

    highDefect:

      defectPct !== null &&

      defectPct >
        CFG.THRESHOLDS
          .DEFECT_GT,

    productionRowCount:
      productionRows.length,

    nonProductiveRowCount:
      nonProductiveRows.length

  };
}

// Деталі завдання

function taskDetail_(r) {

  return {

    row:
      r.sourceRow,

    order:
      r.order,

    product:
      r.product,

    worker:
      r.worker,

    normPerHour:
      r.normPerHour,

    planHours:
      round_(
        r.planHours,
        2
      ),

    actualHours:
      round_(
        r.actualHours,
        2
      ),

    planQty:
      round_(
        r.planQty,
        2
      ),

    actualQty:
      round_(
        r.actualQty,
        2
      ),

    defectQty:
      round_(
        r.defectQty || 0,
        2
      ),

    performancePct:
      round_(
        r.calculatedPerformancePct,
        1
      ),

    defectPct:
      round_(
        r.defectPct,
        2
      ),

    reason:
      r.reason

  };
}

// агрегування верстата

function buildMachineSummary_(
  machine,
  rows
) {

  /*
   * У машинну статистику
   * включаємо лише:
   *
   * - нормоване виробництво
   * - допоміжні / ненормовані роботи
   *
   * QUALITY / SANDING сюди
   * не повинні потрапляти.
   */

  const machineRows =
    rows.filter(
      r =>
        r.activityType ===
          'PRODUCTION' ||
        r.activityType ===
          'NON_PRODUCTIVE'
    );


  const metrics =
    summarizeKpiRows_(
      machineRows
    );


  const productionRows =
    machineRows.filter(
      r =>
        r.activityType ===
        'PRODUCTION'
    );


  const nonProductiveRows =
    machineRows.filter(
      r =>
        r.activityType ===
        'NON_PRODUCTIVE'
    );


  return {

    machine,

    ...metrics,

    workers:
      uniqueNonBlank_(
        machineRows.map(
          r => r.worker
        )
      ),

    products:
      uniqueNonBlank_(
        productionRows.map(
          r => r.product
        )
      ),

    orders:
      uniqueNonBlank_(
        productionRows.map(
          r => r.order
        )
      ),

    reasons:
      uniqueNonBlank_(
        machineRows.map(
          r => r.reason
        )
      ),

    tasks:
      productionRows.map(
        taskDetail_
      ),

    taskExceptions:

      productionRows
        .filter(
          r =>
            r.calculatedPerformancePct !==
              null &&
            r.calculatedPerformancePct <
              90
        )
        .map(
          taskDetail_
        ),

    nonProductiveActivities:

      nonProductiveRows.map(
        nonProductiveDetail_
      )

  };
}

function sortByMachine_(
  a,
  b
) {

  return String(a.machine)
    .localeCompare(
      String(b.machine),
      'uk',
      {
        numeric: true,
        sensitivity: 'base'
      }
    );
}

function nonProductiveDetail_(r) {

  return {

    row:
      r.sourceRow,

    activity:
      r.product,

    activityType:
      r.nonProductiveType ||
      'OTHER',

    worker:
      r.worker,

    actualHours:
      round_(
        r.actualHours,
        2
      ),

    reason:
      r.reason

  };
}

function summarizeSandingRows_(
  rows
) {

  const qualityRows =
    rows.filter(
      row =>
        row.process ===
          'SANDING' &&
        row.activityType ===
          'QUALITY' &&
        row.qualityReady ===
          true
    );


  let goodQty =
    0;

  let defectQty =
    0;


  qualityRows.forEach(
    row => {

      goodQty +=
        num_(
          row.actualQty
        ) || 0;


      defectQty +=
        num_(
          row.defectQty
        ) || 0;

    }
  );


  const inspectedQty =
    goodQty +
    defectQty;


  const defectPct =
    inspectedQty > 0
      ? defectQty /
        inspectedQty *
        100
      : 0;


  return {

    rowCount:
      qualityRows.length,

    goodQty:
      goodQty,

    defectQty:
      defectQty,

    inspectedQty:
      inspectedQty,

    defectPct:
      round_(
        defectPct,
        1
      ),

    highDefect:
      defectPct >
      CFG.THRESHOLDS.DEFECT_GT

  };
}

function summarizeSandingProducts_(
  rows
) {

  const qualityRows =
    rows.filter(
      row =>
        row.process ===
          'SANDING' &&
        row.activityType ===
          'QUALITY' &&
        row.qualityReady ===
          true &&
        row.product
    );


  const groups =
    new Map();


  qualityRows.forEach(
    row => {

      const key =
        row.product;


      if (
        !groups.has(key)
      ) {

        groups.set(
          key,
          []
        );
      }


      groups
        .get(key)
        .push(row);

    }
  );


  const result = [];


  groups.forEach(
    (
      productRows,
      product
    ) => {

      const summary =
        summarizeSandingRows_(
          productRows
        );


      const shifts =
        uniqueNonBlank_(
          productRows.map(
            r =>
              r.date +
              '|' +
              r.shift
          )
        );


      const orders =
        uniqueNonBlank_(
          productRows.map(
            r => r.order
          )
        );


      const workers =
        uniqueNonBlank_(
          productRows.map(
            r => r.worker
          )
        );


      result.push({

        product,

        inspectedQty:
          summary.inspectedQty,

        goodQty:
          summary.goodQty,

        defectQty:
          summary.defectQty,

        defectPct:
          summary.defectPct,

        highDefect:
          summary.highDefect,

        shiftCount:
          shifts.length,

        orderCount:
          orders.length,

        orders,

        workers

      });

    }
  );


  result.sort(
    (a, b) =>
      b.defectPct -
      a.defectPct
  );


  return result;
}


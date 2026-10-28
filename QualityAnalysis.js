function buildSandingQualityCases_(
  periodRows,
  allRows,
  productShieldMap
) {

  const shieldMap =
    productShieldMap ||
    buildProductShieldMap_();


  const sandingRows =
    periodRows.filter(
      row =>
        row.process === 'SANDING' &&
        row.activityType === 'QUALITY' &&
        row.qualityReady === true
    );


  return sandingRows.map(
    row => {

      const goodQty =
        row.actualQty !== null
          ? row.actualQty
          : 0;


      const defectQty =
        row.defectQty !== null
          ? row.defectQty
          : 0;


      const inspectedQty =
        goodQty +
        defectQty;


      const defectPct =
        inspectedQty > 0
          ? (
              defectQty /
              inspectedQty
            ) * 100
          : 0;


      const traceability =
        buildSandingTraceability_(
          row,
          allRows,
          shieldMap
        );


      return {

        caseId:
          'SANDING_' +
          row.sourceRow,

        sourceRow:
          row.sourceRow,

        date:
          row.date,

        shift:
          row.shift,

        order:
          row.order,

        product:
          row.product,

        shield:
          traceability.shield || '',

        goodQty,

        defectQty,

        inspectedQty,

        defectPct,

        hasDefect:
          defectQty > 0,

        highDefect:
          defectPct >
          CFG.THRESHOLDS.DEFECT_GT,

        press:
          traceability.press,

        cnc:
          traceability.cnc

      };

    }
  );
}


/*
 * Загальні показники якості.
 */
function summarizeSandingQualityTotals_(
  cases
) {

  let goodQty = 0;
  let defectQty = 0;


  cases.forEach(
    item => {

      goodQty +=
        item.goodQty || 0;

      defectQty +=
        item.defectQty || 0;

    }
  );


  const inspectedQty =
    goodQty +
    defectQty;


  const defectPct =
    inspectedQty > 0
      ? (
          defectQty /
          inspectedQty
        ) * 100
      : 0;


  return {

    qualityCaseCount:
      cases.length,

    goodQty,

    defectQty,

    inspectedQty,

    defectPct,

    defectCaseCount:
      cases.filter(
        item =>
          item.hasDefect
      ).length,

    highDefectCaseCount:
      cases.filter(
        item =>
          item.highDefect
      ).length

  };
}


/*
 * Агрегація:
 *
 * замовлення + виріб.
 *
 * Важливо:
 * % браку рахуємо із сумарних
 * P та R, а не середнє
 * арифметичне відсотків.
 */
function summarizeSandingQualityByOrderProduct_(
  cases
) {

  const map =
    new Map();


  cases.forEach(
    item => {

      const key =
        String(
          item.order || ''
        ) +
        '|' +
        normalizeTraceabilityText_(
          item.product
        );


      if (
        !map.has(key)
      ) {

        map.set(
          key,
          {

            order:
              item.order,

            product:
              item.product,

            shield:
              item.shield || '',

            goodQty:
              0,

            defectQty:
              0,

            inspectedQty:
              0,

            qualityCaseCount:
              0,

            defectCaseCount:
              0,

            highDefectCaseCount:
              0,

            dates:
              new Set(),

            shifts:
              new Set()

          }
        );
      }


      const group =
        map.get(key);


      group.goodQty +=
        item.goodQty || 0;


      group.defectQty +=
        item.defectQty || 0;


      group.inspectedQty +=
        item.inspectedQty || 0;


      group.qualityCaseCount++;


      if (
        item.hasDefect
      ) {

        group.defectCaseCount++;
      }


      if (
        item.highDefect
      ) {

        group.highDefectCaseCount++;
      }


      if (
        item.date
      ) {

        group.dates.add(
          item.date
        );
      }


      if (
        item.date &&
        item.shift
      ) {

        group.shifts.add(
          item.date +
          '|' +
          item.shift
        );
      }

    }
  );


  const result =
    Array.from(
      map.values()
    )
      .map(
        group => {

          const defectPct =
            group.inspectedQty > 0
              ? (
                  group.defectQty /
                  group.inspectedQty
                ) * 100
              : 0;


          return {

            order:
              group.order,

            product:
              group.product,

            shield:
              group.shield,

            goodQty:
              group.goodQty,

            defectQty:
              group.defectQty,

            inspectedQty:
              group.inspectedQty,

            defectPct,

            highDefect:
              defectPct >
              CFG.THRESHOLDS.DEFECT_GT,

            qualityCaseCount:
              group.qualityCaseCount,

            defectCaseCount:
              group.defectCaseCount,

            highDefectCaseCount:
              group.highDefectCaseCount,

            dateCount:
              group.dates.size,

            shiftCount:
              group.shifts.size

          };

        }
      );


  /*
   * Спочатку найбільший
   * фактичний обсяг браку.
   *
   * Це безпечніше, ніж сортувати
   * лише за %, бо 1 бракована
   * деталь із 2 дала б 50%.
   */

  result.sort(
    (a, b) => {

      if (
        b.defectQty !==
        a.defectQty
      ) {

        return (
          b.defectQty -
          a.defectQty
        );
      }


      return (
        b.defectPct -
        a.defectPct
      );

    }
  );


  return result;
}


/*
 * Отримуємо унікальні
 * зв'язки одного випадку
 * шліфування з попередньою
 * операцією.
 *
 * dimension:
 *
 * MACHINE
 * WORKER
 * ASSIGNMENT
 */
function getQualityAssociationKeys_(
  qualityCase,
  process,
  dimension
) {

  const trace =
    process === 'PRESS'
      ? qualityCase.press
      : qualityCase.cnc;


  if (
    !trace ||
    !trace.assignments ||
    !trace.assignments.length
  ) {

    return [];
  }


  const map =
    new Map();


  trace.assignments.forEach(
    assignment => {

      const machine =
        normalizeTraceabilityText_(
          assignment.machine
        );


      const worker =
        normalizeTraceabilityText_(
          assignment.worker
        );


      let key = '';
      let value = null;


      if (
        dimension === 'MACHINE'
      ) {

        if (!machine) {

          return;
        }


        key =
          machine;


        value = {

          machine

        };

      } else if (
        dimension === 'WORKER'
      ) {

        if (!worker) {

          return;
        }


        key =
          worker;


        value = {

          worker

        };

      } else if (
        dimension ===
        'ASSIGNMENT'
      ) {

        if (
          !machine &&
          !worker
        ) {

          return;
        }


        key =
          machine +
          '|' +
          worker;


        value = {

          machine,
          worker

        };

      }


      if (
        key &&
        !map.has(key)
      ) {

        map.set(
          key,
          value
        );
      }

    }
  );


  return Array.from(
    map.entries()
  )
    .map(
      entry => ({

        key:
          entry[0],

        ...entry[1]

      })
    );
}


/*
 * Аналіз повторюваних
 * зв'язків:
 *
 * PRESS/CNC
 *
 * +
 *
 * MACHINE/WORKER/ASSIGNMENT
 *
 *
 * Важливо:
 *
 * один випадок браку
 * зараховується конкретному
 * верстату/працівнику
 * максимум ОДИН раз.
 */
function summarizeQualityAssociations_(
  cases,
  process,
  dimension
) {

  const map =
    new Map();


  cases.forEach(
    qualityCase => {

      const associations =
        getQualityAssociationKeys_(
          qualityCase,
          process,
          dimension
        );


      associations.forEach(
        association => {

          if (
            !map.has(
              association.key
            )
          ) {

            map.set(
              association.key,
              {

                process,

                dimension,

                machine:
                  association.machine || '',

                worker:
                  association.worker || '',

                caseIds:
                  new Set(),

                defectCaseIds:
                  new Set(),

                highDefectCaseIds:
                  new Set(),

                orders:
                  new Set(),

                products:
                  new Set(),

                linkedGoodQty:
                  0,

                linkedDefectQty:
                  0,

                linkedInspectedQty:
                  0

              }
            );
          }


          const group =
            map.get(
              association.key
            );


          /*
           * Захист від дублювання
           * одного випадку.
           */

          if (
            group.caseIds.has(
              qualityCase.caseId
            )
          ) {

            return;
          }


          group.caseIds.add(
            qualityCase.caseId
          );


          if (
            qualityCase.hasDefect
          ) {

            group.defectCaseIds.add(
              qualityCase.caseId
            );
          }


          if (
            qualityCase.highDefect
          ) {

            group.highDefectCaseIds.add(
              qualityCase.caseId
            );
          }


          if (
            qualityCase.order
          ) {

            group.orders.add(
              qualityCase.order
            );
          }


          if (
            qualityCase.product
          ) {

            group.products.add(
              qualityCase.product
            );
          }


          /*
           * Ці обсяги є лише
           * обсягами випадків,
           * ПОВ'ЯЗАНИХ із
           * конкретним обладнанням
           * або працівником.
           *
           * Їх НЕ МОЖНА складати
           * між різними групами.
           */

          group.linkedGoodQty +=
            qualityCase.goodQty || 0;


          group.linkedDefectQty +=
            qualityCase.defectQty || 0;


          group.linkedInspectedQty +=
            qualityCase.inspectedQty || 0;

        }
      );

    }
  );


  const result =
    Array.from(
      map.values()
    )
      .map(
        group => {

          const caseCount =
            group.caseIds.size;


          const defectCaseCount =
            group.defectCaseIds.size;


          const highDefectCaseCount =
            group.highDefectCaseIds.size;


          const linkedDefectPct =
            group.linkedInspectedQty > 0
              ? (
                  group.linkedDefectQty /
                  group.linkedInspectedQty
                ) * 100
              : 0;


          const highDefectCaseRatePct =
            caseCount > 0
              ? (
                  highDefectCaseCount /
                  caseCount
                ) * 100
              : 0;


          return {

            process:
              group.process,

            dimension:
              group.dimension,

            machine:
              group.machine,

            worker:
              group.worker,

            caseCount,

            defectCaseCount,

            highDefectCaseCount,

            highDefectCaseRatePct,

            orderCount:
              group.orders.size,

            productCount:
              group.products.size,

            linkedGoodQty:
              group.linkedGoodQty,

            linkedDefectQty:
              group.linkedDefectQty,

            linkedInspectedQty:
              group.linkedInspectedQty,

            linkedDefectPct

          };

        }
      );


  /*
   * Для пошуку повторюваності
   * насамперед дивимось
   * кількість випадків >3%.
   *
   * Потім — загальну кількість
   * пов'язаних випадків.
   */

  result.sort(
    (a, b) => {

      if (
        b.highDefectCaseCount !==
        a.highDefectCaseCount
      ) {

        return (
          b.highDefectCaseCount -
          a.highDefectCaseCount
        );
      }


      if (
        b.caseCount !==
        a.caseCount
      ) {

        return (
          b.caseCount -
          a.caseCount
        );
      }


      return (
        b.linkedDefectPct -
        a.linkedDefectPct
      );

    }
  );


  return result;
}


/*
 * Головна функція
 * етапу 9C.
 *
 * periodRows:
 * рядки поточного звіту
 * (день / тиждень / місяць)
 *
 * allRows:
 * ВСЯ доступна історія.
 *
 * Це принципово важливо,
 * тому що пресування або CNC
 * могли бути виконані раніше
 * за період звіту.
 */
function buildQualityAnalysis_(
  periodRows,
  allRows,
  productShieldMap
) {

  const shieldMap =
    productShieldMap ||
    buildProductShieldMap_();


  const cases =
    buildSandingQualityCases_(
      periodRows,
      allRows,
      shieldMap
    );


  const totals =
    summarizeSandingQualityTotals_(
      cases
    );


  const byOrderProduct =
    summarizeSandingQualityByOrderProduct_(
      cases
    );


  return {

    thresholdDefectPct:
      CFG.THRESHOLDS.DEFECT_GT,

    totals,

    cases,

    byOrderProduct,


    /*
     * PRESS
     */

    pressMachines:
      summarizeQualityAssociations_(
        cases,
        'PRESS',
        'MACHINE'
      ),

    pressWorkers:
      summarizeQualityAssociations_(
        cases,
        'PRESS',
        'WORKER'
      ),

    pressAssignments:
      summarizeQualityAssociations_(
        cases,
        'PRESS',
        'ASSIGNMENT'
      ),


    /*
     * CNC
     */

    cncMachines:
      summarizeQualityAssociations_(
        cases,
        'CNC',
        'MACHINE'
      ),

    cncWorkers:
      summarizeQualityAssociations_(
        cases,
        'CNC',
        'WORKER'
      ),

    cncAssignments:
      summarizeQualityAssociations_(
        cases,
        'CNC',
        'ASSIGNMENT'
      )

  };
}

function buildQualityAIContext_(
  qualityAnalysis
) {

  if (
    !qualityAnalysis ||
    !qualityAnalysis.totals
  ) {

    return null;
  }


  const totals =
    qualityAnalysis.totals;


  /*
   * Проблемні вироби.
   *
   * Беремо:
   * - брак > 3%
   * АБО
   * - найбільшу кількість
   *   фактичного браку.
   */

  const problemProducts =
    qualityAnalysis
      .byOrderProduct
      .filter(
        item =>
          item.defectQty > 0
      )
      .slice(0, 15)
      .map(
        item => ({

          order:
            item.order,

          product:
            item.product,

          shield:
            item.shield,

          inspectedQty:
            item.inspectedQty,

          defectQty:
            item.defectQty,

          defectPct:
            round_(
              item.defectPct,
              2
            ),

          highDefect:
            item.highDefect,

          qualityCaseCount:
            item.qualityCaseCount

        })
      );


  /*
   * Обладнання.
   */

  const pressMachines =
    qualityAnalysis
      .pressMachines
      .filter(
        item =>
          item.defectCaseCount > 0
      )
      .slice(0, 10)
      .map(
        item => ({

          machine:
            item.machine,

          caseCount:
            item.caseCount,

          defectCaseCount:
            item.defectCaseCount,

          highDefectCaseCount:
            item.highDefectCaseCount,

          highDefectCaseRatePct:
            round_(
              item.highDefectCaseRatePct,
              1
            ),

          linkedDefectPct:
            round_(
              item.linkedDefectPct,
              2
            )

        })
      );


  const cncMachines =
    qualityAnalysis
      .cncMachines
      .filter(
        item =>
          item.defectCaseCount > 0
      )
      .slice(0, 10)
      .map(
        item => ({

          machine:
            item.machine,

          caseCount:
            item.caseCount,

          defectCaseCount:
            item.defectCaseCount,

          highDefectCaseCount:
            item.highDefectCaseCount,

          highDefectCaseRatePct:
            round_(
              item.highDefectCaseRatePct,
              1
            ),

          linkedDefectPct:
            round_(
              item.linkedDefectPct,
              2
            )

        })
      );


  /*
   * Працівники.
   */

  const pressWorkers =
    qualityAnalysis
      .pressWorkers
      .filter(
        item =>
          item.defectCaseCount > 0
      )
      .slice(0, 15)
      .map(
        item => ({

          worker:
            item.worker,

          caseCount:
            item.caseCount,

          defectCaseCount:
            item.defectCaseCount,

          highDefectCaseCount:
            item.highDefectCaseCount,

          highDefectCaseRatePct:
            round_(
              item.highDefectCaseRatePct,
              1
            )

        })
      );


  const cncWorkers =
    qualityAnalysis
      .cncWorkers
      .filter(
        item =>
          item.defectCaseCount > 0
      )
      .slice(0, 15)
      .map(
        item => ({

          worker:
            item.worker,

          caseCount:
            item.caseCount,

          defectCaseCount:
            item.defectCaseCount,

          highDefectCaseCount:
            item.highDefectCaseCount,

          highDefectCaseRatePct:
            round_(
              item.highDefectCaseRatePct,
              1
            )

        })
      );


  /*
   * Тільки проблемні випадки
   * для детальної простежуваності.
   */

  const highDefectCases =
    qualityAnalysis
      .cases
      .filter(
        item =>
          item.highDefect
      )
      .slice(0, 20)
      .map(
        item => ({

          date:
            item.date,

          shift:
            item.shift,

          order:
            item.order,

          product:
            item.product,

          shield:
            item.shield,

          inspectedQty:
            item.inspectedQty,

          defectQty:
            item.defectQty,

          defectPct:
            round_(
              item.defectPct,
              2
            ),

          pressAssignments:
            item.press &&
            item.press.assignments
              ? item.press.assignments.map(
                  assignment => ({

                    machine:
                      assignment.machine,

                    worker:
                      assignment.worker

                  })
                )
              : [],

          cncAssignments:
            item.cnc &&
            item.cnc.assignments
              ? item.cnc.assignments.map(
                  assignment => ({

                    machine:
                      assignment.machine,

                    worker:
                      assignment.worker

                  })
                )
              : []

        })
      );


  return {

    thresholdDefectPct:
      qualityAnalysis
        .thresholdDefectPct,

    totals: {

      qualityCaseCount:
        totals.qualityCaseCount,

      inspectedQty:
        totals.inspectedQty,

      goodQty:
        totals.goodQty,

      defectQty:
        totals.defectQty,

      defectPct:
        round_(
          totals.defectPct,
          2
        ),

      defectCaseCount:
        totals.defectCaseCount,

      highDefectCaseCount:
        totals.highDefectCaseCount

    },

    problemProducts,

    equipment: {

      press:
        pressMachines,

      cnc:
        cncMachines

    },

    workers: {

      press:
        pressWorkers,

      cnc:
        cncWorkers

    },

    highDefectCases

  };
}
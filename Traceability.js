function buildSandingTraceability_(
  sandingRow,
  allRows,
  productShieldMap
) {

  if (
    !sandingRow ||
    !sandingRow.order ||
    !sandingRow.product
  ) {

    return {
      shield: '',
      press: null,
      cnc: null
    };
  }


  const shield =
    getShieldForProduct_(
      sandingRow.product,
      productShieldMap
    );


  const upstreamRows =
    findUpstreamRowsForSanding_(
      sandingRow,
      allRows,
      productShieldMap
    );


  return {

    shield,

    press:
      summarizeUpstreamProcess_(
        upstreamRows,
        'PRESS'
      ),

    cnc:
      summarizeUpstreamProcess_(
        upstreamRows,
        'CNC'
      )

  };
}

function summarizeUpstreamProcess_(
  rows,
  process
) {

  const processRows =
    rows.filter(
      row =>
        row.process === process
    );


  if (
    processRows.length === 0
  ) {

    return null;
  }


  const machines =
    uniqueNonBlank_(
      processRows.map(
        row => row.machine
      )
    );


  const workers =
    uniqueNonBlank_(
      processRows.map(
        row => row.worker
      )
    );


  const dates =
    uniqueNonBlank_(
      processRows.map(
        row => row.date
      )
    );


  const shifts =
    uniqueNonBlank_(
      processRows.map(
        row =>
          row.date +
          '|' +
          row.shift
      )
    );


  return {

    machines,

    workers,

    dates,

    shiftCount:
      shifts.length,

    rowCount:
      processRows.length

  };
}

function enrichSandingRowsWithTraceability_(
  sandingRows,
  allRows
) {

  return sandingRows.map(
    row => {

      const traceability =
        buildSandingTraceability_(
          row,
          allRows
        );


      return {

        ...row,

        upstream:
          traceability

      };
    }
  );
}

function isUpstreamBeforeSanding_(
  upstreamRow,
  sandingRow
) {

  if (
    !upstreamRow.date ||
    !sandingRow.date
  ) {

    return true;
  }


  if (
    upstreamRow.date <
    sandingRow.date
  ) {

    return true;
  }


  if (
    upstreamRow.date >
    sandingRow.date
  ) {

    return false;
  }


  /*
   * Та сама дата.
   * Операція попередньої стадії
   * не повинна бути пізніше
   * зміни шліфування.
   */

  const upstreamShift =
    Number(
      upstreamRow.shift
    );


  const sandingShift =
    Number(
      sandingRow.shift
    );


  if (
    !upstreamShift ||
    !sandingShift
  ) {

    return true;
  }


  return (
    upstreamShift <=
    sandingShift
  );
}

function findUpstreamRowsForSanding_(
  sandingRow,
  allRows,
  productShieldMap
) {

  const order =
    String(
      sandingRow.order || ''
    ).trim();


  const sandingProduct =
    normalizeTraceabilityText_(
      sandingRow.product
    );


  if (
    !order ||
    !sandingProduct
  ) {

    return [];
  }


  const sandingShield =
    getShieldForProduct_(
      sandingProduct,
      productShieldMap
    );


  return allRows.filter(
    row => {

      /*
       * Тільки PRESS / CNC.
       */

      if (
        row.process !== 'PRESS' &&
        row.process !== 'CNC'
      ) {

        return false;
      }


      if (
        row.activityType !==
        'PRODUCTION'
      ) {

        return false;
      }


      /*
       * Те саме замовлення.
       */

      if (
        String(
          row.order || ''
        ).trim() !== order
      ) {

        return false;
      }


      /*
       * Тільки операції,
       * які могли бути виконані
       * до шліфування.
       */

      if (
        !isUpstreamBeforeSanding_(
          row,
          sandingRow
        )
      ) {

        return false;
      }


      /*
       * CNC:
       * шукаємо точний виріб.
       */

      if (
        row.process === 'CNC'
      ) {

        const cncProduct =
          normalizeTraceabilityText_(
            row.product
          );


        return (
          cncProduct ===
          sandingProduct
        );
      }


      /*
       * PRESS:
       *
       * назва деталі може
       * відрізнятися,
       * тому порівнюємо
       * пресову заготовку / щит.
       */

      if (
        row.process === 'PRESS'
      ) {

        if (!sandingShield) {

          return false;
        }


        const pressShield =
          getShieldForProduct_(
            row.product,
            productShieldMap
          );


        return (
          pressShield &&
          pressShield ===
            sandingShield
        );
      }


      return false;

    }
  );
}

function summarizeUpstreamProcess_(
  rows,
  process
) {

  const processRows =
    rows.filter(
      row =>
        row.process === process
    );


  if (
    processRows.length === 0
  ) {

    return null;
  }


  /*
   * Групуємо не окремо
   * верстати і людей,
   * а конкретні пари:
   *
   * верстат + працівник.
   */

  const groups =
    new Map();


  processRows.forEach(
    row => {

      const machine =
        row.machine || '';

      const worker =
        row.worker || '';


      const key =
        machine +
        '|' +
        worker;


      if (
        !groups.has(key)
      ) {

        groups.set(
          key,
          {
            machine,
            worker,

            dates:
              new Set(),

            shifts:
              new Set(),

            rowCount:
              0,

            actualQty:
              0
          }
        );
      }


      const group =
        groups.get(key);


      if (row.date) {

        group.dates.add(
          row.date
        );
      }


      if (
        row.date &&
        row.shift
      ) {

        group.shifts.add(
          row.date +
          '|' +
          row.shift
        );
      }


      group.rowCount++;


      if (
        row.actualQty !== null
      ) {

        group.actualQty +=
          row.actualQty;
      }

    }
  );


  const assignments =
    Array.from(
      groups.values()
    )
      .map(
        group => ({

          machine:
            group.machine,

          worker:
            group.worker,

          dates:
            Array.from(
              group.dates
            ),

          shiftCount:
            group.shifts.size,

          rowCount:
            group.rowCount,

          actualQty:
            group.actualQty

        })
      );


  assignments.sort(
    (a, b) => {

      const machineCompare =
        String(a.machine)
          .localeCompare(
            String(b.machine)
          );


      if (
        machineCompare !== 0
      ) {

        return machineCompare;
      }


      return String(a.worker)
        .localeCompare(
          String(b.worker)
        );
    }
  );


  return {

    rowCount:
      processRows.length,

    assignments

  };
}
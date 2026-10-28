function getOrCreateLogSheet_() {

  const ss =
    getAnalyticsSpreadsheet_();


  let sh =
    ss.getSheetByName(
      CFG.LOG_SHEET
    );


  if (!sh) {

    sh =
      ss.insertSheet(
        CFG.LOG_SHEET
      );


    sh.getRange(
      1,
      1,
      1,
      8
    )
    .setValues([
      [
        'timestamp',
        'type',
        'period',
        'relevantRows',
        'kpiReadyRows',
        'warnings',
        'durationMs',
        'status/message'
      ]
    ]);

  }


  return sh;
}

function logRun_(
  type,
  period,
  stats,
  warningCount,
  status,
  durationMs,
  message
) {

  try {

    const sh =
      getOrCreateLogSheet_();


    sh.appendRow([

      new Date(),

      type,

      period,

      stats &&
      stats.relevantRows !==
        undefined
        ? stats.relevantRows
        : '',

      stats &&
      stats.kpiReadyRows !==
        undefined
        ? stats.kpiReadyRows
        : '',

      warningCount || 0,

      durationMs || '',

      `${status}${
        message
          ? ': ' + message
          : ''
      }`

    ]);

  } catch (err) {

    /*
     * Помилка LOG не повинна
     * зупиняти сам аналіз
     */

    console.error(
      'LOG error:',
      err
    );

  }
}

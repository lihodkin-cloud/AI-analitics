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


  const expected = ['timestamp', 'type', 'period', 'relevantRows',
    'kpiReadyRows', 'warnings', 'durationMs', 'status/message'];
  const actual = sh.getRange(1, 1, 1, 8).getValues()[0];
  if (expected.some((h, i) => actual[i] !== h)) {
    throw new Error('AI_LOG headers changed; refusing to append.');
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


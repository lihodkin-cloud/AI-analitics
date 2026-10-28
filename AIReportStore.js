// функції зберігання результатів

function getOrCreateAIReportSheet_() {

  const ss =
    getAnalyticsSpreadsheet_();


  let sheet =
    ss.getSheetByName(
      CFG.AI.REPORT_SHEET
    );


  if (!sheet) {

    sheet =
      ss.insertSheet(
        CFG.AI.REPORT_SHEET
      );
  }


  ensureAIReportHeaders_(
    sheet
  );


  return sheet;
}

function buildAIReportKey_(
  result
) {

  if (
    result.reportType ===
    'DAILY'
  ) {

    return (
      'DAILY|' +
      result.date +
      '|SHIFT_' +
      result.shift
    );
  }


  if (
    result.reportType ===
      'WEEKLY' ||
    result.reportType ===
      'MONTHLY'
  ) {

    return (
      result.reportType +
      '|' +
      result.period.from +
      '|' +
      result.period.to
    );
  }


  throw new Error(
    'Невідомий тип AI-звіту: ' +
    result.reportType
  );
}

function buildAIReportKey_(
  result
) {

  if (
    result.reportType ===
    'DAILY'
  ) {

    return (
      'DAILY|' +
      result.date +
      '|SHIFT_' +
      result.shift
    );
  }


  if (
    result.reportType ===
      'WEEKLY' ||
    result.reportType ===
      'MONTHLY'
  ) {

    return (
      result.reportType +
      '|' +
      result.period.from +
      '|' +
      result.period.to
    );
  }


  throw new Error(
    'Невідомий тип AI-звіту: ' +
    result.reportType
  );
}

function saveAIReport_(
  result
) {

  const sheet =
    getOrCreateAIReportSheet_();


  const reportKey =
    buildAIReportKey_(
      result
    );


  const existingRow =
    findAIReportRow_(
      sheet,
      reportKey
    );


  const now =
    new Date();


  let dateFrom = '';
  let dateTo = '';
  let shift = '';


  if (
    result.reportType ===
    'DAILY'
  ) {

    dateFrom =
      result.date;

    dateTo =
      result.date;

    shift =
      result.shift;

  } else {

    dateFrom =
      result.period.from;

    dateTo =
      result.period.to;

  }


  const usage =
    result.usage || {};


  const inputDetails =
    usage.input_tokens_details ||
    {};


  const outputDetails =
    usage.output_tokens_details ||
    {};


  /*
   * При оновленні звіту
   * не стираємо історію email.
   */

  let createdAt =
    now;

  let emailStatus =
    'PENDING';

  let emailSentAt =
    '';

  let emailRecipients =
    '';


  if (existingRow) {

    const oldValues =
      sheet
        .getRange(
          existingRow,
          1,
          1,
          20
        )
        .getValues()[0];


    if (oldValues[0]) {

      createdAt =
        oldValues[0];
    }


    /*
     * R, S, T
     */

    emailStatus =
      oldValues[17] || '';

    emailSentAt =
      oldValues[18] || '';

    emailRecipients =
      oldValues[19] || '';

  }


  const rowValues = [[

    createdAt,

    now,

    reportKey,

    result.reportType,

    dateFrom,

    dateTo,

    shift,

    result.aiText,

    result.model,

    result.responseId,

    usage.input_tokens || 0,

    inputDetails
      .cache_write_tokens || 0,

    inputDetails
      .cached_tokens || 0,

    usage.output_tokens || 0,

    outputDetails
      .reasoning_tokens || 0,

    usage.total_tokens || 0,

    'OK',

    emailStatus,

    emailSentAt,

    emailRecipients

  ]];


  let targetRow;
  let action;


  if (existingRow) {

    targetRow =
      existingRow;

    action =
      'UPDATED';

  } else {

    targetRow =
      sheet.getLastRow() + 1;

    action =
      'CREATED';
  }


  sheet
    .getRange(
      targetRow,
      1,
      1,
      rowValues[0].length
    )
    .setValues(
      rowValues
    );


  sheet
    .getRange(
      targetRow,
      8
    )
    .setWrap(
      true
    )
    .setVerticalAlignment(
      'top'
    );

  try {

    refreshAIDashboard_();

  } catch (err) {

    console.error(
       'DASHBOARD REFRESH ERROR: ' +
      err.message
    );
  }

  return {

    reportKey,

    row:
      targetRow,

    action

  };
}

function findAIReportRow_(
  sheet,
  reportKey
) {

  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {
    return null;
  }


  const found =
    sheet
      .getRange(
        2,
        3,
        lastRow - 1,
        1
      )
      .createTextFinder(
        reportKey
      )
      .matchEntireCell(
        true
      )
      .findNext();


  if (!found) {
    return null;
  }


  return found.getRow();
}

function ensureAIReportHeaders_(
  sheet
) {

  const headers = [

    'createdAt',
    'updatedAt',
    'reportKey',
    'reportType',
    'dateFrom',
    'dateTo',
    'shift',
    'aiText',
    'model',
    'responseId',
    'inputTokens',
    'cacheWriteTokens',
    'cachedTokens',
    'outputTokens',
    'reasoningTokens',
    'totalTokens',
    'status',

    'emailStatus',
    'emailSentAt',
    'emailRecipients'

  ];


  const firstCell =
    String(
      sheet
        .getRange(1, 1)
        .getValue() || ''
    ).trim();


  /*
   * Якщо аркуш старий і в першому рядку
   * ще немає заголовків —
   * вставляємо новий рядок зверху.
   */

  if (
    firstCell !== 'createdAt'
  ) {

    if (
      sheet.getLastRow() > 0
    ) {

      sheet.insertRowsBefore(
        1,
        1
      );
    }
  }


  /*
   * Завжди переписуємо повний набір заголовків.
   * Це безпечно:
   * дані починаються з рядка 2.
   */

  sheet
    .getRange(
      1,
      1,
      1,
      headers.length
    )
    .setValues([
      headers
    ]);


  sheet
    .getRange(
      1,
      1,
      1,
      headers.length
    )
    .setFontWeight(
      'bold'
    );


  sheet.setFrozenRows(
    1
  );


  /*
   * Зручні ширини колонок.
   */

  sheet.setColumnWidth(
    3,
    260
  );

  sheet.setColumnWidth(
    8,
    700
  );

  sheet.setColumnWidth(
    18,
    120
  );

  sheet.setColumnWidth(
    19,
    160
  );

  sheet.setColumnWidth(
    20,
    260
  );
}

function getStoredAIReport_(
  reportKey
) {

  const sheet =
    getOrCreateAIReportSheet_();


  const row =
    findAIReportRow_(
      sheet,
      reportKey
    );


  if (!row) {

    return null;
  }


  const v =
    sheet
      .getRange(
        row,
        1,
        1,
        20
      )
      .getValues()[0];


  return {

    row,

    createdAt:
      v[0],

    updatedAt:
      v[1],

    reportKey:
      v[2],

    reportType:
      v[3],

    dateFrom:
      v[4],

    dateTo:
      v[5],

    shift:
      v[6],

    aiText:
      v[7],

    model:
      v[8],

    responseId:
      v[9],

    inputTokens:
      v[10],

    outputTokens:
      v[13],

    totalTokens:
      v[15],

    status:
      v[16],

    emailStatus:
      v[17],

    emailSentAt:
      v[18],

    emailRecipients:
      v[19]

  };
}
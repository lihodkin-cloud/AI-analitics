function readStoredAIReports_() {

  const sheet =
    getOrCreateAIReportSheet_();

  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {
    return [];
  }


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        20
      )
      .getValues();


  return values
    .map(
      (v, index) => ({

        row:
          index + 2,

        createdAt:
          v[0],

        updatedAt:
          v[1],

        reportKey:
          String(v[2] || ''),

        reportType:
          String(v[3] || ''),

        dateFrom:
          v[4],

        dateTo:
          v[5],

        shift:
          v[6],

        aiText:
          String(v[7] || ''),

        model:
          String(v[8] || ''),

        status:
          String(v[16] || ''),

        emailStatus:
          String(v[17] || ''),

        emailSentAt:
          v[18],

        emailRecipients:
          String(v[19] || '')

      })
    )
    .filter(
      r =>
        r.reportKey !== ''
    );
}

function dashboardDateKey_(
  value
) {

  if (!value) {
    return '';
  }


  if (
    value instanceof Date
  ) {

    return Utilities.formatDate(
      value,
      CFG.TIMEZONE,
      'yyyy-MM-dd'
    );
  }


  return String(value)
    .substring(0, 10);
}


function dashboardDisplayDate_(
  value
) {

  const key =
    dashboardDateKey_(
      value
    );


  if (!key) {
    return '—';
  }


  const parts =
    key.split('-');


  if (
    parts.length !== 3
  ) {
    return key;
  }


  return (
    parts[2] +
    '.' +
    parts[1] +
    '.' +
    parts[0]
  );
}


function dashboardDateTime_(
  value
) {

  if (
    !value ||
    !(value instanceof Date)
  ) {

    return '—';
  }


  return Utilities.formatDate(
    value,
    CFG.TIMEZONE,
    'dd.MM.yyyy HH:mm'
  );
}

function getLatestDashboardReport_(
  reports,
  reportType,
  shift
) {

  const filtered =
    reports.filter(
      report => {

        if (
          report.reportType !==
          reportType
        ) {

          return false;
        }


        if (
          reportType === 'DAILY' &&
          Number(report.shift) !==
          Number(shift)
        ) {

          return false;
        }


        return true;
      }
    );


  filtered.sort(
    (a, b) => {

      const aDate =
        dashboardDateKey_(
          a.dateTo || a.dateFrom
        );

      const bDate =
        dashboardDateKey_(
          b.dateTo || b.dateFrom
        );


      return bDate.localeCompare(
        aDate
      );
    }
  );


  return filtered[0] || null;
}

function dashboardAIText_(
  report
) {

  if (!report) {

    return (
      'Звіт ще не сформований.'
    );
  }


  const text =
    report.aiText || '';


  const maxLength =
    3500;


  if (
    text.length <= maxLength
  ) {

    return text;
  }


  return (
    text.substring(
      0,
      maxLength
    ) +
    '\n\n…\n' +
    'Повний текст: AI_REPORTS, рядок ' +
    report.row
  );
}

function getOrCreateAIDashboardSheet_() {

  const ss =
    getAnalyticsSpreadsheet_();


  let sheet =
    ss.getSheetByName(
      CFG.AI.DASHBOARD_SHEET
    );


  if (!sheet) {

    sheet =
      ss.insertSheet(
        CFG.AI.DASHBOARD_SHEET
      );
  }


  return sheet;
}

function renderDashboardCard_(
  sheet,
  title,
  report,
  startRow,
  startColumn
) {

  const width =
    4;


  /*
   * Заголовок картки
   */

  const titleRange =
    sheet.getRange(
      startRow,
      startColumn,
      1,
      width
    );


  titleRange.merge();

  titleRange
    .setValue(
      title
    )
    .setFontWeight(
      'bold'
    )
    .setFontSize(
      13
    )
    .setBackground(
      '#d9eaf7'
    );


  /*
   * Метадані
   */

  let period =
    'Звіт ще не сформований';


  let email =
    '—';


  let updated =
    '—';


  if (report) {

    if (
      report.reportType ===
      'DAILY'
    ) {

      period =
        dashboardDisplayDate_(
          report.dateFrom
        ) +
        ' | зміна ' +
        report.shift;

    } else {

      period =
        dashboardDisplayDate_(
          report.dateFrom
        ) +
        ' — ' +
        dashboardDisplayDate_(
          report.dateTo
        );
    }


    email =
      report.emailStatus ||
      '—';


    updated =
      dashboardDateTime_(
        report.updatedAt
      );
  }


  const infoRange =
    sheet.getRange(
      startRow + 1,
      startColumn,
      2,
      width
    );


  infoRange.merge();

  infoRange
    .setValue(
      'Період: ' +
      period +
      '\n' +
      'Email: ' +
      email +
      ' | Оновлено: ' +
      updated
    )
    .setWrap(
      true
    )
    .setVerticalAlignment(
      'middle'
    );


  /*
   * AI-висновок
   */

const aiText =
  dashboardAIText_(
    report
  );


const textRange =
  sheet.getRange(
    startRow + 3,
    startColumn,
    8,
    width
  );


textRange.merge();

textRange
  .setValue(
    aiText
  )
  .setWrap(
    true
  )
  .setVerticalAlignment(
    'top'
  );


/*
 * Динамічно підбираємо
 * загальну висоту блоку.
 */

const totalHeight =
  getDashboardTextHeight_(
    aiText
  );


const rowHeight =
  Math.ceil(
    totalHeight / 8
  );


for (
  let row =
    startRow + 3;

  row <=
    startRow + 10;

  row++
) {

  sheet.setRowHeight(
    row,
    rowHeight
  );
}


textRange
  .setBorder(
    true,
    true,
    true,
    true,
    false,
    false
  );

}

function refreshAIDashboard_() {

  const sheet =
    getOrCreateAIDashboardSheet_();


  const reports =
    readStoredAIReports_();


  const dailyShift1 =
    getLatestDashboardReport_(
      reports,
      'DAILY',
      1
    );


  const dailyShift2 =
    getLatestDashboardReport_(
      reports,
      'DAILY',
      2
    );


  const weekly =
    getLatestDashboardReport_(
      reports,
      'WEEKLY'
    );


  const monthly =
    getLatestDashboardReport_(
      reports,
      'MONTHLY'
    );


  /*
   * Тимчасова діагностика.
   * Після перевірки можна прибрати.
   */

  console.log(
    'DASH SHIFT 1: ' +
    (
      dailyShift1
        ? dailyShift1.reportKey
        : 'NOT FOUND'
    )
  );


  console.log(
    'DASH SHIFT 2: ' +
    (
      dailyShift2
        ? dailyShift2.reportKey
        : 'NOT FOUND'
    )
  );


  /*
   * Dashboard будується повністю заново.
   *
   * Важливо:
   * clear() не завжди прибирає merge,
   * тому спочатку роз'єднуємо старі
   * merged ranges.
   */

  sheet
    .getRange(
      1,
      1,
      sheet.getMaxRows(),
      sheet.getMaxColumns()
    )
    .breakApart();


  sheet.clear();


  /*
   * Ширина колонок A:H
   */

  for (
    let col = 1;
    col <= 8;
    col++
  ) {

    sheet.setColumnWidth(
      col,
      150
    );
  }


  /*
   * ==========================
   * ЗАГОЛОВОК
   * ==========================
   */

  const title =
    sheet.getRange(
      'A1:H1'
    );


  title.merge();


  title
    .setValue(
      'AI-АНАЛІТИКА ВИРОБНИЦТВА'
    )
    .setFontSize(
      18
    )
    .setFontWeight(
      'bold'
    )
    .setHorizontalAlignment(
      'center'
    )
    .setBackground(
      '#1f4e78'
    )
    .setFontColor(
      '#ffffff'
    );


  /*
   * ==========================
   * СТАН СИСТЕМИ
   * ==========================
   */

  const pendingEmails =
    reports.filter(
      r =>
        r.emailStatus ===
          'PENDING' ||
        r.emailStatus ===
          'ERROR' ||
        r.emailStatus ===
          'WAITING_QUOTA'
    ).length;


  sheet
    .getRange(
      'A2:H2'
    )
    .merge()
    .setValue(
      'Оновлено: ' +
      Utilities.formatDate(
        new Date(),
        CFG.TIMEZONE,
        'dd.MM.yyyy HH:mm:ss'
      ) +
      '   |   ' +
      'Звітів: ' +
      reports.length +
      '   |   ' +
      'Email у черзі/з помилкою: ' +
      pendingEmails
    )
    .setHorizontalAlignment(
      'center'
    );


  /*
   * ==========================
   * ВЕРХНІ КАРТКИ
   * ==========================
   */

  renderDashboardCard_(
    sheet,
    '1 ЗМІНА',
    dailyShift1,
    4,
    1
  );


  renderDashboardCard_(
    sheet,
    '2 ЗМІНА',
    dailyShift2,
    4,
    5
  );


  /*
   * ==========================
   * НИЖНІ КАРТКИ
   * ==========================
   */

  renderDashboardCard_(
    sheet,
    'ТИЖНЕВИЙ ЗВІТ',
    weekly,
    16,
    1
  );


  renderDashboardCard_(
    sheet,
    'МІСЯЧНИЙ ЗВІТ',
    monthly,
    16,
    5
  );


  /*
   * ==========================
   * ІСТОРІЯ
   * ==========================
   */

  renderDashboardHistory_(
    sheet,
    reports,
    29
  );


  /*
   * Спочатку повинні бути
   * повністю готові:
   *
   * 1 зміна
   * 2 зміна
   * тиждень
   * місяць
   * історія
   *
   * І тільки ПІСЛЯ цього
   * додаємо блоки якості.
   */

  const qualityEndRow =
    renderDashboardQualityPanel_(
      sheet,
      reports
    );


  renderDashboardEquipmentSignals_(
    sheet,
    reports,
    qualityEndRow + 2
  );


  /*
   * Закріплення шапки
   */

  sheet.setFrozenRows(
    2
  );


  SpreadsheetApp.flush();
}

function renderDashboardHistory_(
  sheet,
  reports,
  startRow
) {

  sheet
    .getRange(
      startRow,
      1,
      1,
      8
    )
    .merge()
    .setValue(
      'ОСТАННІ AI-ЗВІТИ'
    )
    .setFontWeight(
      'bold'
    )
    .setFontSize(
      13
    )
    .setBackground(
      '#d9eaf7'
    );


  const headers = [[

    'Тип',
    'Від',
    'До',
    'Зміна',
    'Оновлено',
    'Email',
    'Модель',
    'reportKey'

  ]];


  sheet
    .getRange(
      startRow + 1,
      1,
      1,
      8
    )
    .setValues(
      headers
    )
    .setFontWeight(
      'bold'
    );


  const sorted =
    reports
      .slice()
      .sort(
        (a, b) => {

          const aTime =
            a.updatedAt instanceof Date
              ? a.updatedAt.getTime()
              : 0;

          const bTime =
            b.updatedAt instanceof Date
              ? b.updatedAt.getTime()
              : 0;


          return bTime - aTime;
        }
      )
      .slice(
        0,
        20
      );


  if (
    sorted.length === 0
  ) {

    return;
  }


  const rows =
    sorted.map(
      report => [

        report.reportType,

        dashboardDisplayDate_(
          report.dateFrom
        ),

        dashboardDisplayDate_(
          report.dateTo
        ),

        report.shift || '',

        dashboardDateTime_(
          report.updatedAt
        ),

        report.emailStatus || '',

        report.model,

        report.reportKey

      ]
    );


  sheet
    .getRange(
      startRow + 2,
      1,
      rows.length,
      8
    )
    .setValues(
      rows
    );


  sheet
    .getRange(
      startRow + 1,
      1,
      rows.length + 1,
      8
    )
    .setBorder(
      true,
      true,
      true,
      true,
      true,
      true
    );
}

function getDashboardTextHeight_(
  text
) {

  text =
    String(text || '');


  const charsPerLine =
    75;


  const explicitLines =
    text.split('\n');


  let visualLines =
    0;


  explicitLines.forEach(
    line => {

      const length =
        Math.max(
          line.length,
          1
        );


      visualLines +=
        Math.max(
          1,
          Math.ceil(
            length /
            charsPerLine
          )
        );
    }
  );


  const pixelsPerLine =
    18;


  const padding =
    40;


  const height =
    visualLines *
      pixelsPerLine +
    padding;


  return Math.max(
    170,
    Math.min(
      height,
      1600
    )
  );
}

function clearDashboardQualityPanel_(
  sheet
) {

  const title =
    'ЯКІСТЬ / ШЛІФУВАННЯ';


  const found =
    sheet
      .createTextFinder(
        title
      )
      .matchEntireCell(true)
      .findNext();


  if (!found) {

    return;
  }


  const startRow =
    found.getRow();


  /*
   * Тільки очищаємо текст.
   *
   * НІЧОГО не merge /
   * unmerge.
   */

  sheet
    .getRange(
      startRow,
      1,
      20,
      6
    )
    .clearContent();
}

function getLatestQualityDashboardReport_(
  reports,
  reportType,
  shift
) {

  const filtered =
    reports.filter(
      report => {

        if (
          report.reportType !==
          reportType
        ) {

          return false;
        }


        if (
          shift !== undefined &&
          shift !== null
        ) {

          return (
            Number(report.shift) ===
            Number(shift)
          );
        }


        return true;
      }
    );


  if (
    filtered.length === 0
  ) {

    return null;
  }


  filtered.sort(
    (a, b) => {

      const aDate =
        String(
          a.updatedAt ||
          a.createdAt ||
          ''
        );


      const bDate =
        String(
          b.updatedAt ||
          b.createdAt ||
          ''
        );


      return bDate.localeCompare(
        aDate
      );
    }
  );


  return filtered[0];
}

function buildDashboardQualitySnapshot_(
  report,
  allRows,
  productShieldMap
) {

  if (!report) {
    return null;
  }


  const dateFrom =
    dashboardDateKey_(
      report.dateFrom
    );


  const dateTo =
    dashboardDateKey_(
      report.dateTo ||
      report.dateFrom
    );


  let rows = [];


  /*
   * DAILY
   */

  if (
    report.reportType ===
    'DAILY'
  ) {

    rows =
      allRows.filter(
        row =>
          row.date === dateFrom &&
          Number(row.shift) ===
            Number(report.shift)
      );

  } else {

    /*
     * WEEKLY / MONTHLY
     */

    rows =
      allRows.filter(
        row =>
          inDateRange_(
            row.date,
            dateFrom,
            dateTo
          )
      );
  }


  const analysis =
    buildQualityAnalysis_(
      rows,
      allRows,
      productShieldMap
    );


  const quality =
    buildQualityAIContext_(
      analysis
    );


  return {

    reportType:
      report.reportType,

    shift:
      report.shift,

    /*
     * ВАЖЛИВО:
     * тут уже повертаємо
     * нормалізовані yyyy-MM-dd.
     */

    dateFrom,

    dateTo,

    quality

  };
}

function dashboardQualityLabel_(
  snapshot
) {

  if (!snapshot) {
    return '';
  }


  if (
    snapshot.reportType ===
    'DAILY'
  ) {

    return (
      snapshot.dateFrom +
      ' / зміна ' +
      snapshot.shift
    );
  }


  if (
    snapshot.reportType ===
    'WEEKLY'
  ) {

    return (
      'Тиждень ' +
      snapshot.dateFrom +
      ' – ' +
      snapshot.dateTo
    );
  }


  if (
    snapshot.reportType ===
    'MONTHLY'
  ) {

    return (
      'Місяць ' +
      snapshot.dateFrom +
      ' – ' +
      snapshot.dateTo
    );
  }


  return snapshot.reportType;
}

function renderDashboardQualityPanel_(
  sheet,
  reports
) {

  const data =
    loadAnalyticsData_();


  const allRows =
    data.records || [];


  const productShieldMap =
    buildProductShieldMap_();


  /*
   * Останні звіти.
   */

  const daily1 =
    getLatestQualityDashboardReport_(
      reports,
      'DAILY',
      1
    );


  const daily2 =
    getLatestQualityDashboardReport_(
      reports,
      'DAILY',
      2
    );


  const weekly =
    getLatestQualityDashboardReport_(
      reports,
      'WEEKLY'
    );


  const monthly =
    getLatestQualityDashboardReport_(
      reports,
      'MONTHLY'
    );


  const snapshots = [

    buildDashboardQualitySnapshot_(
      daily1,
      allRows,
      productShieldMap
    ),

    buildDashboardQualitySnapshot_(
      daily2,
      allRows,
      productShieldMap
    ),

    buildDashboardQualitySnapshot_(
      weekly,
      allRows,
      productShieldMap
    ),

    buildDashboardQualitySnapshot_(
      monthly,
      allRows,
      productShieldMap
    )

  ].filter(Boolean);


  /*
   * КРИТИЧНО:
   *
   * починаємо нижче
   * всіх існуючих merged ranges.
   */

  const startRow =
    getDashboardSafeAppendRow_(
      sheet
    );


  /*
   * =========================
   * ЗАГОЛОВОК
   * =========================
   *
   * НЕ ОБ'ЄДНУЄМО КЛІТИНКИ.
   */

  sheet
    .getRange(
      startRow,
      1
    )
    .setValue(
      'ЯКІСТЬ / ШЛІФУВАННЯ'
    )
    .setFontWeight('bold')
    .setFontSize(14);


  /*
   * =========================
   * ПІДСУМКИ
   * =========================
   */

  const headerRow =
    startRow + 1;


  sheet
    .getRange(
      headerRow,
      1,
      1,
      6
    )
    .setValues([
      [
        'Період',
        'Перевірено',
        'Брак',
        'Брак, %',
        'Випадки >3%',
        'Всього випадків'
      ]
    ])
    .setFontWeight(
      'bold'
    );


  const values =
    snapshots.map(
      snapshot => {

        const totals =
          snapshot.quality &&
          snapshot.quality.totals
            ? snapshot.quality.totals
            : {};


        return [

          dashboardQualityLabel_(
            snapshot
          ),

          totals.inspectedQty || 0,

          totals.defectQty || 0,

          totals.defectPct || 0,

          totals.highDefectCaseCount || 0,

          totals.qualityCaseCount || 0

        ];

      }
    );


  if (
    values.length > 0
  ) {

    sheet
      .getRange(
        headerRow + 1,
        1,
        values.length,
        6
      )
      .setValues(
        values
      );


    sheet
      .getRange(
        headerRow + 1,
        4,
        values.length,
        1
      )
      .setNumberFormat(
        '0.00"%"'
      );
  }


  /*
   * =========================
   * ОСТАННІ HIGH DEFECT
   * =========================
   */

  const highCases =
    allRows
      .filter(
        row =>
          row.process ===
            'SANDING' &&
          row.qualityReady ===
            true &&
          row.defectPct !==
            null &&
          row.defectPct >
            CFG.THRESHOLDS
              .DEFECT_GT
      )
      .sort(
        (a, b) => {

          if (
            a.date !== b.date
          ) {

            return String(
              b.date
            ).localeCompare(
              String(
                a.date
              )
            );
          }


          return (
            b.sourceRow -
            a.sourceRow
          );

        }
      )
      .slice(
        0,
        8
      );


  const problemStart =
    headerRow +
    values.length +
    3;


  /*
   * Знову:
   * НЕ merge.
   */

  sheet
    .getRange(
      problemStart,
      1
    )
    .setValue(
      'ОСТАННІ ВИПАДКИ БРАКУ > ' +
      CFG.THRESHOLDS.DEFECT_GT +
      '%'
    )
    .setFontWeight(
      'bold'
    );


  sheet
    .getRange(
      problemStart + 1,
      1,
      1,
      6
    )
    .setValues([
      [
        'Дата',
        'Зміна',
        'Замовлення',
        'Виріб',
        'Брак',
        'Брак, %'
      ]
    ])
    .setFontWeight(
      'bold'
    );


  const problemValues =
    highCases.map(
      row => [

        row.date,

        row.shift,

        row.order,

        row.product,

        row.defectQty || 0,

        round_(
          row.defectPct,
          2
        )

      ]
    );


  if (
    problemValues.length > 0
  ) {

    sheet
      .getRange(
        problemStart + 2,
        1,
        problemValues.length,
        6
      )
      .setValues(
        problemValues
      );


    sheet
      .getRange(
        problemStart + 2,
        6,
        problemValues.length,
        1
      )
      .setNumberFormat(
        '0.00"%"'
      );
  }


  /*
   * Форматування.
   */

  const totalRows =
    (
      problemStart +
      2 +
      problemValues.length
    ) -
    startRow +
    1;


  sheet
    .getRange(
      startRow,
      1,
      totalRows,
      6
    )
    .setVerticalAlignment(
      'middle'
    );


  /*
   * Не змінюємо ширину
   * основних колонок Dashboard.
   *
   * Тільки перенос тексту
   * у колонці виробу.
   */

  if (
    problemValues.length > 0
  ) {

    sheet
      .getRange(
        problemStart + 2,
        4,
        problemValues.length,
        1
      )
      .setWrap(
        true
      );
  }

  return (
  startRow +
  totalRows -
  1
  );
}


function getDashboardSafeAppendRow_(
  sheet
) {

  let lastRow =
    sheet.getLastRow();


  /*
   * Знаходимо найнижчу межу
   * будь-якого merged range
   * на аркуші.
   */

  const fullRange =
    sheet.getRange(
      1,
      1,
      sheet.getMaxRows(),
      sheet.getMaxColumns()
    );


  const mergedRanges =
    fullRange.getMergedRanges();


  mergedRanges.forEach(
    range => {

      const bottomRow =
        range.getRow() +
        range.getNumRows() -
        1;


      if (
        bottomRow > lastRow
      ) {

        lastRow =
          bottomRow;
      }

    }
  );


  return (
    lastRow + 2
  );
}

function renderDashboardEquipmentSignals_(
  sheet,
  reports,
  forcedStartRow
) {

  const monthly =
    getLatestQualityDashboardReport_(
      reports,
      'MONTHLY'
    );


  if (!monthly) {
    return;
  }


  const data =
    loadAnalyticsData_();


  const allRows =
    data.records || [];


  const productShieldMap =
    buildProductShieldMap_();


  const snapshot =
    buildDashboardQualitySnapshot_(
      monthly,
      allRows,
      productShieldMap
    );


  if (
    !snapshot ||
    !snapshot.quality
  ) {
    return;
  }


  /*
   * Для детальної статистики
   * обладнання потрібен повний
   * qualityAnalysis, а не лише
   * компактний AI-context.
   */

  const periodRows =
    allRows.filter(
      row =>
        inDateRange_(
          row.date,
          snapshot.dateFrom,
          snapshot.dateTo
        )
    );


  const qualityAnalysis =
    buildQualityAnalysis_(
      periodRows,
      allRows,
      productShieldMap
    );


  /*
   * Показуємо обладнання,
   * де є хоча б один
   * high-defect випадок.
   */

  const pressSignals =
    qualityAnalysis
      .pressMachines
      .filter(
        item =>
          item.highDefectCaseCount > 0
      )
      .slice(0, 5);


  const cncSignals =
    qualityAnalysis
      .cncMachines
      .filter(
        item =>
          item.highDefectCaseCount > 0
      )
      .slice(0, 5);


  /*
   * Розміщуємо нижче
   * вже намальованого Dashboard.
   *
   * Merge не використовуємо.
   */

  const startRow =
    forcedStartRow ||
    getDashboardSafeAppendRow_(
      sheet
    );

  sheet
    .getRange(
      startRow,
      1
    )
    .setValue(
      'СИГНАЛИ ОБЛАДНАННЯ — ' +
      snapshot.dateFrom +
      ' – ' +
      snapshot.dateTo
    )
    .setFontWeight('bold')
    .setFontSize(14);


  /*
   * =========================
   * PRESS
   * =========================
   */

  const pressHeaderRow =
    startRow + 2;


  sheet
    .getRange(
      pressHeaderRow,
      1
    )
    .setValue(
      'ПРЕСИ'
    )
    .setFontWeight('bold');


  sheet
    .getRange(
      pressHeaderRow + 1,
      1,
      1,
      5
    )
    .setValues([
      [
        'Обладнання',
        'Випадків',
        'High >3%',
        'High, %',
        'Пов’язаний брак, %'
      ]
    ])
    .setFontWeight('bold');


  const pressValues =
    pressSignals.map(
      item => [

        item.machine,

        item.caseCount,

        item.highDefectCaseCount,

        round_(
          item.highDefectCaseRatePct,
          1
        ),

        round_(
          item.linkedDefectPct,
          2
        )

      ]
    );


  if (
    pressValues.length > 0
  ) {

    sheet
      .getRange(
        pressHeaderRow + 2,
        1,
        pressValues.length,
        5
      )
      .setValues(
        pressValues
      );


    sheet
      .getRange(
        pressHeaderRow + 2,
        4,
        pressValues.length,
        2
      )
      .setNumberFormat(
        '0.00"%"'
      );
  }


  /*
   * =========================
   * CNC
   * =========================
   */

  const cncHeaderRow =
    pressHeaderRow +
    pressValues.length +
    4;


  sheet
    .getRange(
      cncHeaderRow,
      1
    )
    .setValue(
      'ЧПУ'
    )
    .setFontWeight('bold');


  sheet
    .getRange(
      cncHeaderRow + 1,
      1,
      1,
      5
    )
    .setValues([
      [
        'Обладнання',
        'Випадків',
        'High >3%',
        'High, %',
        'Пов’язаний брак, %'
      ]
    ])
    .setFontWeight('bold');


  const cncValues =
    cncSignals.map(
      item => [

        item.machine,

        item.caseCount,

        item.highDefectCaseCount,

        round_(
          item.highDefectCaseRatePct,
          1
        ),

        round_(
          item.linkedDefectPct,
          2
        )

      ]
    );


  if (
    cncValues.length > 0
  ) {

    sheet
      .getRange(
        cncHeaderRow + 2,
        1,
        cncValues.length,
        5
      )
      .setValues(
        cncValues
      );


    sheet
      .getRange(
        cncHeaderRow + 2,
        4,
        cncValues.length,
        2
      )
      .setNumberFormat(
        '0.00"%"'
      );
  }
}

function dashboardDateKey_(
  value
) {

  if (!value) {
    return '';
  }


  /*
   * Google Sheets часто повертає
   * дату як справжній Date object.
   */

  if (
    Object.prototype.toString.call(value) ===
      '[object Date]' &&
    !isNaN(value.getTime())
  ) {

    return Utilities.formatDate(
      value,
      CFG.TIMEZONE,
      'yyyy-MM-dd'
    );
  }


  const text =
    String(value).trim();


  /*
   * Вже нормальний dateKey.
   */

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {

    return text;
  }


  /*
   * Наприклад ISO:
   * 2026-08-31T21:00:00.000Z
   *
   * У Europe/Kyiv це буде
   * 2026-09-01.
   */

  const parsed =
    new Date(value);


  if (
    !isNaN(
      parsed.getTime()
    )
  ) {

    return Utilities.formatDate(
      parsed,
      CFG.TIMEZONE,
      'yyyy-MM-dd'
    );
  }


  return text;
}

function clearDashboardEquipmentSignals_(
  sheet
) {

  const found =
    sheet
      .createTextFinder(
        'СИГНАЛИ ОБЛАДНАННЯ'
      )
      .matchCase(false)
      .matchEntireCell(false)
      .findAll();


  if (
    !found ||
    found.length === 0
  ) {

    return;
  }


  found.forEach(
    cell => {

      const startRow =
        cell.getRow();


      const rowsToClear =
        Math.min(
          25,
          sheet.getMaxRows() -
            startRow +
            1
        );


      sheet
        .getRange(
          startRow,
          1,
          rowsToClear,
          6
        )
        .clearContent()
        .clearFormat();

    }
  );
}


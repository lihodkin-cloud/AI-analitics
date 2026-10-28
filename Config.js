// файл конфігурації аналітичних звітів

const CFG = Object.freeze({

  SPREADSHEET_ID:
    '1ToUu4PAyPkUdxfSDKudCIk_RCpuVzDF18qGK7QWJdCY',

  SOURCE_SHEET:
    'Завдання',

  HEADER_ROW:
    3,

  FIRST_DATA_ROW:
    4,

  // Читаємо A:U
  LAST_READ_COLUMN:
    21,

  TIMEZONE:
    'Europe/Kyiv',


  COL: Object.freeze({

    DATE: 2,             // B
    SHIFT: 3,            // C
    OPERATION: 5,        // E
    MACHINE: 6,          // F
    ORDER: 7,            // G
    PRODUCT: 9,          // I
    NORM_PER_HOUR: 11,   // K
    PLAN_HOURS: 12,      // L
    ACTUAL_HOURS: 13,    // M
    PLAN_QTY: 15,        // O
    ACTUAL_QTY: 16,      // P
    DEFECT_QTY: 18,      // R
    PERFORMANCE: 19,     // S
    WORKER: 20,          // T
    REASON: 21           // U

  }),


  OPERATION: Object.freeze({

    PRESS:
      'П',

    CNC:
      'Бачі',

    SANDING:
      'Ш'

  }),


  THRESHOLDS: Object.freeze({

    GOOD_GT:
      95,

    WATCH_MIN:
      90,

    DEFECT_GT:
      3,

    // Допустима різниця між S
    // і нашим розрахунком
    PERFORMANCE_TOLERANCE_PP:
      1

  }),


  /*
   * GOOD_PLUS_DEFECT:
   * P = придатна продукція
   * R = брак
   * % браку = R / (P + R)
   *
   * ACTUAL_INCLUDES_DEFECT:
   * P вже включає брак
   * % браку = R / P
   */

  DEFECT_MODE:
    'GOOD_PLUS_DEFECT',


  NON_PRODUCTIVE_KEYWORDS:
    Object.freeze([

      'переналад',
      'прибиран',
      'робота по цеху',
      'калібров',
      'розкрій шаблону',
      'взірц'

    ]),


  BLANK_DEFECT_AS_ZERO:
    true,


  LOG_SHEET:
    'AI_LOG',


  AI: Object.freeze({

    API_URL:
      'https://api.openai.com/v1/responses',

    MODEL:
      'gpt-5.6-sol',

    REASONING_EFFORT:
      'medium',

    MAX_OUTPUT_TOKENS:
      7000,

    REPORT_SHEET:
      'AI_REPORTS',

    SCHEDULER_MINUTES:
      30,

    FIRST_AUTO_WEEK:
      '2026-09-21',

    FIRST_AUTO_MONTH:
      '2026-09-01',

    EMAIL_ENABLED:
      true,

    EMAIL_PROPERTY:
      'AI_REPORT_EMAILS',

    EMAIL_FROM_NAME:
      'AI-аналітик виробництва',

    DASHBOARD_SHEET:
      'AI_DASHBOARD'

  })

});

function getAnalyticsSpreadsheet_() {
  return SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
}


function getSourceSheet_() {
  const sh = getAnalyticsSpreadsheet_()
    .getSheetByName(CFG.SOURCE_SHEET);

  if (!sh) {
    throw new Error(
      `Не знайдено аркуш "${CFG.SOURCE_SHEET}".`
    );
  }

  return sh;
}

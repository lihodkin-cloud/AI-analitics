// службові функції

function cell_(row, col1Based) {
  return row[col1Based - 1];
}


function text_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}


function isErrorValue_(value) {

  return typeof value === 'string' &&
    /^#(N\/A|REF!|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!)/i
      .test(value.trim());
}


function num_(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : null;
  }

  if (isErrorValue_(value)) {
    return null;
  }

  const s = String(value)
    .replace(/\s/g, '')
    .replace('%', '')
    .replace(',', '.');

  if (s === '') {
    return null;
  }

  const n = Number(s);

  return Number.isFinite(n)
    ? n
    : null;
}


function shift_(value) {

  const n = num_(value);

  if (n === 1 || n === 2) {
    return n;
  }

  return null;
}


/*
 * S у Google Sheets фізично зберігається:
 *
 * 0.67 = 67%
 * 1.05 = 105%
 */
function pctCellToPct_(value) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  if (isErrorValue_(value)) {
    return null;
  }

  if (typeof value === 'number') {
    return value * 100;
  }

  const s = String(value).trim();

  if (!s) {
    return null;
  }

  if (s.includes('%')) {
    return num_(s);
  }

  const n = num_(s);

  if (n === null) {
    return null;
  }

  return Math.abs(n) <= 10
    ? n * 100
    : n;
}


function round_(value, digits) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  const p = Math.pow(10, digits || 0);

  return Math.round(
    (value + Number.EPSILON) * p
  ) / p;
}


function uniqueNonBlank_(values) {

  return [
    ...new Set(
      values
        .map(text_)
        .filter(Boolean)
    )
  ];
}

// ФУНКЦІЇ РОБОТИ З ДАТАМИ

function parseDateKey_(value, fallbackDateKey) {

  /*
   * Внутрішній формат усіх дат:
   *
   * 2026-09-22
   */

  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {

    return Utilities.formatDate(
      value,
      CFG.TIMEZONE,
      'yyyy-MM-dd'
    );
  }


  const s = text_(value);

  if (!s || isErrorValue_(s)) {
    return fallbackDateKey || null;
  }


  // yyyy-mm-dd

  let m = s.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/
  );

  if (m) {

    return (
      m[1] +
      '-' +
      String(m[2]).padStart(2, '0') +
      '-' +
      String(m[3]).padStart(2, '0')
    );
  }


  // dd.mm.yyyy

  m = s.match(
    /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/
  );

  if (m) {

    return (
      m[3] +
      '-' +
      String(m[2]).padStart(2, '0') +
      '-' +
      String(m[1]).padStart(2, '0')
    );
  }


  // 22.9

  m = s.match(
    /^(\d{1,2})[.\/-](\d{1,2})$/
  );

  if (m) {

    const year =
      fallbackDateKey
        ? fallbackDateKey.slice(0, 4)
        : Utilities.formatDate(
            new Date(),
            CFG.TIMEZONE,
            'yyyy'
          );

    return (
      year +
      '-' +
      String(m[2]).padStart(2, '0') +
      '-' +
      String(m[1]).padStart(2, '0')
    );
  }


  return fallbackDateKey || null;
}


function normalizeDateInput_(value) {

  const key = parseDateKey_(
    value,
    null
  );

  if (!key) {

    throw new Error(
      `Не вдалося розпізнати дату: ${value}`
    );
  }

  return key;
}


function dateKeyToUtcNoon_(key) {

  const [y, m, d] =
    key.split('-').map(Number);

  return new Date(
    Date.UTC(
      y,
      m - 1,
      d,
      12,
      0,
      0
    )
  );
}


function addDaysToDateKey_(key, days) {

  const d =
    dateKeyToUtcNoon_(key);

  d.setUTCDate(
    d.getUTCDate() + days
  );

  return Utilities.formatDate(
    d,
    'UTC',
    'yyyy-MM-dd'
  );
}


function inDateRange_(
  dateKey,
  from,
  to
) {

  return (
    !!dateKey &&
    dateKey >= from &&
    dateKey <= to
  );
}

// ВИЗНАЧЕННЯ ТИЖНЯ/МІСЯЦЯ

function getWeekRange_(anchorDate) {

  const key =
    normalizeDateInput_(anchorDate);

  const d =
    dateKeyToUtcNoon_(key);

  const dow = d.getUTCDay();

  // неділя = 0
  // понеділок = 1

  const diffToMonday =
    dow === 0
      ? -6
      : 1 - dow;

  const from =
    addDaysToDateKey_(
      key,
      diffToMonday
    );

  const to =
    addDaysToDateKey_(
      from,
      6
    );

  return {
    from,
    to
  };
}


function getMonthRange_(anchorDate) {

  const key =
    normalizeDateInput_(anchorDate);

  const [y, m] =
    key.split('-').map(Number);

  const from =
    y +
    '-' +
    String(m).padStart(2, '0') +
    '-01';


  const last =
    new Date(
      Date.UTC(
        y,
        m,
        0,
        12,
        0,
        0
      )
    );


  const to =
    Utilities.formatDate(
      last,
      'UTC',
      'yyyy-MM-dd'
    );


  return {
    from,
    to
  };
}

// КЛАСИФІКАЦІЯ KPI

function classifyPerformance_(pct) {

  if (
    pct === null ||
    pct === undefined ||
    !Number.isFinite(pct)
  ) {
    return 'NO_DATA';
  }


  if (
    pct >
    CFG.THRESHOLDS.GOOD_GT
  ) {

    return 'ABOVE_95';
  }


  if (
    pct >=
    CFG.THRESHOLDS.WATCH_MIN
  ) {

    return 'BETWEEN_90_95';
  }


  return 'BELOW_90';
}

function getProductionWeekRange_(
  anchorDate
) {

  const dateKey =
    normalizeDateInput_(
      anchorDate
    );


  const date =
    dateKeyToUtcNoon_(
      dateKey
    );


  /*
   * JS:
   * 0 = неділя
   * 1 = понеділок
   * ...
   * 6 = субота
   */

  const day =
    date.getUTCDay();


  const daysFromMonday =
    (day + 6) % 7;


  const from =
    addDaysToDateKey_(
      dateKey,
      -daysFromMonday
    );


  /*
   * Виробничий тиждень:
   * понеділок — субота.
   */

  const to =
    addDaysToDateKey_(
      from,
      5
    );


  return {
    from,
    to
  };
}


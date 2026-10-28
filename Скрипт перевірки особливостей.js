/**
 * Ознайомлення з особливостями обробки
 *
 * Аркуш "Завдання":
 * E - Операція
 * I - Виріб
 * W - Підтвердження (виріб|операція)
 * X - Дата та час підтвердження
 *
 * Аркуш "Тех.карти":
 * A - Виріб
 * L - Операція
 * N - Особливості
 */

function confirmProcessingFeatures() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const ui = SpreadsheetApp.getUi();

  // ---------- Налаштування ----------
  const SHEET_TASK = "Завдання";
  const SHEET_TECH = "Тех.карти";

  const FIRST_DATA_ROW = 3;

  const COL_OPERATION = 5;   // E
  const COL_PRODUCT   = 9;   // I
  const COL_CONFIRM   = 23;  // W
  const COL_DATETIME  = 24;  // X
  // -------------------------------

  if (sheet.getName() !== SHEET_TASK) {
    ui.alert('Перейдіть на аркуш "' + SHEET_TASK + '".');
    return;
  }

  const row = sheet.getActiveCell().getRow();

  if (row < FIRST_DATA_ROW) return;

  const product = sheet.getRange(row, COL_PRODUCT).getDisplayValue().trim();
  const operation = sheet.getRange(row, COL_OPERATION).getDisplayValue().trim();
  const confirmed = sheet.getRange(row, COL_CONFIRM).getDisplayValue().trim();

  if (!product || !operation) {
    ui.alert("Не заповнено виріб або операцію.");
    return;
  }

  const key = product + "|" + operation;

  if (confirmed === key) {
    ui.alert("З особливостями цієї операції вже ознайомлено.");
    return;
  }

  const techSheet = ss.getSheetByName(SHEET_TECH);

  if (!techSheet) {
    ui.alert('Не знайдено аркуш "' + SHEET_TECH + '".');
    return;
  }

  const lastRow = techSheet.getLastRow();

  if (lastRow < 2) {
    ui.alert("Аркуш техкарт порожній.");
    return;
  }

  const data = techSheet.getRange(2, 1, lastRow - 1, 14).getDisplayValues();

  const featureMap = new Map();

  data.forEach(r => {

    const p = r[0].trim();       // A
    const op = r[11].trim();     // L
    const feature = r[13].trim();// N

    if (p && op && feature) {
      featureMap.set(p + "|" + op, feature);
    }

  });

  const feature = featureMap.get(key);

  if (!feature) {
    ui.alert("Для цієї операції особливостей не задано.");
    return;
  }

  const answer = ui.alert(
    "⚠ ОСОБЛИВОСТІ ОБРОБКИ",

    "Рядок: " + row +
    "\n\nВиріб:\n" + product +
    "\n\nОперація:\n" + operation +
    "\n\nОсобливості:\n\n" + feature +
    "\n\nПідтверджуєте ознайомлення?",

    ui.ButtonSet.YES_NO
  );

  if (answer === ui.Button.YES) {

    // Підтвердження
    sheet.getRange(row, COL_CONFIRM).setValue(key);

    // Дата та час
    sheet.getRange(row, COL_DATETIME)
         .setValue(new Date())
         .setNumberFormat("dd.MM.yyyy HH:mm");

  }

}
function initFromCurrentState() {
  const SHEET = 'Замовлення';
  const COL_A = 1;

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const values = sheet.getRange(2, COL_A, lastRow - 1).getValues();

  let lastOrderRow = 1;

  for (let i = 0; i < values.length; i++) {
    if (values[i][0]) {
      lastOrderRow = i + 2;
    }
  }

  PropertiesService
    .getScriptProperties()
    .setProperty('LAST_ROW', lastOrderRow);

  Logger.log('Ініціалізація завершена. LAST_ROW = ' + lastOrderRow);
}

function watchNewOrders() {
  const SHEET = 'Замовлення';

  const COL_ORDER_NUMBER = 1; // A

  const ITEMS = [
    { qty: 34, name: 33 }, // AH -> AG
    { qty: 36, name: 35 }, // AJ -> AI
    { qty: 38, name: 37 }  // AL -> AK
  ];

  const EMAILS = [
    'sergiirubak8888@gmail.com',
    'umkola0@gmail.com',
    'sergiy.odarych@gmail.com',
    'lihodkin@gmail.com'
  ];

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const props = PropertiesService.getScriptProperties();
  let lastProcessedRow = Number(props.getProperty('LAST_ROW') || 1);

  const startRow = lastProcessedRow + 1;
  if (startRow > lastRow) return;

  const numRows = lastRow - startRow + 1;

  const orderNumbers = sheet
    .getRange(startRow, COL_ORDER_NUMBER, numRows)
    .getValues();

  const data = sheet
    .getRange(startRow, 33, numRows, 6) // AG–AL
    .getValues();

  for (let i = 0; i < numRows; i++) {
    const rowNumber = startRow + i;
    const orderNumber = orderNumbers[i][0];

    // нове замовлення = є номер
    if (!orderNumber) continue;

    let lines = [];

    ITEMS.forEach(item => {
      const qty = data[i][item.qty - 33];
      const name = data[i][item.name - 33];

      if (typeof qty === 'number' && qty > 0) {
        lines.push(`• ${name}: ${qty}`);
      }
    });

    if (lines.length) {
      const body =
`Надійшло нове замовлення.

Номер замовлення: ${orderNumber}
Рядок у таблиці "ГКД 2026": ${rowNumber}

Склад заявки на комплектацію:
${lines.join('\n')}

Будь ласка:
підтвердіть отримання заявки ел.листом на пошту lihodkin@gmail.com (негайно)
повідомте прогнозну дату повної комплектації (все у нас на складі) на пошту umkola0@gmail.com протягом 2 днів`;

      MailApp.sendEmail({
        to: EMAILS.join(','),
        subject: `Заявка на комплектацію - замовлення №${orderNumber}`,
        body: body
      });
    }

    lastProcessedRow = rowNumber;
  }

  props.setProperty('LAST_ROW', lastProcessedRow);
}



function columnToLetter(col) {
  let letter = '';
  while (col > 0) {
    let temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = (col - temp - 1) / 26;
  }
  return letter;
}
function normalizeTraceabilityText_(
  value
) {

  return String(
    value || ''
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    );
}

function buildProductShieldMap_() {

  const ss =
    getAnalyticsSpreadsheet_();


  const sheet =
    ss.getSheetByName(
      'Тех.карти'
    );


  if (!sheet) {

    throw new Error(
      'Не знайдено аркуш "Тех.карти".'
    );
  }


  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 3
  ) {

    return new Map();
  }


  /*
   * A:D
   *
   * A = назва виробу
   * D = щит / пресова заготовка
   */

  const values =
    sheet
      .getRange(
        3,
        1,
        lastRow - 2,
        4
      )
      .getDisplayValues();


  const map =
    new Map();


  values.forEach(
    row => {

      const product =
        normalizeTraceabilityText_(
          row[0]
        );


      const shield =
        normalizeTraceabilityText_(
          row[3]
        );


      if (
        !product ||
        !shield
      ) {

        return;
      }


      map.set(
        product,
        shield
      );

    }
  );


  return map;
}

function getShieldForProduct_(
  product,
  productShieldMap
) {

  const key =
    normalizeTraceabilityText_(
      product
    );


  if (!key) {

    return '';
  }


  return (
    productShieldMap.get(
      key
    ) || ''
  );
}


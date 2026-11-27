function updateOpenAIKey() {

  const ui = SpreadsheetApp.getUi();

  const response = ui.prompt(
    'Оновлення ключа OpenAI API',
    'Вставте новий API-ключ:',
    ui.ButtonSet.OK_CANCEL
  );

  if (
    response.getSelectedButton() !== ui.Button.OK
  ) {
    return;
  }

  const apiKey = response.getResponseText().trim();

  if (!apiKey || !apiKey.startsWith('sk-')) {

    ui.alert(
      'Некоректний API-ключ. Зміни не внесено.'
    );

    return;
  }

  const props = PropertiesService.getScriptProperties();

  props.setProperty(
    'OPENAI_API_KEY',
    apiKey
  );

  if (props.getProperty('OPENAI_API_KEY') === apiKey) {

    ui.alert(
      'API-ключ успішно оновлено.'
    );

  } else {

    ui.alert(
      'Помилка збереження API-ключа.'
    );

  }
}
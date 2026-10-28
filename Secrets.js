function setOpenAIApiKey() {

  const apiKey =
    'ВСТАВТЕ_СЮДИ_ВАШ_API_КЛЮЧ';


  if (
    !apiKey ||
    apiKey ===
      'ВСТАВТЕ_СЮДИ_ВАШ_API_КЛЮЧ'
  ) {

    throw new Error(
      'API-ключ не вставлений.'
    );
  }


  PropertiesService
    .getScriptProperties()
    .setProperty(
      'OPENAI_API_KEY',
      apiKey
    );


  console.log(
    'OPENAI_API_KEY успішно збережено.'
  );
}

function testOpenAIApiKey() {

  const key =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        'OPENAI_API_KEY'
      );


  if (!key) {

    console.log(
      '❌ OPENAI_API_KEY не знайдено.'
    );

    return;
  }


  console.log(
    '✅ OPENAI_API_KEY знайдено.'
  );

  console.log(
    'Початок ключа: ' +
    key.substring(0, 7) +
    '...'
  );
}

function setAIReportEmailRecipients() {

  const emails =
    'ВСТАВТЕ_СЮДИ_EMAIL';


  if (!emails) {

    throw new Error(
      'Email-адреси не вказані.'
    );
  }


  PropertiesService
    .getScriptProperties()
    .setProperty(
      'AI_REPORT_EMAILS',
      emails
    );


  console.log(
    'Email-адреси для AI-звітів збережені.'
  );
}

function setupAIAdminEmail() {
  const adminEmail = 'lihodkin@gmail.com';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error('Вкажіть свою email-адресу замість шаблону.');
  }

  const props = PropertiesService.getScriptProperties();

  props.setProperty('AI_ADMIN_EMAILS', adminEmail.trim());

  console.log('AI_ADMIN_EMAILS — збережено');

  console.log(
    'OPENAI_API_KEY — ' +
    (props.getProperty('OPENAI_API_KEY') ? 'наявний' : 'ВІДСУТНІЙ')
  );

  console.log(
    'AI_REPORT_EMAILS — ' +
    (props.getProperty('AI_REPORT_EMAILS') ? 'наявний' : 'ВІДСУТНІЙ')
  );
}
function getAIReportEmailRecipients_() {

  const raw =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        CFG.AI.EMAIL_PROPERTY
      ) || '';


  return raw
    .split(/[;,]/)
    .map(
      value =>
        value.trim()
    )
    .filter(
      value =>
        value.length > 0
    );
}

function formatAIReportDate_(
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
      'dd.MM.yyyy'
    );
  }


  return String(value);
}

function buildAIReportEmailSubject_(
  report
) {

  const from =
    formatAIReportDate_(
      report.dateFrom
    );


  const to =
    formatAIReportDate_(
      report.dateTo
    );


  if (
    report.reportType ===
    'DAILY'
  ) {

    return (
      'AI-звіт виробництва | ' +
      from +
      ' | зміна ' +
      report.shift
    );
  }


  if (
    report.reportType ===
    'WEEKLY'
  ) {

    return (
      'AI тижневий звіт | ' +
      from +
      ' — ' +
      to
    );
  }


  if (
    report.reportType ===
    'MONTHLY'
  ) {

    return (
      'AI місячний звіт | ' +
      from +
      ' — ' +
      to
    );
  }


  return (
    'AI-звіт виробництва | ' +
    report.reportKey
  );
}

function aiReportTextToHtml_(
  text
) {

  let safe =
    String(text || '')
      .replace(
        /&/g,
        '&amp;'
      )
      .replace(
        /</g,
        '&lt;'
      )
      .replace(
        />/g,
        '&gt;'
      );


  /*
   * **жирний текст**
   */

  safe =
    safe.replace(
      /\*\*(.+?)\*\*/g,
      '<strong>$1</strong>'
    );


  const lines =
    safe.split('\n');


  const html =
    lines.map(
      line => {

        if (
          line.startsWith(
            '### '
          )
        ) {

          return (
            '<h3>' +
            line.substring(4) +
            '</h3>'
          );
        }


        if (
          line.startsWith(
            '## '
          )
        ) {

          return (
            '<h2>' +
            line.substring(3) +
            '</h2>'
          );
        }


        if (
          line.startsWith(
            '# '
          )
        ) {

          return (
            '<h1>' +
            line.substring(2) +
            '</h1>'
          );
        }


        if (
          line.startsWith(
            '- '
          )
        ) {

          return (
            '<div style="margin:4px 0 4px 20px;">' +
            '• ' +
            line.substring(2) +
            '</div>'
          );
        }


        if (
          line.trim() === ''
        ) {

          return '<br>';
        }


        return (
          '<div style="margin:6px 0;">' +
          line +
          '</div>'
        );
      }
    )
    .join('');


  return `
  <div style="
      font-family:Arial,sans-serif;
      font-size:14px;
      line-height:1.45;
      max-width:900px;
  ">
    ${html}

    <hr style="
      margin-top:30px;
      border:none;
      border-top:1px solid #ddd;
    ">

    <div style="
      font-size:11px;
      color:#777;
    ">
      Автоматичний звіт AI-аналітика виробництва.
    </div>
  </div>
  `;
}

function setAIReportEmailStatus_(
  row,
  status,
  sentAt,
  recipients
) {

  const sheet =
    getOrCreateAIReportSheet_();


  sheet
    .getRange(
      row,
      18,
      1,
      3
    )
    .setValues([[

      status,

      sentAt || '',

      recipients || ''

    ]]);


  try {

    refreshAIDashboard_();

  } catch (err) {

    console.error(
      'DASHBOARD REFRESH ERROR: ' +
      err.message
    );
  }
}

function sendStoredAIReportEmail_(
  reportKey
) {

  if (
    CFG.AI.EMAIL_ENABLED !==
    true
  ) {

    return {
      status:
        'EMAIL_DISABLED'
    };
  }


  const report =
    getStoredAIReport_(
      reportKey
    );


  if (!report) {

    throw new Error(
      'AI-звіт не знайдений: ' +
      reportKey
    );
  }


  /*
   * Уже відправлено.
   */

  if (
    report.emailStatus ===
    'SENT'
  ) {

    return {
      status:
        'ALREADY_SENT'
    };
  }


  const recipients =
    getAIReportEmailRecipients_();


  if (
    recipients.length === 0
  ) {

    throw new Error(
      'Не налаштовані email-одержувачі.'
    );
  }


  /*
   * Перевіряємо квоту.
   */

  const remainingQuota =
    MailApp
      .getRemainingDailyQuota();


  if (
    remainingQuota <
    recipients.length
  ) {

    setAIReportEmailStatus_(
      report.row,
      'WAITING_QUOTA',
      '',
      recipients.join(', ')
    );


    return {
      status:
        'WAITING_QUOTA'
    };
  }


  const subject =
    buildAIReportEmailSubject_(
      report
    );


  try {

    MailApp.sendEmail({

      to:
        recipients.join(','),

      subject,

      body:
        report.aiText,

      htmlBody:
        aiReportTextToHtml_(
          report.aiText
        ),

      name:
        CFG.AI.EMAIL_FROM_NAME

    });


    const now =
      new Date();


    setAIReportEmailStatus_(
      report.row,
      'SENT',
      now,
      recipients.join(', ')
    );


    return {

      status:
        'SENT',

      recipients,

      subject

    };


  } catch (err) {

    setAIReportEmailStatus_(
      report.row,
      'ERROR',
      '',
      recipients.join(', ')
    );


    throw err;
  }
}

function deliverPendingAIReportEmails_() {

  if (
    CFG.AI.EMAIL_ENABLED !==
    true
  ) {
    return;
  }


  const sheet =
    getOrCreateAIReportSheet_();


  const lastRow =
    sheet.getLastRow();


  if (
    lastRow < 2
  ) {
    return;
  }


  const rows =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        20
      )
      .getValues();


  rows.forEach(
    row => {

      const reportKey =
        row[2];


      const emailStatus =
        row[17];


      /*
       * Старі історичні рядки
       * з порожнім статусом
       * НЕ надсилаємо.
       */

      if (
        emailStatus !==
          'PENDING' &&
        emailStatus !==
          'ERROR' &&
        emailStatus !==
          'WAITING_QUOTA'
      ) {

        return;
      }


      try {

        const result =
          sendStoredAIReportEmail_(
            reportKey
          );


        console.log(
          'EMAIL ' +
          reportKey +
          ': ' +
          result.status
        );


      } catch (err) {

        console.error(
          'EMAIL ' +
          reportKey +
          ': ' +
          err.message
        );
      }

    }
  );
}

function queueAIReportEmail_(
  reportKey
) {

  const report =
    getStoredAIReport_(
      reportKey
    );


  if (!report) {

    throw new Error(
      'Звіт не знайдений: ' +
      reportKey
    );
  }


  setAIReportEmailStatus_(
    report.row,
    'PENDING',
    '',
    ''
  );


  console.log(
    'Звіт поставлено в email-чергу: ' +
    reportKey
  );
}

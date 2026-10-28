function analyzeDailyReport_(
  date,
  shift
) {

  const reportPackage =
    buildDailyReportPackage_(
      date,
      shift
    );


  return (
    analyzeDailyReportPackage_(
      reportPackage
    )
  );
}

function analyzeWeeklyReport_(
  anchorDate
) {

  const reportPackage =
    buildWeeklyReportPackage_(
      anchorDate
    );


  const instructions =
    getProductionAnalystInstructions_();


  const input =
    buildWeeklyAIInput_(
      reportPackage
    );


  const aiResult =
    callOpenAI_(
      instructions,
      input
    );


  return {

    reportType:
      'WEEKLY',

    period:
      reportPackage.period,

    aiText:
      aiResult.text,

    model:
      aiResult.model,

    responseId:
      aiResult.responseId,

    usage:
      aiResult.usage

  };
}

function analyzeWeeklyReport_(
  anchorDate
) {

  const reportPackage =
    buildWeeklyReportPackage_(
      anchorDate
    );


  const instructions =
    getProductionAnalystInstructions_();


  const input =
    buildWeeklyAIInput_(
      reportPackage
    );


  const aiResult =
    callOpenAI_(
      instructions,
      input
    );


  return {

    reportType:
      'WEEKLY',

    period:
      reportPackage.period,

    aiText:
      aiResult.text,

    model:
      aiResult.model,

    responseId:
      aiResult.responseId,

    usage:
      aiResult.usage

  };
}

function analyzeAndSaveDailyReport_(
  date,
  shift
) {

  const result =
    analyzeDailyReport_(
      date,
      shift
    );


  const storage =
    saveAIReport_(
      result
    );


  return {

    ...result,

    storage

  };
}

function analyzeAndSaveWeeklyReport_(
  anchorDate
) {

  const result =
    analyzeWeeklyReport_(
      anchorDate
    );


  const storage =
    saveAIReport_(
      result
    );


  return {

    ...result,

    storage

  };
}

function analyzeAndSaveMonthlyReport_(
  anchorDate
) {

  const result =
    analyzeMonthlyReport_(
      anchorDate
    );


  const storage =
    saveAIReport_(
      result
    );


  return {

    ...result,

    storage

  };
}

function analyzeDailyReportPackage_(
  reportPackage
) {

  const instructions =
    getProductionAnalystInstructions_();


  const input =
    buildDailyAIInput_(
      reportPackage
    );


  const aiResult =
    callOpenAI_(
      instructions,
      input
    );


  return {

    reportType:
      'DAILY',

    date:
      reportPackage.date,

    shift:
      reportPackage.shift,

    aiText:
      aiResult.text,

    model:
      aiResult.model,

    responseId:
      aiResult.responseId,

    usage:
      aiResult.usage

  };
}
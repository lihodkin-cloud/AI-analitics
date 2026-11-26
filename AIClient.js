function getOpenAIApiKey_() {

  const apiKey =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        'OPENAI_API_KEY'
      );


  if (!apiKey) {

    throw new Error(
      'OPENAI_API_KEY не знайдений у Script Properties.'
    );
  }


  return apiKey;
}

function extractOpenAIText_(
  responseJson
) {

  const parts = [];


  (
    responseJson.output || []
  )
  .forEach(
    item => {

      if (
        item.type !== 'message'
      ) {
        return;
      }


      (
        item.content || []
      )
      .forEach(
        content => {

          if (
            content.type ===
              'output_text' &&
            content.text
          ) {

            parts.push(
              content.text
            );
          }

        }
      );

    }
  );


  return parts
    .join('\n')
    .trim();
}

function callOpenAI_(instructions, input) {
  const circuit = aiReadState_('AI_API_CIRCUIT');
  if (Date.now() < (circuit.nextAt || 0)) throw aiFailure_('API_COOLDOWN', true);
  let status = 0;
  try {
    const response = UrlFetchApp.fetch(CFG.AI.API_URL, {
      method: 'post', contentType: 'application/json',
      headers: {Authorization: 'Bearer ' + getOpenAIApiKey_()},
      payload: JSON.stringify({model: CFG.AI.MODEL, store: false,
        reasoning: {effort: CFG.AI.REASONING_EFFORT},
        max_output_tokens: CFG.AI.MAX_OUTPUT_TOKENS, instructions: instructions, input: input}),
      muteHttpExceptions: true
    });
    status = response.getResponseCode();
    let json;
    try { json = JSON.parse(response.getContentText()); }
    catch (err) { throw aiFailure_('INVALID_JSON', status === 429 || status >= 500, status); }
    if (status < 200 || status >= 300) {
      const quota = json.error && json.error.code === 'insufficient_quota';
      throw aiFailure_(quota ? 'INSUFFICIENT_QUOTA' : 'HTTP_' + status,
        !quota && (status === 429 || status === 408 || status >= 500), status);
    }
    if (json.error || json.status !== 'completed') {
      throw aiFailure_('RESPONSE_NOT_COMPLETED', false, status);
    }
    const text = extractOpenAIText_(json);
    if (!text) throw aiFailure_('EMPTY_RESPONSE', false, status);
    PropertiesService.getScriptProperties().deleteProperty('AI_API_CIRCUIT');
    return {text: text, responseId: json.id || '', model: json.model || CFG.AI.MODEL,
      usage: json.usage || null};
  } catch (original) {
    // Do not retain messages from providers: they may contain credentials or request content.
    const err = original.code ? original : aiFailure_('TRANSPORT_OR_CONFIG', false, status);
    const pause = err.retryable ? aiReliabilityConfig_().retryMs : aiReliabilityConfig_().maxRetryMs;
    aiWriteState_('AI_API_CIRCUIT', {nextAt: Date.now() + pause, code: err.code});
    aiTechnicalEvent_('OPENAI', 'ERROR', {code: err.code, httpStatus: err.httpStatus});
    aiNotifyAdmin_('OPENAI', err.code);
    throw err;
  }
}


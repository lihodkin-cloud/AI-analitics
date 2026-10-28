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

function callOpenAI_(
  instructions,
  input
) {

  const apiKey =
    getOpenAIApiKey_();


  const payload = {

    model:
      CFG.AI.MODEL,

    store:
      false,

    reasoning: {

      effort:
        CFG.AI
          .REASONING_EFFORT

    },

    max_output_tokens:
      CFG.AI
        .MAX_OUTPUT_TOKENS,

    instructions:
      instructions,

    input:
      input

  };


  const response =
    UrlFetchApp.fetch(
      CFG.AI.API_URL,
      {

        method:
          'post',

        contentType:
          'application/json',

        headers: {

          Authorization:
            'Bearer ' +
            apiKey

        },

        payload:
          JSON.stringify(
            payload
          ),

        muteHttpExceptions:
          true

      }
    );


  const status =
    response
      .getResponseCode();


  const body =
    response
      .getContentText();


  let json;


  try {

    json =
      JSON.parse(
        body
      );

  } catch (err) {

    throw new Error(
      'OpenAI повернув відповідь, яку не вдалося прочитати як JSON. ' +
      'HTTP ' +
      status +
      '. Відповідь: ' +
      body.substring(
        0,
        1000
      )
    );
  }


  /*
   * Помилка API
   */

  if (
    status < 200 ||
    status >= 300
  ) {

    const message =
      json &&
      json.error &&
      json.error.message

        ? json.error.message

        : body.substring(
            0,
            1000
          );


    throw new Error(
      'OpenAI API. HTTP ' +
      status +
      ': ' +
      message
    );
  }


  /*
   * Отримуємо текст відповіді.
   */

  const text =
    extractOpenAIText_(
      json
    );


  if (!text) {

    throw new Error(
      'OpenAI API успішно відповів, але текст відповіді не знайдений.'
    );
  }


  return {

    text:
      text,

    responseId:
      json.id || '',

    model:
      json.model ||
      CFG.AI.MODEL,

    usage:
      json.usage || null

  };
}


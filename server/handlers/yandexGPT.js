import { validateApiKey, validateRequiredFields } from '../utils/validators.js';
import { handleApiError, sendErrorResponse, sendApiKeyError } from '../utils/errorHandler.js';

/**
 * Обработчик для Yandex GPT
 */
export async function handleYandexGPT(req, res) {
  try {
    const { messages, system_prompt, model, temperature, max_tokens } = req.body;
    const apiKey = process.env.YANDEX_GPT_API_KEY;
    const folderId = req.body.folderId || process.env.YANDEX_GPT_FOLDER_ID;
    
    // Валидация API ключа
    const keyValidation = validateApiKey(apiKey, 'YANDEX_GPT_API_KEY', 'Yandex GPT');
    if (!keyValidation.isValid) {
      return sendApiKeyError(res, 'YANDEX_GPT_API_KEY', 'Yandex GPT');
    }

    // Валидация folder ID
    if (!folderId) {
      return res.status(400).json({
        error: 'Folder ID не передан в запросе',
      });
    }

    // Поддерживаем разные модели: yandexgpt, yandexgpt-lite
    const modelUri = `gpt://${folderId}/${model}/latest`;

    const requestBody = {
      modelUri,
      completionOptions: {
        stream: false,
        temperature: temperature || 0.3,
        maxTokens: String(max_tokens || 2000),
      },
      messages: [
        {
          role: 'system',
          text: system_prompt || '',
        },
        ...messages,
      ],
    };

    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Yandex GPT API error: ${response.status} ${errorText}`;
      
      // Более детальные сообщения об ошибках
      if (response.status === 403) {
        errorMessage += '\n\nВозможные причины:\n' +
          '1. У сервисного аккаунта нет роли "ai.languageModels.user" или "editor"\n' +
          '2. API ключ создан для другого каталога\n' +
          '3. Область действия API ключа не совпадает с folder ID\n' +
          '4. Сервис YandexGPT не активирован в каталоге\n\n' +
          'Проверьте:\n' +
          '- Роли сервисного аккаунта в консоли Yandex Cloud (нужна роль ai.languageModels.user)\n' +
          '- Что API ключ создан с областью действия = ваш каталог\n' +
          '- Что folder ID в .env совпадает с ID каталога где создан сервисный аккаунт\n' +
          '- Что используете правильный тип ключа (API ключ, а не IAM токен)';
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (!data.result?.alternatives?.[0]?.message?.text) {
      throw new Error('Invalid response format from Yandex GPT');
    }

    res.json({
      text: data.result.alternatives[0].message.text,
    });
  } catch (error) {
    sendErrorResponse(res, error, 'Произошла ошибка при обращении к Yandex GPT');
  }
}


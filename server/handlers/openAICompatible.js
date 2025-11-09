import { validateApiKey } from '../utils/validators.js';
import { handleApiError, sendErrorResponse, sendApiKeyError } from '../utils/errorHandler.js';
import { formatOpenAIMessages, extractOpenAIResponse } from '../utils/messageFormatter.js';

/**
 * Создает обработчик для OpenAI-совместимых API (DeepSeek, ChatGPT и т.д.)
 */
export function createOpenAIHandler(config) {
  const {
    serviceName,
    envVarName,
    apiUrl,
    defaultModel,
  } = config;

  return async function handler(req, res) {
    try {
      const { messages, system_prompt, model, temperature, max_tokens } = req.body;
      const apiKey = process.env[envVarName];
      
      // Валидация API ключа
      const keyValidation = validateApiKey(apiKey, envVarName, serviceName);
      if (!keyValidation.isValid) {
        return sendApiKeyError(res, envVarName, serviceName);
      }

      // Формируем сообщения для API
      const formattedMessages = formatOpenAIMessages(messages, system_prompt);

      const requestBody = {
        model: model || defaultModel,
        messages: formattedMessages,
        temperature: temperature || 0.3,
        max_tokens: max_tokens || 2000,
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorMessage = await handleApiError(response, serviceName);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const text = extractOpenAIResponse(data);

      res.json({ text });
    } catch (error) {
      sendErrorResponse(res, error, `Произошла ошибка при обращении к ${serviceName}`);
    }
  };
}


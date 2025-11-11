import { validateApiKey } from '../utils/validators.js';
import { handleApiError, sendErrorResponse, sendApiKeyError } from '../utils/errorHandler.js';
import { formatOpenAIMessages, extractOpenAIResponse } from '../utils/messageFormatter.js';

/**
 * Обработчик для HuggingFace Inference Providers
 * Использует OpenAI-совместимый API через router.huggingface.co
 * Поддерживает выбор провайдера через суффикс модели (:fastest, :cheapest, :provider-name)
 */
export async function handleHuggingFace(req, res) {
  try {
    const { messages, system_prompt, model, temperature, max_tokens, provider } = req.body;
    const apiKey = process.env.HF_TOKEN;
    
    // Валидация API ключа
    const keyValidation = validateApiKey(apiKey, 'HF_TOKEN', 'HuggingFace Inference Providers');
    if (!keyValidation.isValid) {
      return sendApiKeyError(res, 'HF_TOKEN', 'HuggingFace Inference Providers');
    }

    // Формируем сообщения для API
    const formattedMessages = formatOpenAIMessages(messages, system_prompt);

    // Формируем имя модели с учетом провайдера
    let modelName = model || 'deepseek-ai/DeepSeek-R1';
    
    // Если указан provider, добавляем его как суффикс к имени модели
    if (provider) {
      if (provider === 'fastest' || provider === 'cheapest') {
        modelName = `${modelName}:${provider}`;
      } else if (provider !== 'auto') {
        // Для конкретного провайдера добавляем его имя
        modelName = `${modelName}:${provider}`;
      }
      // Если provider === 'auto', используем модель без суффикса (по умолчанию)
    }

    const requestBody = {
      model: modelName,
      messages: formattedMessages,
      temperature: temperature || 0.3,
      max_tokens: max_tokens || 2000,
    };

    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorMessage = await handleApiError(response, 'HuggingFace Inference Providers');
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const text = extractOpenAIResponse(data);

    // Извлекаем информацию о токенах и стоимости из ответа
    const usage = data.usage || {};
    const responseData = {
      text,
      tokens: usage.total_tokens,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
    };

    // Если есть информация о стоимости в ответе, добавляем её
    // HuggingFace Inference Providers может возвращать стоимость в разных форматах
    if (data.cost !== undefined) {
      responseData.cost = data.cost;
    } else if (usage.cost !== undefined) {
      responseData.cost = usage.cost;
    }

    res.json(responseData);
  } catch (error) {
    sendErrorResponse(res, error, 'Произошла ошибка при обращении к HuggingFace Inference Providers');
  }
}


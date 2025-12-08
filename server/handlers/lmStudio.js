import { handleApiError, sendErrorResponse } from '../utils/errorHandler.js';
import { formatOpenAIMessages, extractOpenAIResponse } from '../utils/messageFormatter.js';

/**
 * Нормализует базовый URL для LM Studio, убирая пути к конкретным эндпоинтам
 */
function normalizeBaseUrl(url) {
  if (!url) return 'http://localhost:1234/v1';
  
  // Убираем протокол и порт для парсинга
  let normalized = url.trim();
  
  // Убираем пути к конкретным эндпоинтам
  normalized = normalized.replace(/\/v1\/embeddings.*$/, '');
  normalized = normalized.replace(/\/v1\/chat\/completions.*$/, '');
  normalized = normalized.replace(/\/v1\/models.*$/, '');
  
  // Убеждаемся, что URL заканчивается на /v1
  if (!normalized.endsWith('/v1')) {
    // Если есть порт, добавляем /v1
    if (normalized.match(/:\d+$/)) {
      normalized = `${normalized}/v1`;
    } else if (normalized.endsWith('/')) {
      normalized = `${normalized}v1`;
    } else {
      normalized = `${normalized}/v1`;
    }
  }
  
  return normalized;
}

/**
 * Получает список доступных моделей из LM Studio
 */
async function getAvailableModels(baseUrl) {
  try {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const modelsUrl = `${normalizedBaseUrl}/models`;
    
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.LM_STUDIO_API_KEY && { 'Authorization': `Bearer ${process.env.LM_STUDIO_API_KEY}` }),
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.data || [];
    }
    return [];
  } catch (error) {
    console.warn('Не удалось получить список моделей из LM Studio:', error.message);
    return [];
  }
}

/**
 * Обработчик для LM Studio (локальная модель через OpenAI-совместимый API)
 * LM Studio обычно работает на http://localhost:1234/v1/chat/completions
 */
export async function handleLMStudio(req, res) {
  try {
    const { messages, system_prompt, model, temperature, max_tokens } = req.body;
    
    // Базовый URL для LM Studio (можно переопределить через переменную окружения)
    // Используем отдельную переменную для чата или нормализуем URL
    const chatBaseUrl = process.env.LM_STUDIO_CHAT_URL || process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';
    const normalizedBaseUrl = normalizeBaseUrl(chatBaseUrl);
    const apiUrl = `${normalizedBaseUrl}/chat/completions`;
    
    // Формируем сообщения для API
    const formattedMessages = formatOpenAIMessages(messages, system_prompt);

    // Если модель не указана или указано '__auto__', пытаемся получить первую доступную модель
    let modelName = model;
    if (!modelName || modelName === '__auto__') {
      const availableModels = await getAvailableModels(normalizedBaseUrl);
      if (availableModels.length > 0) {
        // Ищем chat модель (не embedding)
        const chatModel = availableModels.find(m => 
          m.id && !m.id.toLowerCase().includes('embed')
        ) || availableModels[0];
        modelName = chatModel.id;
      } else {
        // Если не удалось получить список, используем дефолтное значение
        modelName = 'mistralai/ministral-3-3b';
      }
    }

    const requestBody = {
      model: modelName,
      messages: formattedMessages,
      temperature: temperature || 0.3,
      max_tokens: max_tokens || 2000,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // LM Studio обычно не требует API ключа, но некоторые версии могут требовать dummy key
        ...(process.env.LM_STUDIO_API_KEY && { 'Authorization': `Bearer ${process.env.LM_STUDIO_API_KEY}` }),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.error || errorText;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}`;
      }

      // Если ошибка связана с моделью, пытаемся получить список доступных моделей
      if (errorMessage.includes('model') || errorMessage.includes('Model')) {
        const availableModels = await getAvailableModels(normalizedBaseUrl);
        if (availableModels.length > 0) {
          const modelList = availableModels.map(m => m.id).join(', ');
          errorMessage += `\n\nДоступные модели в LM Studio: ${modelList}\n\nУбедитесь, что модель загружена в LM Studio и используйте точное имя модели из списка выше.`;
        } else {
          errorMessage += '\n\nУбедитесь, что:\n1. LM Studio запущен\n2. Модель загружена в LM Studio\n3. Локальный сервер запущен в LM Studio';
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const text = extractOpenAIResponse(data);

    // Извлекаем информацию о токенах из ответа
    const usage = data.usage || {};
    const responseData = {
      text,
      tokens: usage.total_tokens,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
    };

    // LM Studio не предоставляет информацию о стоимости, так как это локальная модель
    res.json(responseData);
  } catch (error) {
    sendErrorResponse(res, error, 'Произошла ошибка при обращении к LM Studio. Убедитесь, что LM Studio запущен и модель загружена.');
  }
}

/**
 * Эндпоинт для получения списка доступных моделей в LM Studio
 */
export async function getLMStudioModels(req, res) {
  try {
    const chatBaseUrl = process.env.LM_STUDIO_CHAT_URL || process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';
    const normalizedBaseUrl = normalizeBaseUrl(chatBaseUrl);
    const models = await getAvailableModels(normalizedBaseUrl);
    res.json({ models: models.map(m => ({ id: m.id, name: m.id })) });
  } catch (error) {
    sendErrorResponse(res, error, 'Не удалось получить список моделей из LM Studio');
  }
}


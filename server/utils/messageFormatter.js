import { loadPersonalization, buildPersonalizedSystemPrompt } from './personalizationService.js';

/**
 * Обогащает системный промпт персонализацией
 * @param {string} systemPrompt - Базовый системный промпт
 * @param {string} [userId] - ID пользователя для загрузки персонализации (опционально)
 * @returns {Promise<string>} Обогащенный системный промпт
 */
export async function enrichSystemPromptWithPersonalization(systemPrompt, userId = null) {
  try {
    const personalization = await loadPersonalization(userId);
    if (personalization) {
      return buildPersonalizedSystemPrompt(personalization, systemPrompt || '');
    }
  } catch (error) {
    console.warn('Не удалось загрузить персонализацию:', error.message);
  }
  return systemPrompt;
}

/**
 * Форматирует сообщения для OpenAI-совместимых API (DeepSeek, ChatGPT)
 * @param {Array} messages - Массив сообщений
 * @param {string} systemPrompt - Базовый системный промпт
 * @returns {Array} Отформатированные сообщения
 */
export function formatOpenAIMessages(messages, systemPrompt) {
  return [
    ...(systemPrompt ? [{
      role: 'system',
      content: systemPrompt,
    }] : []),
    ...messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
      content: msg.text || msg.content || '',
    })),
  ];
}

/**
 * Извлекает текст из ответа OpenAI-совместимого API
 */
export function extractOpenAIResponse(data) {
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response format from API');
  }
  return data.choices[0].message.content;
}


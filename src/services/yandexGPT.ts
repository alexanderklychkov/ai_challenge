import { AIResponse } from '../types/message';

// Используем прокси-сервер для обхода CORS
const YANDEX_GPT_PROXY_URL = import.meta.env.VITE_API_PROXY_URL || 'http://localhost:3001/api/yandex-gpt';

/**
 * Удаляет markdown блоки кода (```) в начале и конце текста, т.к. Yandex GPT возвращает в формате markdown
 */
const removeMarkdownCodeBlocks = (text: string): string => {
  let cleaned = text.trim();
  
  // Удаляем ```\n в начале
  if (cleaned.startsWith('```\n')) {
    cleaned = cleaned.substring(4);
  }
  
  // Удаляем \n``` в конце
  if (cleaned.endsWith('\n```')) {
    cleaned = cleaned.substring(0, cleaned.length - 4);
  }
  
  return cleaned.trim();
};

/**
 * Отправляет запрос к Yandex GPT API через прокси-сервер
 * @param messages История сообщений
 * @returns Ответ от модели в формате AIResponse
 */
export const sendToYandexGPT = async (
  messages: Array<{ role: 'user' | 'assistant'; text: string }>
): Promise<AIResponse> => {
  try {
    const response = await fetch(YANDEX_GPT_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map((msg) => ({
          role: msg.role,
          text: msg.text,
        }))
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.text) {
      throw new Error('Invalid response format from proxy server');
    }

    // Удаляем markdown блоки кода (```) в начале и конце ответа
    const cleanedText = removeMarkdownCodeBlocks(data.text);

    // Проверяем, является ли ответ JSON (начинается с { и заканчивается на })
    const trimmedText = cleanedText.trim();
    const isJsonResponse = trimmedText.startsWith('{') && trimmedText.endsWith('}');

    if (isJsonResponse) {
      try {
        const aiResponse: AIResponse = JSON.parse(cleanedText);
        
        // Валидация структуры ответа
        if (!aiResponse.content) {
          throw new Error('Missing content field in AI response');
        }

        // Устанавливаем значения по умолчанию, если они отсутствуют
        return {
          content: aiResponse.content,
          references: Array.isArray(aiResponse.references) ? aiResponse.references : [],
          difficulty: aiResponse.difficulty || 'intermediate',
          tokens: typeof aiResponse.tokens === 'number' ? aiResponse.tokens : undefined,
        };
      } catch (parseError) {
        // Если не удалось распарсить JSON, возвращаем как обычный текст
        console.warn('Failed to parse AI response as JSON, using as plain text:', parseError);
        return {
          content: cleanedText,
          references: [],
        };
      }
    } else {
      // Это обычный текст (вопросы от AI), возвращаем как есть без difficulty
      return {
        content: cleanedText,
        references: [],
      };
    }
  } catch (error) {
    console.error('Yandex GPT API error:', error);
    throw error;
  }
};

/**
 * Конвертирует сообщения чата в формат Yandex GPT
 */
export const convertMessagesToYandexFormat = (
  messages: Array<{ type: 'user' | 'assistant'; content: string }>,
): Array<{ role: 'user' | 'assistant'; text: string }> => {
  return messages
    .filter((msg) => msg.type === 'user' || msg.type === 'assistant')
    .map((msg) => ({
      role: msg.type,
      text: msg.content,
    }));
};

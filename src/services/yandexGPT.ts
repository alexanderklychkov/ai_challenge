// Используем прокси-сервер для обхода CORS
const YANDEX_GPT_PROXY_URL = import.meta.env.VITE_API_PROXY_URL || 'http://localhost:3001/api/yandex-gpt';

/**
 * Отправляет запрос к Yandex GPT API через прокси-сервер
 * @param messages История сообщений
 * @returns Ответ от модели
 */
export const sendToYandexGPT = async (
  messages: Array<{ role: 'user' | 'assistant'; text: string }>
): Promise<string> => {
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

    return data.text;
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

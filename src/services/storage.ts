import { Message } from '../types/message';

const API_BASE_URL = import.meta.env.VITE_API_PROXY_URL?.replace(/\/api\/.*$/, '') || 'http://localhost:3001';

/**
 * Загружает сообщения с сервера
 */
export async function loadMessages(): Promise<Message[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages`);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const messages = await response.json();
    
    // Преобразуем timestamp строки обратно в Date объекты
    return messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (error) {
    console.error('Ошибка при загрузке сообщений:', error);
    return [];
  }
}

/**
 * Сохраняет сообщения на сервере
 */
export async function saveMessages(messages: Message[]): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Ошибка при сохранении сообщений:', error);
    return false;
  }
}

/**
 * Очищает все сообщения на сервере
 */
export async function clearMessages(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/messages`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Ошибка при очистке сообщений:', error);
    return false;
  }
}


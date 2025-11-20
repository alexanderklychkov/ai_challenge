import { Message } from '../types/message';
import { Chat, ChatSettings } from '../types/chat';

const API_BASE_URL = import.meta.env.VITE_API_PROXY_URL?.replace(/\/api\/.*$/, '') || 'http://localhost:3001';

/**
 * Загружает сообщения конкретного чата с сервера
 */
export async function loadMessages(chatId: string): Promise<Message[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`);
    
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
 * Сохраняет сообщения чата на сервере
 */
export async function saveMessages(chatId: string, messages: Message[]): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
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
 * Очищает сообщения конкретного чата на сервере
 */
export async function clearMessages(chatId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
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

/**
 * Загружает список всех чатов
 */
export async function loadChats(): Promise<Chat[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chats`);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const chats = await response.json();
    
    // Преобразуем timestamp строки обратно в Date объекты
    return chats.map((chat: any) => ({
      ...chat,
      createdAt: new Date(chat.createdAt),
      updatedAt: new Date(chat.updatedAt),
    }));
  } catch (error) {
    console.error('Ошибка при загрузке чатов:', error);
    return [];
  }
}

/**
 * Создает новый чат
 */
export async function createChat(title?: string): Promise<Chat | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const chat = await response.json();
    return {
      ...chat,
      createdAt: new Date(chat.createdAt),
      updatedAt: new Date(chat.updatedAt),
    };
  } catch (error) {
    console.error('Ошибка при создании чата:', error);
    return null;
  }
}

/**
 * Удаляет чат
 */
export async function deleteChat(chatId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Ошибка при удалении чата:', error);
    return false;
  }
}

/**
 * Обновляет название чата
 */
export async function updateChatTitle(chatId: string, title: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Ошибка при обновлении названия чата:', error);
    return false;
  }
}

/**
 * Обновляет настройки чата
 */
export async function updateChatSettings(chatId: string, settings: ChatSettings): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ settings }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Ошибка при обновлении настроек чата:', error);
    return false;
  }
}


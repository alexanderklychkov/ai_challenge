import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');
const CHATS_FILE = join(DATA_DIR, 'chats.json');
const MESSAGES_DIR = join(DATA_DIR, 'chats');

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  if (!existsSync(MESSAGES_DIR)) {
    await mkdir(MESSAGES_DIR, { recursive: true });
  }
}

/**
 * Загружает список всех чатов
 */
export async function loadChats() {
  try {
    await ensureDataDir();
    
    if (!existsSync(CHATS_FILE)) {
      return [];
    }

    const fileContent = await readFile(CHATS_FILE, 'utf-8');
    const chats = JSON.parse(fileContent);
    
    return chats.map(chat => ({
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
 * Сохраняет список чатов
 */
async function saveChats(chats) {
  try {
    await ensureDataDir();
    
    const chatsToSave = chats.map(chat => ({
      ...chat,
      createdAt: chat.createdAt instanceof Date ? chat.createdAt.toISOString() : chat.createdAt,
      updatedAt: chat.updatedAt instanceof Date ? chat.updatedAt.toISOString() : chat.updatedAt,
    }));

    await writeFile(CHATS_FILE, JSON.stringify(chatsToSave, null, 2), 'utf-8');
  } catch (error) {
    console.error('Ошибка при сохранении чатов:', error);
    throw error;
  }
}

/**
 * Создает новый чат
 */
export async function createChat(title = 'Новый чат') {
  try {
    await ensureDataDir();
    
    const chats = await loadChats();
    const newChat = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0,
    };
    
    chats.push(newChat);
    await saveChats(chats);
    
    return {
      ...newChat,
      createdAt: new Date(newChat.createdAt),
      updatedAt: new Date(newChat.updatedAt),
    };
  } catch (error) {
    console.error('Ошибка при создании чата:', error);
    throw error;
  }
}

/**
 * Удаляет чат
 */
export async function deleteChat(chatId) {
  try {
    await ensureDataDir();
    
    const chats = await loadChats();
    const filteredChats = chats.filter(chat => chat.id !== chatId);
    
    if (filteredChats.length === chats.length) {
      return false; // Чат не найден
    }
    
    await saveChats(filteredChats);
    
    // Удаляем файл с сообщениями чата
    const messagesFile = join(MESSAGES_DIR, `${chatId}.json`);
    if (existsSync(messagesFile)) {
      const { unlink } = await import('fs/promises');
      await unlink(messagesFile);
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка при удалении чата:', error);
    throw error;
  }
}

/**
 * Обновляет название чата
 */
export async function updateChatTitle(chatId, title) {
  try {
    await ensureDataDir();
    
    const chats = await loadChats();
    const chatIndex = chats.findIndex(chat => chat.id === chatId);
    
    if (chatIndex === -1) {
      return false;
    }
    
    chats[chatIndex].title = title;
    chats[chatIndex].updatedAt = new Date();
    
    await saveChats(chats);
    return true;
  } catch (error) {
    console.error('Ошибка при обновлении названия чата:', error);
    throw error;
  }
}

/**
 * Обновляет настройки чата
 * @param {string} chatId - ID чата
 * @param {object} settings - Настройки чата
 * @returns {Promise<boolean>}
 */
export async function updateChatSettings(chatId, settings) {
  try {
    await ensureDataDir();
    
    const chats = await loadChats();
    const chatIndex = chats.findIndex(chat => chat.id === chatId);
    
    if (chatIndex === -1) {
      return false;
    }
    
    chats[chatIndex].settings = settings;
    chats[chatIndex].updatedAt = new Date();
    
    await saveChats(chats);
    return true;
  } catch (error) {
    console.error('Ошибка при обновлении настроек чата:', error);
    throw error;
  }
}

/**
 * Загружает сообщения конкретного чата
 */
export async function loadChatMessages(chatId) {
  try {
    await ensureDataDir();
    
    const messagesFile = join(MESSAGES_DIR, `${chatId}.json`);
    
    if (!existsSync(messagesFile)) {
      return [];
    }

    const fileContent = await readFile(messagesFile, 'utf-8');
    const messages = JSON.parse(fileContent);
    
    return messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (error) {
    console.error('Ошибка при загрузке сообщений чата:', error);
    return [];
  }
}

/**
 * Сохраняет сообщения конкретного чата
 */
export async function saveChatMessages(chatId, messages) {
  try {
    await ensureDataDir();
    
    const messagesFile = join(MESSAGES_DIR, `${chatId}.json`);
    
    const messagesToSave = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
    }));

    await writeFile(messagesFile, JSON.stringify(messagesToSave, null, 2), 'utf-8');
    
    // Обновляем количество сообщений в чате
    const chats = await loadChats();
    const chatIndex = chats.findIndex(chat => chat.id === chatId);
    if (chatIndex !== -1) {
      chats[chatIndex].messageCount = messages.length;
      chats[chatIndex].updatedAt = new Date();
      await saveChats(chats);
    }
  } catch (error) {
    console.error('Ошибка при сохранении сообщений чата:', error);
    throw error;
  }
}

/**
 * Очищает сообщения конкретного чата
 */
export async function clearChatMessages(chatId) {
  try {
    await ensureDataDir();
    
    const messagesFile = join(MESSAGES_DIR, `${chatId}.json`);
    
    if (existsSync(messagesFile)) {
      const { unlink } = await import('fs/promises');
      await unlink(messagesFile);
    }
    
    // Обновляем количество сообщений в чате
    const chats = await loadChats();
    const chatIndex = chats.findIndex(chat => chat.id === chatId);
    if (chatIndex !== -1) {
      chats[chatIndex].messageCount = 0;
      chats[chatIndex].updatedAt = new Date();
      await saveChats(chats);
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка при очистке сообщений чата:', error);
    throw error;
  }
}


import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к файлу с данными для Telegram пользователей
const DATA_DIR = resolve(__dirname, '..', 'data');
const TELEGRAM_MESSAGES_FILE = resolve(DATA_DIR, 'telegram-messages.json');

/**
 * Инициализирует директорию для данных, если её нет
 */
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Загружает все сообщения пользователей Telegram из JSON файла
 * @returns {Promise<Object>} Объект с ключами userId и значениями массивами сообщений
 */
export async function loadTelegramMessages() {
  try {
    await ensureDataDir();
    
    if (!existsSync(TELEGRAM_MESSAGES_FILE)) {
      return {};
    }

    const fileContent = await readFile(TELEGRAM_MESSAGES_FILE, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // Преобразуем timestamp строки обратно в Date объекты для каждого пользователя
    const result = {};
    for (const [userId, messages] of Object.entries(data)) {
      result[userId] = messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
    }
    
    return result;
  } catch (error) {
    console.error('Ошибка при загрузке сообщений Telegram:', error);
    return {};
  }
}

/**
 * Загружает сообщения конкретного пользователя
 * @param {number|string} userId - ID пользователя Telegram
 * @returns {Promise<Array>} Массив сообщений пользователя
 */
export async function loadUserMessages(userId) {
  const allMessages = await loadTelegramMessages();
  return allMessages[String(userId)] || [];
}

/**
 * Сохраняет сообщения пользователя в JSON файл
 * @param {number|string} userId - ID пользователя Telegram
 * @param {Array} messages - Массив сообщений для сохранения
 * @returns {Promise<void>}
 */
export async function saveUserMessages(userId, messages) {
  try {
    await ensureDataDir();
    
    // Загружаем все сообщения
    const allMessages = await loadTelegramMessages();
    
    // Преобразуем Date объекты в строки для JSON
    const messagesToSave = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date 
        ? msg.timestamp.toISOString() 
        : msg.timestamp,
    }));
    
    // Обновляем сообщения пользователя
    allMessages[String(userId)] = messagesToSave;
    
    // Сохраняем все сообщения обратно в файл
    await writeFile(
      TELEGRAM_MESSAGES_FILE, 
      JSON.stringify(allMessages, null, 2), 
      'utf-8'
    );
  } catch (error) {
    console.error('Ошибка при сохранении сообщений Telegram:', error);
    throw error;
  }
}

/**
 * Очищает сообщения конкретного пользователя
 * @param {number|string} userId - ID пользователя Telegram
 * @returns {Promise<void>}
 */
export async function clearUserMessages(userId) {
  try {
    await ensureDataDir();
    
    const allMessages = await loadTelegramMessages();
    delete allMessages[String(userId)];
    
    await writeFile(
      TELEGRAM_MESSAGES_FILE, 
      JSON.stringify(allMessages, null, 2), 
      'utf-8'
    );
  } catch (error) {
    console.error('Ошибка при очистке сообщений Telegram:', error);
    throw error;
  }
}


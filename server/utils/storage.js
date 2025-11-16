import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к файлу с данными (в папке server/data)
const DATA_DIR = resolve(__dirname, '..', 'data');
const MESSAGES_FILE = resolve(DATA_DIR, 'messages.json');

/**
 * Инициализирует директорию для данных, если её нет
 */
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Загружает сообщения из JSON файла
 * @returns {Promise<Array>} Массив сообщений
 */
export async function loadMessages() {
  try {
    await ensureDataDir();
    
    if (!existsSync(MESSAGES_FILE)) {
      return [];
    }

    const fileContent = await readFile(MESSAGES_FILE, 'utf-8');
    const messages = JSON.parse(fileContent);
    
    // Преобразуем timestamp строки обратно в Date объекты
    return messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
  } catch (error) {
    console.error('Ошибка при загрузке сообщений:', error);
    return [];
  }
}

/**
 * Сохраняет сообщения в JSON файл
 * @param {Array} messages - Массив сообщений для сохранения
 * @returns {Promise<void>}
 */
export async function saveMessages(messages) {
  try {
    await ensureDataDir();
    
    // Преобразуем Date объекты в строки для JSON
    const messagesToSave = messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date 
        ? msg.timestamp.toISOString() 
        : msg.timestamp,
    }));

    await writeFile(
      MESSAGES_FILE, 
      JSON.stringify(messagesToSave, null, 2), 
      'utf-8'
    );
  } catch (error) {
    console.error('Ошибка при сохранении сообщений:', error);
    throw error;
  }
}

/**
 * Очищает все сообщения
 * @returns {Promise<void>}
 */
export async function clearMessages() {
  try {
    await ensureDataDir();
    await writeFile(MESSAGES_FILE, JSON.stringify([], null, 2), 'utf-8');
  } catch (error) {
    console.error('Ошибка при очистке сообщений:', error);
    throw error;
  }
}


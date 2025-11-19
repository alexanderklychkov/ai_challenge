import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к файлу с подписками на напоминания
const DATA_DIR = resolve(__dirname, '..', 'data');
const REMINDERS_FILE = resolve(DATA_DIR, 'telegram-reminders.json');

/**
 * Инициализирует директорию для данных, если её нет
 */
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Загружает все подписки на напоминания
 * @returns {Promise<Object>} Объект с подписками пользователей
 */
async function loadAllReminders() {
  try {
    await ensureDataDir();
    
    if (!existsSync(REMINDERS_FILE)) {
      return {};
    }

    const fileContent = await readFile(REMINDERS_FILE, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Ошибка при загрузке подписок на напоминания:', error);
    return {};
  }
}

/**
 * Проверяет, подписан ли пользователь на напоминания
 * @param {number|string} userId - ID пользователя Telegram
 * @returns {Promise<boolean>} Подписан ли пользователь
 */
export async function isUserSubscribed(userId) {
  const allReminders = await loadAllReminders();
  return allReminders[String(userId)] === true;
}

/**
 * Подписывает пользователя на напоминания
 * @param {number|string} userId - ID пользователя Telegram
 * @returns {Promise<void>}
 */
export async function subscribeUser(userId) {
  try {
    await ensureDataDir();
    
    const allReminders = await loadAllReminders();
    allReminders[String(userId)] = true;
    
    await writeFile(
      REMINDERS_FILE,
      JSON.stringify(allReminders, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('Ошибка при подписке пользователя на напоминания:', error);
    throw error;
  }
}

/**
 * Отписывает пользователя от напоминаний
 * @param {number|string} userId - ID пользователя Telegram
 * @returns {Promise<void>}
 */
export async function unsubscribeUser(userId) {
  try {
    await ensureDataDir();
    
    const allReminders = await loadAllReminders();
    delete allReminders[String(userId)];
    
    await writeFile(
      REMINDERS_FILE,
      JSON.stringify(allReminders, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('Ошибка при отписке пользователя от напоминаний:', error);
    throw error;
  }
}

/**
 * Получает список всех подписанных пользователей
 * @returns {Promise<Array<number|string>>} Массив ID подписанных пользователей
 */
export async function getSubscribedUsers() {
  const allReminders = await loadAllReminders();
  return Object.keys(allReminders)
    .filter(userId => allReminders[userId] === true)
    .map(userId => Number(userId) || userId);
}


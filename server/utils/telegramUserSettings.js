import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к файлу с настройками пользователей Telegram
const DATA_DIR = resolve(__dirname, '..', 'data');
const USER_SETTINGS_FILE = resolve(DATA_DIR, 'telegram-user-settings.json');

/**
 * Инициализирует директорию для данных, если её нет
 */
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Загружает настройки всех пользователей
 * @returns {Promise<Object>} Объект с настройками пользователей
 */
async function loadAllSettings() {
  try {
    await ensureDataDir();
    
    if (!existsSync(USER_SETTINGS_FILE)) {
      return {};
    }

    const fileContent = await readFile(USER_SETTINGS_FILE, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Ошибка при загрузке настроек пользователей:', error);
    return {};
  }
}

/**
 * Получает настройки пользователя
 * @param {number|string} userId - ID пользователя Telegram
 * @returns {Promise<Object>} Настройки пользователя
 */
export async function getUserSettings(userId) {
  const allSettings = await loadAllSettings();
  return allSettings[String(userId)] || {
    model: null,
    enableMCP: null,
  };
}

/**
 * Сохраняет настройки пользователя
 * @param {number|string} userId - ID пользователя Telegram
 * @param {Object} settings - Настройки пользователя
 * @returns {Promise<void>}
 */
export async function saveUserSettings(userId, settings) {
  try {
    await ensureDataDir();
    
    const allSettings = await loadAllSettings();
    allSettings[String(userId)] = {
      ...allSettings[String(userId)],
      ...settings,
    };
    
    await writeFile(
      USER_SETTINGS_FILE,
      JSON.stringify(allSettings, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.error('Ошибка при сохранении настроек пользователя:', error);
    throw error;
  }
}

/**
 * Получает модель пользователя
 * @param {number|string} userId - ID пользователя Telegram
 * @param {string} defaultModel - Модель по умолчанию
 * @returns {Promise<string>} Название модели
 */
export async function getUserModel(userId, defaultModel) {
  const settings = await getUserSettings(userId);
  return settings.model || defaultModel;
}

/**
 * Устанавливает модель пользователя
 * @param {number|string} userId - ID пользователя Telegram
 * @param {string} model - Название модели
 * @returns {Promise<void>}
 */
export async function setUserModel(userId, model) {
  await saveUserSettings(userId, { model });
}

/**
 * Получает настройку MCP для пользователя
 * @param {number|string} userId - ID пользователя Telegram
 * @param {boolean} defaultEnableMCP - Значение по умолчанию
 * @returns {Promise<boolean>} Включен ли MCP
 */
export async function getUserMCP(userId, defaultEnableMCP) {
  const settings = await getUserSettings(userId);
  return settings.enableMCP !== null ? settings.enableMCP : defaultEnableMCP;
}

/**
 * Устанавливает настройку MCP для пользователя
 * @param {number|string} userId - ID пользователя Telegram
 * @param {boolean} enableMCP - Включить ли MCP
 * @returns {Promise<void>}
 */
export async function setUserMCP(userId, enableMCP) {
  await saveUserSettings(userId, { enableMCP });
}


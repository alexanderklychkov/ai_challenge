/**
 * Сервис для работы с персонализацией агента
 * Хранит информацию о пользователе, его привычках и предпочтениях
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к директории с данными персонализации
const DATA_DIR = resolve(__dirname, '..', 'data', 'personalization');
const DEFAULT_PERSONALIZATION_FILE = resolve(DATA_DIR, 'default.json');

/**
 * Структура персонализации пользователя
 * @typedef {Object} Personalization
 * @property {string} name - Имя пользователя
 * @property {string} [role] - Роль/профессия
 * @property {string[]} [interests] - Интересы
 * @property {string[]} [skills] - Навыки
 * @property {Object} [preferences] - Предпочтения
 * @property {Object} [habits] - Привычки
 * @property {Object} [workStyle] - Стиль работы
 * @property {string} [communicationStyle] - Стиль общения
 * @property {string[]} [goals] - Цели
 * @property {Object} [context] - Дополнительный контекст
 */

/**
 * Инициализирует директорию для данных, если её нет
 */
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Получает путь к файлу персонализации пользователя
 * @param {string} userId - ID пользователя (опционально)
 * @returns {string} Путь к файлу
 */
function getPersonalizationFilePath(userId = null) {
  if (userId) {
    return resolve(DATA_DIR, `${userId}.json`);
  }
  return DEFAULT_PERSONALIZATION_FILE;
}

/**
 * Загружает персонализацию пользователя
 * @param {string} [userId] - ID пользователя (опционально, для персональной персонализации)
 * @returns {Promise<Personalization|null>} Персонализация или null
 */
export async function loadPersonalization(userId = null) {
  try {
    await ensureDataDir();
    
    const filePath = getPersonalizationFilePath(userId);
    
    if (!existsSync(filePath)) {
      // Если персонального файла нет, возвращаем дефолтный
      if (userId && existsSync(DEFAULT_PERSONALIZATION_FILE)) {
        return await loadPersonalization(null);
      }
      return null;
    }

    const fileContent = await readFile(filePath, 'utf-8');
    const personalization = JSON.parse(fileContent);
    
    return personalization;
  } catch (error) {
    console.error('Ошибка при загрузке персонализации:', error);
    return null;
  }
}

/**
 * Сохраняет персонализацию пользователя
 * @param {Personalization} personalization - Данные персонализации
 * @param {string} [userId] - ID пользователя (опционально)
 * @returns {Promise<void>}
 */
export async function savePersonalization(personalization, userId = null) {
  try {
    await ensureDataDir();
    
    const filePath = getPersonalizationFilePath(userId);
    
    // Добавляем метаданные
    const personalizationWithMeta = {
      ...personalization,
      updatedAt: new Date().toISOString(),
      userId: userId || 'default',
    };
    
    await writeFile(
      filePath, 
      JSON.stringify(personalizationWithMeta, null, 2), 
      'utf-8'
    );
  } catch (error) {
    console.error('Ошибка при сохранении персонализации:', error);
    throw error;
  }
}

/**
 * Обновляет персонализацию пользователя (частичное обновление)
 * @param {Partial<Personalization>} updates - Обновления
 * @param {string} [userId] - ID пользователя (опционально)
 * @returns {Promise<Personalization>} Обновленная персонализация
 */
export async function updatePersonalization(updates, userId = null) {
  const current = await loadPersonalization(userId) || {};
  
  const updated = {
    ...current,
    ...updates,
    // Рекурсивно обновляем вложенные объекты
    preferences: { ...current.preferences, ...updates.preferences },
    habits: { ...current.habits, ...updates.habits },
    workStyle: { ...current.workStyle, ...updates.workStyle },
    context: { ...current.context, ...updates.context },
  };
  
  await savePersonalization(updated, userId);
  return updated;
}

/**
 * Формирует системный промпт с учетом персонализации
 * @param {Personalization} personalization - Данные персонализации
 * @param {string} basePrompt - Базовый системный промпт
 * @returns {string} Обогащенный системный промпт
 */
export function buildPersonalizedSystemPrompt(personalization, basePrompt = '') {
  if (!personalization) {
    return basePrompt;
  }

  let personalizedPrompt = basePrompt;
  
  // Добавляем информацию о пользователе
  const userInfo = [];
  
  if (personalization.name) {
    userInfo.push(`Имя: ${personalization.name}`);
  }
  
  if (personalization.role) {
    userInfo.push(`Роль: ${personalization.role}`);
  }
  
  if (personalization.interests && personalization.interests.length > 0) {
    userInfo.push(`Интересы: ${personalization.interests.join(', ')}`);
  }
  
  if (personalization.skills && personalization.skills.length > 0) {
    userInfo.push(`Навыки: ${personalization.skills.join(', ')}`);
  }
  
  if (personalization.goals && personalization.goals.length > 0) {
    userInfo.push(`Цели: ${personalization.goals.join(', ')}`);
  }
  
  // Добавляем предпочтения
  if (personalization.preferences) {
    const prefs = [];
    if (personalization.preferences.language) {
      prefs.push(`Язык общения: ${personalization.preferences.language}`);
    }
    if (personalization.preferences.detailLevel) {
      prefs.push(`Уровень детализации: ${personalization.preferences.detailLevel}`);
    }
    if (personalization.preferences.examples) {
      prefs.push(`Предпочитаю примеры: ${personalization.preferences.examples ? 'да' : 'нет'}`);
    }
    if (prefs.length > 0) {
      userInfo.push(`Предпочтения: ${prefs.join(', ')}`);
    }
  }
  
  // Добавляем привычки
  if (personalization.habits) {
    const habits = [];
    if (personalization.habits.workHours) {
      habits.push(`Рабочие часы: ${personalization.habits.workHours}`);
    }
    if (personalization.habits.preferredTime) {
      habits.push(`Предпочитаемое время работы: ${personalization.habits.preferredTime}`);
    }
    if (personalization.habits.focusAreas) {
      habits.push(`Области фокуса: ${personalization.habits.focusAreas.join(', ')}`);
    }
    if (habits.length > 0) {
      userInfo.push(`Привычки: ${habits.join(', ')}`);
    }
  }
  
  // Добавляем стиль работы
  if (personalization.workStyle) {
    const workStyle = [];
    if (personalization.workStyle.approach) {
      workStyle.push(`Подход: ${personalization.workStyle.approach}`);
    }
    if (personalization.workStyle.priorities) {
      workStyle.push(`Приоритеты: ${personalization.workStyle.priorities.join(', ')}`);
    }
    if (workStyle.length > 0) {
      userInfo.push(`Стиль работы: ${workStyle.join(', ')}`);
    }
  }
  
  // Добавляем стиль общения
  if (personalization.communicationStyle) {
    userInfo.push(`Стиль общения: ${personalization.communicationStyle}`);
  }
  
  // Добавляем дополнительный контекст
  if (personalization.context) {
    const contextItems = Object.entries(personalization.context)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    if (contextItems) {
      userInfo.push(`Дополнительный контекст: ${contextItems}`);
    }
  }
  
  // Формируем финальный промпт
  if (userInfo.length > 0) {
    const personalizationSection = `
ПЕРСОНАЛИЗАЦИЯ:
Ты - мой личный агент. Ты знаешь меня и мои предпочтения:
${userInfo.map(info => `- ${info}`).join('\n')}

Используй эту информацию для:
- Адаптации ответов под мой стиль работы и предпочтения
- Предложения решений, которые соответствуют моим привычкам
- Учета моих целей и интересов при даче рекомендаций
- Общения в моем предпочитаемом стиле

`;
    
    personalizedPrompt = personalizationSection + personalizedPrompt;
  }
  
  return personalizedPrompt;
}

/**
 * Получает краткое описание персонализации для использования в промптах
 * @param {Personalization} personalization - Данные персонализации
 * @returns {string} Краткое описание
 */
export function getPersonalizationSummary(personalization) {
  if (!personalization) {
    return '';
  }
  
  const parts = [];
  
  if (personalization.name) {
    parts.push(personalization.name);
  }
  
  if (personalization.role) {
    parts.push(`(${personalization.role})`);
  }
  
  if (personalization.interests && personalization.interests.length > 0) {
    parts.push(`Интересы: ${personalization.interests.slice(0, 3).join(', ')}`);
  }
  
  return parts.join(' ');
}

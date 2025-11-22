import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к директории с данными обучения
const DATA_DIR = resolve(__dirname, '..', 'data', 'learning');
const TESTS_FILE = resolve(DATA_DIR, 'tests.json');
const ANKI_CARDS_FILE = resolve(DATA_DIR, 'anki-cards.json');
const STUDY_PLANS_FILE = resolve(DATA_DIR, 'study-plans.json');
const FLASHCARDS_FILE = resolve(DATA_DIR, 'flashcards.json');

/**
 * Инициализирует директорию для данных обучения, если её нет
 */
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Загружает тесты из JSON файла
 * @returns {Promise<Array>} Массив тестов
 */
export async function loadTests() {
  try {
    await ensureDataDir();
    
    if (!existsSync(TESTS_FILE)) {
      return [];
    }

    const fileContent = await readFile(TESTS_FILE, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Ошибка при загрузке тестов:', error);
    return [];
  }
}

/**
 * Сохраняет тест
 * @param {Object} test - Объект теста
 * @returns {Promise<Object>} Сохраненный тест
 */
export async function saveTest(test) {
  try {
    await ensureDataDir();
    
    const tests = await loadTests();
    const testId = test.id || `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const testToSave = {
      ...test,
      id: testId,
      createdAt: test.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Проверяем, существует ли тест с таким ID
    const existingIndex = tests.findIndex(t => t.id === testId);
    if (existingIndex >= 0) {
      tests[existingIndex] = testToSave;
    } else {
      tests.push(testToSave);
    }
    
    await writeFile(TESTS_FILE, JSON.stringify(tests, null, 2), 'utf-8');
    return testToSave;
  } catch (error) {
    console.error('Ошибка при сохранении теста:', error);
    throw error;
  }
}

/**
 * Получает тест по ID
 * @param {string} testId - ID теста
 * @returns {Promise<Object|null>} Тест или null
 */
export async function getTest(testId) {
  try {
    const tests = await loadTests();
    return tests.find(t => t.id === testId) || null;
  } catch (error) {
    console.error('Ошибка при получении теста:', error);
    return null;
  }
}

/**
 * Удаляет тест
 * @param {string} testId - ID теста
 * @returns {Promise<boolean>} true если удален успешно
 */
export async function deleteTest(testId) {
  try {
    await ensureDataDir();
    
    const tests = await loadTests();
    const initialLength = tests.length;
    const filteredTests = tests.filter(t => t.id !== testId);
    
    if (filteredTests.length === initialLength) {
      return false; // Тест не найден
    }
    
    await writeFile(TESTS_FILE, JSON.stringify(filteredTests, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Ошибка при удалении теста:', error);
    throw error;
  }
}

/**
 * Загружает карточки Anki из JSON файла
 * @returns {Promise<Array>} Массив карточек Anki
 */
export async function loadAnkiCards() {
  try {
    await ensureDataDir();
    
    if (!existsSync(ANKI_CARDS_FILE)) {
      return [];
    }

    const fileContent = await readFile(ANKI_CARDS_FILE, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Ошибка при загрузке карточек Anki:', error);
    return [];
  }
}

/**
 * Сохраняет карточки Anki
 * @param {Array} cards - Массив карточек Anki
 * @param {string} deckName - Название колоды
 * @returns {Promise<Object>} Информация о сохраненных карточках
 */
export async function saveAnkiCards(cards, deckName) {
  try {
    await ensureDataDir();
    
    const allCards = await loadAnkiCards();
    const deckId = `deck-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const cardsToSave = cards.map((card, index) => ({
      ...card,
      id: card.id || `card-${deckId}-${index}`,
      deckId,
      deckName,
      createdAt: new Date().toISOString(),
    }));
    
    allCards.push(...cardsToSave);
    
    await writeFile(ANKI_CARDS_FILE, JSON.stringify(allCards, null, 2), 'utf-8');
    
    return {
      deckId,
      deckName,
      cardsCount: cardsToSave.length,
      cards: cardsToSave,
    };
  } catch (error) {
    console.error('Ошибка при сохранении карточек Anki:', error);
    throw error;
  }
}

/**
 * Загружает планы изучения из JSON файла
 * @returns {Promise<Array>} Массив планов изучения
 */
export async function loadStudyPlans() {
  try {
    await ensureDataDir();
    
    if (!existsSync(STUDY_PLANS_FILE)) {
      return [];
    }

    const fileContent = await readFile(STUDY_PLANS_FILE, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Ошибка при загрузке планов изучения:', error);
    return [];
  }
}

/**
 * Удаляет план изучения
 * @param {string} planId - ID плана
 * @returns {Promise<boolean>} true если удален успешно
 */
export async function deleteStudyPlan(planId) {
  try {
    await ensureDataDir();
    
    const plans = await loadStudyPlans();
    const initialLength = plans.length;
    const filteredPlans = plans.filter(p => p.id !== planId);
    
    if (filteredPlans.length === initialLength) {
      return false; // План не найден
    }
    
    await writeFile(STUDY_PLANS_FILE, JSON.stringify(filteredPlans, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Ошибка при удалении плана изучения:', error);
    throw error;
  }
}

/**
 * Сохраняет план изучения
 * @param {Object} plan - Объект плана изучения
 * @returns {Promise<Object>} Сохраненный план
 */
export async function saveStudyPlan(plan) {
  try {
    await ensureDataDir();
    
    const plans = await loadStudyPlans();
    const planId = plan.id || `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const planToSave = {
      ...plan,
      id: planId,
      createdAt: plan.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const existingIndex = plans.findIndex(p => p.id === planId);
    if (existingIndex >= 0) {
      plans[existingIndex] = planToSave;
    } else {
      plans.push(planToSave);
    }
    
    await writeFile(STUDY_PLANS_FILE, JSON.stringify(plans, null, 2), 'utf-8');
    return planToSave;
  } catch (error) {
    console.error('Ошибка при сохранении плана изучения:', error);
    throw error;
  }
}

/**
 * Загружает флеш-карточки из JSON файла
 * @returns {Promise<Array>} Массив флеш-карточек
 */
export async function loadFlashcards() {
  try {
    await ensureDataDir();
    
    if (!existsSync(FLASHCARDS_FILE)) {
      return [];
    }

    const fileContent = await readFile(FLASHCARDS_FILE, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Ошибка при загрузке флеш-карточек:', error);
    return [];
  }
}

/**
 * Удаляет набор флеш-карточек по setId
 * @param {string} setId - ID набора карточек
 * @returns {Promise<boolean>} true если удален успешно
 */
export async function deleteFlashcardSet(setId) {
  try {
    await ensureDataDir();
    
    const allCards = await loadFlashcards();
    const initialLength = allCards.length;
    const filteredCards = allCards.filter(card => card.setId !== setId);
    
    if (filteredCards.length === initialLength) {
      return false; // Набор не найден
    }
    
    await writeFile(FLASHCARDS_FILE, JSON.stringify(filteredCards, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Ошибка при удалении набора флеш-карточек:', error);
    throw error;
  }
}

/**
 * Сохраняет флеш-карточки
 * @param {Array} cards - Массив флеш-карточек
 * @param {string} topic - Тема карточек
 * @param {string} [chatId] - ID чата, из которого были созданы карточки
 * @returns {Promise<Object>} Информация о сохраненных карточках
 */
export async function saveFlashcards(cards, topic, chatId) {
  try {
    await ensureDataDir();
    
    const allCards = await loadFlashcards();
    const setId = `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const cardsToSave = cards.map((card, index) => ({
      ...card,
      id: card.id || `flashcard-${setId}-${index}`,
      setId,
      topic,
      createdAt: new Date().toISOString(),
      ...(chatId && { chatId }),
    }));
    
    allCards.push(...cardsToSave);
    
    await writeFile(FLASHCARDS_FILE, JSON.stringify(allCards, null, 2), 'utf-8');
    
    return {
      setId,
      topic,
      cardsCount: cardsToSave.length,
      cards: cardsToSave,
    };
  } catch (error) {
    console.error('Ошибка при сохранении флеш-карточек:', error);
    throw error;
  }
}


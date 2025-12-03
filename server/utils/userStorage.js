import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Путь к файлу с данными пользователей
const DATA_DIR = resolve(__dirname, '..', 'data', 'auth');
const USERS_FILE = resolve(DATA_DIR, 'users.json');

/**
 * Инициализирует директорию для данных, если её нет
 */
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Загружает пользователей из JSON файла
 * @returns {Promise<Array>} Массив пользователей
 */
export async function loadUsers() {
  try {
    await ensureDataDir();
    
    if (!existsSync(USERS_FILE)) {
      return [];
    }

    const fileContent = await readFile(USERS_FILE, 'utf-8');
    const users = JSON.parse(fileContent);
    
    return users.map(user => ({
      ...user,
      createdAt: new Date(user.createdAt),
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(user.createdAt),
    }));
  } catch (error) {
    console.error('Ошибка при загрузке пользователей:', error);
    return [];
  }
}

/**
 * Сохраняет пользователей в JSON файл
 * @param {Array} users - Массив пользователей для сохранения
 * @returns {Promise<void>}
 */
async function saveUsers(users) {
  try {
    await ensureDataDir();
    
    const usersToSave = users.map(user => ({
      ...user,
      createdAt: user.createdAt instanceof Date 
        ? user.createdAt.toISOString() 
        : user.createdAt,
      updatedAt: user.updatedAt instanceof Date 
        ? user.updatedAt.toISOString() 
        : user.updatedAt,
    }));

    await writeFile(
      USERS_FILE, 
      JSON.stringify(usersToSave, null, 2), 
      'utf-8'
    );
  } catch (error) {
    console.error('Ошибка при сохранении пользователей:', error);
    throw error;
  }
}

/**
 * Находит пользователя по email
 * @param {string} email - Email пользователя
 * @returns {Promise<Object|null>} Пользователь или null
 */
export async function findUserByEmail(email) {
  const users = await loadUsers();
  return users.find(user => user.email === email) || null;
}

/**
 * Находит пользователя по ID
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object|null>} Пользователь или null
 */
export async function findUserById(userId) {
  const users = await loadUsers();
  return users.find(user => user.id === userId) || null;
}

/**
 * Создает нового пользователя
 * @param {string} email - Email пользователя
 * @param {string} passwordHash - Хеш пароля
 * @param {string} name - Имя пользователя
 * @returns {Promise<Object>} Созданный пользователь
 */
export async function createUser(email, passwordHash, name) {
  const users = await loadUsers();
  
  // Проверяем, существует ли пользователь с таким email
  const existingUser = users.find(user => user.email === email);
  if (existingUser) {
    throw new Error('Пользователь с таким email уже существует');
  }

  const newUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    email,
    passwordHash,
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    role: 'user',
    isActive: true,
  };

  users.push(newUser);
  await saveUsers(users);

  // Возвращаем пользователя без пароля
  const { passwordHash: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

/**
 * Обновляет информацию о пользователе
 * @param {string} userId - ID пользователя
 * @param {Object} updates - Обновления
 * @returns {Promise<Object|null>} Обновленный пользователь или null
 */
export async function updateUser(userId, updates) {
  const users = await loadUsers();
  const userIndex = users.findIndex(user => user.id === userId);
  
  if (userIndex === -1) {
    return null;
  }

  users[userIndex] = {
    ...users[userIndex],
    ...updates,
    updatedAt: new Date(),
  };

  await saveUsers(users);

  // Возвращаем пользователя без пароля
  const { passwordHash: _, ...userWithoutPassword } = users[userIndex];
  return userWithoutPassword;
}

/**
 * Обновляет время последнего входа пользователя
 * @param {string} userId - ID пользователя
 * @returns {Promise<void>}
 */
export async function updateLastLogin(userId) {
  await updateUser(userId, { lastLogin: new Date() });
}


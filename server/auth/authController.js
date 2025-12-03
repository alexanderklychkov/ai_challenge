import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { findUserByEmail, findUserById, createUser, updateLastLogin } from '../utils/userStorage.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Регистрация нового пользователя
 */
export async function register(req, res) {
  try {
    const { email, password, name } = req.body;

    // Валидация
    if (!email || !password || !name) {
      return res.status(400).json({ 
        error: 'Все поля обязательны для заполнения' 
      });
    }

    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Неверный формат email' 
      });
    }

    // Проверка длины пароля
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Пароль должен содержать минимум 6 символов' 
      });
    }

    // Проверяем, существует ли пользователь
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ 
        error: 'Пользователь с таким email уже существует' 
      });
    }

    // Хешируем пароль
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Создаем пользователя
    const user = await createUser(email, passwordHash, name);

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Ошибка при регистрации:', error);
    res.status(500).json({ 
      error: 'Не удалось зарегистрировать пользователя' 
    });
  }
}

/**
 * Авторизация пользователя
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Валидация
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email и пароль обязательны' 
      });
    }

    // Находим пользователя
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ 
        error: 'Неверный email или пароль' 
      });
    }

    // Проверяем, активен ли пользователь
    if (!user.isActive) {
      return res.status(403).json({ 
        error: 'Аккаунт заблокирован' 
      });
    }

    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Неверный email или пароль' 
      });
    }

    // Обновляем время последнего входа
    await updateLastLogin(user.id);

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Ошибка при авторизации:', error);
    res.status(500).json({ 
      error: 'Не удалось авторизовать пользователя' 
    });
  }
}

/**
 * Получение информации о текущем пользователе
 */
export async function getCurrentUser(req, res) {
  try {
    const user = await findUserById(req.userId);
    
    if (!user) {
      return res.status(404).json({ 
        error: 'Пользователь не найден' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error('Ошибка при получении пользователя:', error);
    res.status(500).json({ 
      error: 'Не удалось получить информацию о пользователе' 
    });
  }
}


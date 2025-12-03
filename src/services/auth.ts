const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

/**
 * Сохраняет токен в localStorage
 */
export function saveToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

/**
 * Получает токен из localStorage
 */
export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * Удаляет токен из localStorage
 */
export function removeToken(): void {
  localStorage.removeItem('auth_token');
}

/**
 * Регистрация нового пользователя
 */
export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Ошибка при регистрации');
  }

  if (result.success && result.token) {
    saveToken(result.token);
  }

  return result;
}

/**
 * Авторизация пользователя
 */
export async function login(data: LoginData): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Ошибка при авторизации');
  }

  if (result.success && result.token) {
    saveToken(result.token);
  }

  return result;
}

/**
 * Выход из системы
 */
export function logout(): void {
  removeToken();
}

/**
 * Получение информации о текущем пользователе
 */
export async function getCurrentUser(): Promise<User> {
  const token = getToken();
  
  if (!token) {
    throw new Error('Токен отсутствует');
  }

  const response = await fetch(`${API_URL}/api/auth/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      removeToken();
    }
    throw new Error(result.error || 'Ошибка при получении информации о пользователе');
  }

  return result.user;
}

/**
 * Проверка, авторизован ли пользователь
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Получает заголовок Authorization для запросов
 */
export function getAuthHeader(): { Authorization: string } | {} {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}


/**
 * Сервис для работы с генерацией changelog
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ChangelogGenerateParams {
  since?: string;
  until?: string;
  branch?: string;
  modelType?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  format?: 'markdown' | 'json';
}

export interface ChangelogResult {
  changelog: string;
  metadata: {
    since: string;
    until: string;
    branch: string;
    commitsCount: number;
    generatedAt: string;
    format: string;
    modelType: string;
  };
  commits: Array<{
    sha: string;
    message: string;
    author: string;
    date: string;
    url: string;
  }>;
}

export interface Tag {
  name: string;
  sha: string;
  zipballUrl: string;
  tarballUrl: string;
}

/**
 * Генерирует changelog из коммитов GitHub
 */
export async function generateChangelog(params: ChangelogGenerateParams): Promise<ChangelogResult> {
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('Требуется авторизация');
  }

  const response = await fetch(`${API_BASE_URL}/api/changelog/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка при генерации changelog');
  }

  return response.json();
}

/**
 * Получает список тегов репозитория
 */
export async function getTags(): Promise<Tag[]> {
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new Error('Требуется авторизация');
  }

  const response = await fetch(`${API_BASE_URL}/api/changelog/tags`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка при получении тегов');
  }

  return response.json();
}


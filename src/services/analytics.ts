/**
 * Сервис для локального аналитика данных
 */

import { getToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface UploadedData {
  success: boolean;
  data: any[];
  summary: {
    totalRows: number;
    columns?: Array<{
      name: string;
      type: string;
      sampleValues?: any[];
    }>;
    errorCount?: number;
    levelCounts?: Record<string, number>;
    errorTypes?: Record<string, number>;
  };
  type: 'csv' | 'json' | 'log';
  fileName: string;
  filePath: string;
}

export interface AnalyzeResponse {
  success: boolean;
  answer: string;
}

export interface StatsResponse {
  success: boolean;
  stats: {
    totalRows: number;
    columns: Array<{
      name: string;
      type: string;
    }>;
    errorCount?: number;
    levelCounts?: Record<string, number>;
    errorTypes?: Record<string, number>;
    numericStats?: Record<string, {
      min: number;
      max: number;
      avg: number;
      count: number;
    }>;
  };
}

/**
 * Загружает и парсит файл данных
 */
export async function uploadDataFile(file: File): Promise<UploadedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const token = getToken();
        
        if (!token) {
          throw new Error('Токен авторизации отсутствует. Пожалуйста, войдите в систему.');
        }
        
        const response = await fetch(`${API_BASE_URL}/api/analytics/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileData: base64Data,
            fileName: file.name,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Ошибка при загрузке файла');
        }

        const data = await response.json();
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Ошибка при чтении файла'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Анализирует данные с помощью локальной LLM
 */
export async function analyzeData(
  data: any[],
  summary: UploadedData['summary'],
  question: string,
  modelType: 'ollama' | 'lmstudio' = 'ollama',
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const token = getToken();
  
  if (!token) {
    throw new Error('Токен авторизации отсутствует. Пожалуйста, войдите в систему.');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/analytics/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      data,
      summary,
      question,
      modelType,
      ...options,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка при анализе данных');
  }

  const result: AnalyzeResponse = await response.json();
  return result.answer;
}

/**
 * Получает быструю статистику по данным
 */
export async function getDataStats(
  data: any[],
  summary: UploadedData['summary']
): Promise<StatsResponse['stats']> {
  const token = getToken();
  
  if (!token) {
    throw new Error('Токен авторизации отсутствует. Пожалуйста, войдите в систему.');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/analytics/stats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      data,
      summary,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка при получении статистики');
  }

  const result: StatsResponse = await response.json();
  return result.stats;
}

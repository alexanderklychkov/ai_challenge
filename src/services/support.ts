/**
 * Сервис для работы с поддержкой пользователей
 */

import { getAuthHeader } from './auth';

export interface SupportQueryOptions {
  userName?: string;
  userEmail?: string;
  ticketId?: string;
  messages?: Array<{ role: string; content: string }>;
  topK?: number;
  minScore?: number;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
}

export interface SupportQueryResult {
  answer: string;
  userContext: {
    userFound: boolean;
    userEmail?: string;
    userName?: string;
    openTicketsCount: number;
  };
  ticketContext: {
    ticketFound: boolean;
    ticketId?: string;
    ticketStatus?: string;
  };
  similarTickets: Array<{
    id: string;
    subject: string;
    description: string;
  }>;
  ragChunks: Array<{
    text: string;
    source: string;
    score: number;
  }>;
  metadata: {
    tokens?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Отправляет вопрос в службу поддержки
 */
export async function querySupport(
  question: string,
  modelType: 'deepseek' | 'yandex' | 'chatgpt' | 'huggingface',
  options: SupportQueryOptions = {}
): Promise<SupportQueryResult> {
  const response = await fetch(`${API_BASE_URL}/api/support/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({
      question,
      modelType,
      ...options,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка при запросе поддержки');
  }

  return response.json();
}


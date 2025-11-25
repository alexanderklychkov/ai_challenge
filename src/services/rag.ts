/**
 * Сервис для работы с RAG (Retrieval-Augmented Generation)
 */

export interface RAGComparisonResult {
  question: string;
  ragAnswer: string;
  noRagAnswer: string;
  ragChunks: Array<{
    text: string;
    score: number;
    source: string;
  }>;
  ragMetadata: {
    topK: number;
    minScore: number;
    tokens?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  noRagMetadata: {
    tokens?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
  comparison: {
    ragUsedChunks: number;
    ragTokens: number;
    noRagTokens: number;
    tokenDifference: number;
  };
}

export interface RAGQueryResult {
  answer: string;
  chunks: Array<{
    text: string;
    score: number;
    source: string;
  }>;
  chunksCount: number;
  usedRAG: boolean;
  metadata: {
    topK: number;
    minScore: number;
    tokens?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Сравнивает ответы с RAG и без RAG
 */
export async function compareRAGvsNoRAG(
  question: string,
  modelType: 'deepseek' | 'yandex' | 'chatgpt' | 'huggingface',
  options: {
    messages?: Array<{ role: string; content: string }>;
    topK?: number;
    minScore?: number;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    system_prompt?: string;
  } = {}
): Promise<RAGComparisonResult> {
  const response = await fetch(`${API_BASE_URL}/api/rag/compare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      modelType,
      ...options,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка при сравнении RAG');
  }

  return response.json();
}

/**
 * Выполняет запрос с RAG
 */
export async function queryWithRAG(
  question: string,
  modelType: 'deepseek' | 'yandex' | 'chatgpt' | 'huggingface',
  options: {
    messages?: Array<{ role: string; content: string }>;
    topK?: number;
    minScore?: number;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    system_prompt?: string;
  } = {}
): Promise<RAGQueryResult> {
  const response = await fetch(`${API_BASE_URL}/api/rag/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question,
      modelType,
      ...options,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Ошибка при RAG запросе');
  }

  return response.json();
}


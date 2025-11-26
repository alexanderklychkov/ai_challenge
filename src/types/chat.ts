export type ModelMode = 'parallel' | 'chain' | 'chain-fast';

export type AgentType = 'deepseek' | 'huggingface' | 'yandex' | 'chatgpt';

export interface AgentConfig {
  id: string;
  type: AgentType;
  name: string;
  model: string;
  temperature: number;
  maxTokens?: number;
  enableMCP?: boolean;
  provider?: 'auto' | 'fastest' | 'cheapest' | string;
  [key: string]: any; // Для дополнительных параметров
}

export interface ChatSettings {
  mode: ModelMode;
  agents: AgentConfig[];
  enableCompression?: boolean;
  compressionInterval?: number;
  ragMode?: 'none' | 'rag' | 'compare'; // Режим RAG: none - без RAG, rag - с RAG, compare - сравнение
  ragTopK?: number; // Количество чанков для поиска
  ragMinScore?: number; // Минимальный score для включения чанка
  // Настройки reranker
  ragUseReranker?: boolean; // Использовать ли reranker для фильтрации результатов
  ragRerankerStrategy?: 'threshold' | 'llm_score' | 'hybrid'; // Стратегия reranking
  ragRerankerThreshold?: number; // Порог релевантности для reranker (0-1)
  ragRerankerTopK?: number; // Количество результатов после reranking
}

export interface Chat {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  settings?: ChatSettings;
}


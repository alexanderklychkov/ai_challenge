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
}

export interface Chat {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  settings?: ChatSettings;
}


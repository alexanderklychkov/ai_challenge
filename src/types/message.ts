export interface AIReference {
  title: string;
  url: string;
}

export interface UsedTool {
  name: string;
  args?: any;
  timestamp?: string;
  error?: string;
  serverId?: string;
  serverName?: string;
  serverCategory?: string;
}

export interface AIResponse {
  content: string;
  references: AIReference[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tokens?: number;
  responseTime?: number; // Время ответа в миллисекундах
  cost?: number; // Стоимость в долларах
  inputTokens?: number; // Количество входных токенов
  outputTokens?: number; // Количество выходных токенов
  usedTools?: UsedTool[]; // Список использованных MCP инструментов
}

export interface StatusMessage {
  toolName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  message: string;
  timestamp: Date;
  serverName?: string;
  error?: string;
}

export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'status';
  content: string;
  timestamp: Date;
  aiResponse?: AIResponse; // Для assistant сообщений с новым форматом
  modelName?: string; // Название модели, которая сгенерировала ответ
  isSummary?: boolean; // Флаг, указывающий, что это сжатое сообщение (summary)
  originalMessageIds?: string[]; // ID оригинальных сообщений, которые были сжаты в это summary
  compressedBy?: string; // ID summary сообщения, которое заменило это сообщение в истории для AI
  statusMessage?: StatusMessage; // Для статусных сообщений
}

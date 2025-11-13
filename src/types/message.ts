export interface AIReference {
  title: string;
  url: string;
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
}

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  aiResponse?: AIResponse; // Для assistant сообщений с новым форматом
  modelName?: string; // Название модели, которая сгенерировала ответ
  isSummary?: boolean; // Флаг, указывающий, что это сжатое сообщение (summary)
  originalMessageIds?: string[]; // ID оригинальных сообщений, которые были сжаты в это summary
  compressedBy?: string; // ID summary сообщения, которое заменило это сообщение в истории для AI
}

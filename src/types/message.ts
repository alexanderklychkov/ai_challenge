export interface AIReference {
  title: string;
  url: string;
}

export interface AIResponse {
  content: string;
  references: AIReference[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  tokens?: number;
}

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  aiResponse?: AIResponse; // Для assistant сообщений с новым форматом
}

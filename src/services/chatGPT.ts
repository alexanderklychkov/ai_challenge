/**
 * Реализация ChatGPT модели
 */

import { AIModel, AIModelConfig } from './aiModel';

/**
 * Конфигурация для ChatGPT модели
 */
export interface ChatGPTConfig extends AIModelConfig {
  model?: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo';
}

/**
 * Реализация ChatGPT модели
 * 
 * @example
 * const chatGPT = new ChatGPTModel({
 *   systemPrompt: 'Ты - помощник по программированию',
 *   model: 'gpt-4',
 * });
 */
export class ChatGPTModel extends AIModel {
  constructor(config: ChatGPTConfig = {}) {
    super(
      config,
      import.meta.env.VITE_CHATGPT_PROXY_URL || 'http://localhost:3001/api/chatgpt',
      'gpt-3.5-turbo'
    );
  }
}

/**
 * Создает экземпляр ChatGPT модели
 */
export const createChatGPTModel = (config?: ChatGPTConfig): ChatGPTModel => {
  return new ChatGPTModel(config);
};


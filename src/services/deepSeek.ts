/**
 * Реализация DeepSeek модели
 */

import { AIModel, AIModelConfig } from './aiModel';

/**
 * Конфигурация для DeepSeek модели
 */
export interface DeepSeekConfig extends AIModelConfig {
  model?: 'deepseek-chat' | 'deepseek-coder';
}

/**
 * Реализация DeepSeek модели
 * 
 * @example
 * const deepSeek = new DeepSeekModel({
 *   systemPrompt: 'Ты - эксперт по программированию',
 *   model: 'deepseek-chat',
 * });
 */
export class DeepSeekModel extends AIModel {
  constructor(config: DeepSeekConfig = {}) {
    super(
      config,
      import.meta.env.VITE_DEEPSEEK_PROXY_URL || 'http://localhost:3001/api/deepseek',
      'deepseek-chat'
    );
  }
}

/**
 * Создает экземпляр DeepSeek модели
 */
export const createDeepSeekModel = (config?: DeepSeekConfig): DeepSeekModel => {
  return new DeepSeekModel(config);
};


/**
 * Реализация LM Studio модели (локальная модель)
 */

import { AIModel, AIModelConfig } from './aiModel';

/**
 * Конфигурация для LM Studio модели
 */
export interface LMStudioConfig extends AIModelConfig {
  model?: string; // Название модели в LM Studio (например, 'mistralai/ministral-3-3b')
}

/**
 * Реализация LM Studio модели
 * 
 * @example
 * const lmStudio = new LMStudioModel({
 *   systemPrompt: 'Ты - помощник по программированию',
 *   model: 'mistralai/ministral-3-3b',
 * });
 */
export class LMStudioModel extends AIModel {
  constructor(config: LMStudioConfig = {}) {
    super(
      config,
      import.meta.env.VITE_LM_STUDIO_PROXY_URL || 'http://localhost:3001/api/lmstudio',
      config.model || '__auto__' // Автоматический выбор модели из LM Studio
    );
  }
}

/**
 * Создает экземпляр LM Studio модели
 */
export const createLMStudioModel = (config?: LMStudioConfig): LMStudioModel => {
  return new LMStudioModel(config);
};


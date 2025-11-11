/**
 * Реализация HuggingFace Inference Providers модели
 */

import { AIModel, AIModelConfig } from './aiModel';

/**
 * Конфигурация для HuggingFace модели
 */
export interface HuggingFaceConfig extends AIModelConfig {
  model?: string;
  provider?: 'auto' | 'fastest' | 'cheapest' | string;
}

/**
 * Реализация HuggingFace Inference Providers модели
 * 
 * @example
 * const huggingFace = new HuggingFaceModel({
 *   systemPrompt: 'Ты - эксперт по программированию',
 *   model: 'deepseek-ai/DeepSeek-R1',
 *   provider: 'fastest',
 * });
 */
export class HuggingFaceModel extends AIModel {
  private provider?: string;

  constructor(config: HuggingFaceConfig = {}) {
    super(
      config,
      import.meta.env.VITE_HUGGINGFACE_PROXY_URL || 'http://localhost:3001/api/huggingface',
      config.model || 'deepseek-ai/DeepSeek-R1'
    );
    this.provider = config.provider;
  }

  /**
   * Добавляет provider в запрос, если он указан
   */
  protected getAdditionalRequestData(): Record<string, any> {
    return this.provider ? { provider: this.provider } : {};
  }

  /**
   * Обновляет конфигурацию модели
   */
  updateConfig(config: Partial<HuggingFaceConfig>): void {
    super.updateConfig(config);
    if (config.provider !== undefined) {
      this.provider = config.provider;
    }
  }
}

/**
 * Создает экземпляр HuggingFace модели
 */
export const createHuggingFaceModel = (config?: HuggingFaceConfig): HuggingFaceModel => {
  return new HuggingFaceModel(config);
};


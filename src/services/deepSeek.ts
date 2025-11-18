/**
 * Реализация DeepSeek модели
 */

import { AIModel, AIModelConfig } from './aiModel';

/**
 * Конфигурация для DeepSeek модели
 */
export interface DeepSeekConfig extends AIModelConfig {
  model?: 'deepseek-chat' | 'deepseek-coder';
  enableMCP?: boolean; // Включить поддержку MCP tools
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
  protected enableMCP: boolean;

  constructor(config: DeepSeekConfig = {}) {
    super(
      config,
      import.meta.env.VITE_DEEPSEEK_PROXY_URL || 'http://localhost:3001/api/deepseek',
      'deepseek-chat'
    );
    this.enableMCP = config.enableMCP || false;
  }

  /**
   * Переопределяем buildRequestBody для добавления enableMCP
   */
  protected buildRequestBody(validMessages: Array<{ role: 'user' | 'assistant' | 'system'; text: string }>, additionalData?: Record<string, any>): Record<string, any> {
    const body = super.buildRequestBody(validMessages, additionalData);
    if (this.enableMCP) {
      body.enableMCP = true;
    }
    return body;
  }
}

/**
 * Создает экземпляр DeepSeek модели
 */
export const createDeepSeekModel = (config?: DeepSeekConfig): DeepSeekModel => {
  return new DeepSeekModel(config);
};


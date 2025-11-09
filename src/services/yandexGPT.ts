import { AIModel, AIModelConfig } from './aiModel';

/**
 * Конфигурация для YandexGPT модели
 */
export interface YandexGPTConfig extends AIModelConfig {
  folderId?: string;
}

/**
 * Реализация YandexGPT модели
 */
export class YandexGPTModel extends AIModel {
  private folderId?: string;

  constructor(config: YandexGPTConfig = {}) {
    super(
      config,
      import.meta.env.VITE_API_PROXY_URL || 'http://localhost:3001/api/yandex-gpt',
      'yandexgpt-lite'
    );
    this.folderId = config.folderId;
  }

  /**
   * Добавляет folderId в запрос, если он указан
   */
  protected getAdditionalRequestData(): Record<string, any> {
    return this.folderId ? { folderId: this.folderId } : {};
  }

  /**
   * Обновляет конфигурацию модели
   */
  updateConfig(config: Partial<YandexGPTConfig>): void {
    super.updateConfig(config);
    if (config.folderId !== undefined) {
      this.folderId = config.folderId;
    }
  }
}

/**
 * Создает экземпляр YandexGPT модели с указанной конфигурацией
 * @param config Конфигурация модели (опционально)
 * @returns Экземпляр YandexGPTModel
 */
export const createYandexGPTModel = (config?: YandexGPTConfig): YandexGPTModel => {
  return new YandexGPTModel(config);
};

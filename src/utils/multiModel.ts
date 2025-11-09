import { AIModel, AIMessage } from '../services/aiModel';
import { AIResponse } from '../types/message';

/**
 * Результат выполнения запроса к модели с информацией о модели
 */
export interface ModelResponse {
  modelName: string;
  response: AIResponse;
  error?: Error;
}

/**
 * Выполняет параллельные запросы к нескольким моделям
 * @param models Массив моделей с их именами
 * @param messages Сообщения для отправки
 * @returns Массив результатов от каждой модели
 */
export async function sendToMultipleModels(
  models: Array<{ model: AIModel; name: string }>,
  messages: AIMessage[]
): Promise<ModelResponse[]> {
  // Выполняем все запросы параллельно
  const promises = models.map(async ({ model, name }) => {
    try {
      const response = await model.sendMessage(messages);
      return {
        modelName: name,
        response,
      } as ModelResponse;
    } catch (error) {
      return {
        modelName: name,
        response: {
          content: `Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
          references: [],
        },
        error: error instanceof Error ? error : new Error(String(error)),
      } as ModelResponse;
    }
  });

  return Promise.all(promises);
}


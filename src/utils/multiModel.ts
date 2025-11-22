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
 * @param chatId ID чата (опционально)
 * @param requestId ID запроса для отслеживания статусов (опционально)
 * @returns Массив результатов от каждой модели
 */
export async function sendToMultipleModels(
  models: Array<{ model: AIModel; name: string }>,
  messages: AIMessage[],
  chatId?: string,
  requestId?: string
): Promise<ModelResponse[]> {
  // Выполняем все запросы параллельно, каждая модель измеряет свое время
  const promises = models.map(async ({ model, name }) => {
    const startTime = performance.now();
    try {
      const additionalData: Record<string, any> = {};
      if (chatId) additionalData.chatId = chatId;
      if (requestId) additionalData.requestId = requestId;
      const response = await model.sendMessage(messages, Object.keys(additionalData).length > 0 ? additionalData : undefined);
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      return {
        modelName: name,
        response: {
          ...response,
          responseTime: response.responseTime ?? responseTime,
        },
      } as ModelResponse;
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      return {
        modelName: name,
        response: {
          content: `Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
          references: [],
          responseTime,
        },
        error: error instanceof Error ? error : new Error(String(error)),
      } as ModelResponse;
    }
  });

  return Promise.all(promises);
}


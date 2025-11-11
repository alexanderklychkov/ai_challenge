import { AIModel, AIMessage } from '../services/aiModel';
import { Message } from '../types/message';
import { AIResponse } from '../types/message';

/**
 * Тип команды
 */
export type CommandType = 'analyze' | 'help';

/**
 * Результат обработки команды
 */
export interface CommandResult {
  isCommand: boolean;
  commandType?: CommandType;
  args?: string[];
}

/**
 * Проверяет, является ли текст командой
 */
export function parseCommand(text: string): CommandResult {
  const trimmed = text.trim();
  
  if (!trimmed.startsWith('/')) {
    return { isCommand: false };
  }

  const parts = trimmed.split(/\s+/);
  const commandName = parts[0].substring(1).toLowerCase();
  const args = parts.slice(1);

  // Определяем тип команды
  if (commandName === 'analyze' || commandName === 'анализ') {
    return { isCommand: true, commandType: 'analyze', args };
  }
  
  if (commandName === 'help' || commandName === 'помощь') {
    return { isCommand: true, commandType: 'help', args };
  }

  return { isCommand: true, commandType: undefined, args };
}

/**
 * Выполняет команду /analyze
 * Анализирует последние ответы моделей и создает сводный анализ
 */
export async function executeAnalyzeCommand(
  analyzerModel: AIModel,
  messages: Message[],
  modelName: string = 'Анализатор'
): Promise<AIResponse> {
  // Находим последние ответы от моделей (не команды и не системные сообщения)
  const recentAssistantMessages = messages
    .filter(msg => msg.type === 'assistant' && msg.modelName)
    .slice(-10); // Берем последние 10 ответов

  if (recentAssistantMessages.length === 0) {
    return {
      content: 'Нет ответов для анализа. Сначала задайте вопрос моделям.',
      references: [],
    };
  }

  // Формируем промпт для анализа
  const analysisPrompt = `Проанализируй и сравни качество ответов различных AI моделей на вопросы пользователя.

Вот последние ответы моделей:

${recentAssistantMessages.map((msg, index) => `
${index + 1}. Модель: ${msg.modelName}
   Время ответа: ${msg.aiResponse?.responseTime ? (msg.aiResponse.responseTime / 1000).toFixed(2) + 'с' : 'неизвестно'}
   Токенов: ${msg.aiResponse?.tokens || 'неизвестно'}
   Стоимость: ${msg.aiResponse?.cost ? '$' + msg.aiResponse.cost.toFixed(6) : 'неизвестно'}
   Ответ:
   ${msg.content}
`).join('\n---\n')}

Проведи детальный анализ:
1. Сравни качество ответов по точности, полноте и релевантности
2. Оцени скорость работы каждой модели
3. Сравни стоимость использования (если доступна)
4. Выдели сильные и слабые стороны каждого ответа
5. Дай рекомендации: какая модель лучше подходит для каких типов вопросов
6. Укажи, есть ли существенные различия в ответах

Представь анализ в структурированном виде с четкими выводами.`;

  const aiMessages: AIMessage[] = [
    {
      role: 'user',
      text: analysisPrompt,
    },
  ];

  const startTime = performance.now();
  const response = await analyzerModel.sendMessage(aiMessages);
  const endTime = performance.now();
  const responseTime = endTime - startTime;

  return {
    ...response,
    responseTime: response.responseTime ?? responseTime,
  };
}

/**
 * Выполняет команду /help
 * Возвращает список доступных команд
 */
export function executeHelpCommand(): AIResponse {
  return {
    content: `# Доступные команды

## /analyze (или /анализ)
Анализирует и сравнивает качество последних ответов моделей.
- Сравнивает точность, полноту и релевантность ответов
- Оценивает скорость работы моделей
- Сравнивает стоимость использования
- Дает рекомендации по выбору модели

## /help (или /помощь)
Показывает этот список команд.

---
*Команды начинаются с символа "/"*`,
    references: [],
  };
}


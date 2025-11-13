import { Message } from '../types/message';
import { AIModel, AIMessage } from '../services/aiModel';
import { generateId } from './generateId';

/**
 * Создает summary (сжатие) для группы сообщений
 * @param messages - массив сообщений для сжатия
 * @param model - AI модель для создания summary
 * @param modelName - название модели
 * @returns Promise с summary сообщением
 */
export async function createSummary(
  messages: Message[],
  model: AIModel,
  modelName: string
): Promise<Message> {
  if (messages.length === 0) {
    throw new Error('Cannot create summary from empty messages array');
  }

  // Формируем промпт для создания summary
  const conversationText = messages
    .map((msg) => {
      const role = msg.type === 'user' ? 'Пользователь' : 'Ассистент';
      return `${role}: ${msg.content}`;
    })
    .join('\n\n');

  const summaryPrompt = `Создай краткое резюме следующего диалога, сохраняя ключевые моменты, вопросы и ответы. Резюме должно быть на русском языке и содержать только важную информацию.

Диалог:
${conversationText}

Резюме:`;

  // Конвертируем в формат для AI модели
  const aiMessages: AIMessage[] = [
    {
      role: 'user',
      text: summaryPrompt,
    },
  ];

  try {
    const response = await model.sendMessage(aiMessages);
    
    // Создаем summary сообщение
    const summaryMessage: Message = {
      id: generateId(),
      type: 'assistant',
      content: `[Сжатие истории] ${response.content}`,
      timestamp: new Date(),
      isSummary: true,
      originalMessageIds: messages.map((msg) => msg.id),
      aiResponse: {
        ...response,
        // Увеличиваем токены summary, так как это дополнительный запрос
      },
      modelName: `${modelName} (Summary)`,
    };

    return summaryMessage;
  } catch (error) {
    console.error('Error creating summary:', error);
    throw error;
  }
}

/**
 * Проверяет, нужно ли создать summary (каждые N сообщений)
 * @param messages - текущий массив сообщений
 * @param compressionInterval - интервал сжатия (по умолчанию 6)
 * @returns true, если нужно создать summary
 */
export function shouldCreateSummary(
  messages: Message[],
  compressionInterval: number = 6
): boolean {
  // Игнорируем summary сообщения при подсчете
  const nonSummaryMessages = messages.filter((msg) => !msg.isSummary);
  
  // Если сообщений меньше интервала, summary не нужен
  if (nonSummaryMessages.length < compressionInterval) {
    return false;
  }

  // Проверяем, есть ли уже summary для последних сообщений
  // Если последнее сообщение - это summary, значит уже было сжатие
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.isSummary) {
    return false;
  }

  // Проверяем количество сообщений с последнего summary
  let countSinceLastSummary = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].isSummary) {
      break;
    }
    // Считаем только не-summary сообщения
    countSinceLastSummary++;
  }

  return countSinceLastSummary >= compressionInterval;
}

/**
 * Находит сообщения для сжатия (ровно compressionInterval сообщений)
 * @param messages - текущий массив сообщений
 * @param compressionInterval - количество сообщений для сжатия (по умолчанию 6)
 * @returns массив сообщений для сжатия
 */
export function getMessagesToCompress(
  messages: Message[],
  compressionInterval: number = 6
): Message[] {
  // Находим индекс последнего summary или начало массива
  let lastSummaryIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].isSummary) {
      lastSummaryIndex = i;
      break;
    }
  }

  // Берем сообщения после последнего summary (исключая summary сообщения и уже сжатые)
  const messagesAfterSummary = messages
    .slice(lastSummaryIndex + 1)
    .filter((msg) => !msg.isSummary && !msg.compressedBy);
  
  // Если сообщений меньше чем compressionInterval, не сжимаем ничего
  if (messagesAfterSummary.length < compressionInterval) {
    return [];
  }
  
  // Сжимаем ровно compressionInterval сообщений (первые compressionInterval из доступных)
  // Это гарантирует, что сжимается ровно столько, сколько указано в compressionInterval
  // Старые сообщения сжимаются первыми
  return messagesAfterSummary.slice(0, compressionInterval);
}


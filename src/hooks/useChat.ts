import { useState, useCallback } from 'react';
import { Message } from '../types/message';
import { generateId } from '../utils/generateId';
import { AIModel, AIMessage } from '../services/aiModel';
import { sendToMultipleModels } from '../utils/multiModel';
import { parseCommand, executeAnalyzeCommand, executeHelpCommand } from '../utils/commands';

const initialMessages: Message[] = [
  // {
  //   id: generateId(),
  //   type: 'assistant',
  //   content: 'Привет! Я ваш помощник по фронтенд-разработке. Задавайте любые вопросы о React, TypeScript, CSS, JavaScript и других технологиях. Я готов помочь с примерами кода, объяснениями и решением задач!',
  //   timestamp: new Date(),
  // },
];

/**
 * Режим работы с несколькими моделями
 * - 'parallel' - все модели отвечают параллельно на один вопрос, результаты появляются одновременно
 * - 'chain' - модели отвечают последовательно, каждая видит ответы предыдущих
 * - 'chain-fast' - модели выполняются параллельно, первая завершившаяся пишет в чат первой
 */
export type ModelMode = 'parallel' | 'chain' | 'chain-fast';

interface UseChatOptions {
  models: Array<{ model: AIModel; name: string }>;
  mode?: ModelMode; // Режим работы: параллельный или цепочкой
  analyzerModel?: { model: AIModel; name: string }; // Модель для анализа (команда /analyze)
}

export const useChat = (options: UseChatOptions) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { models, mode = 'parallel', analyzerModel } = options;

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Проверяем, является ли сообщение командой
    const commandResult = parseCommand(content.trim());
    
    if (commandResult.isCommand) {
      const userMessage: Message = {
        id: generateId(),
        type: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        if (commandResult.commandType === 'analyze') {
          if (!analyzerModel) {
            const errorMessage: Message = {
              id: generateId(),
              type: 'assistant',
              content: 'Ошибка: Модель-анализатор не настроена. Добавьте analyzerModel в конфигурацию useChat.',
              timestamp: new Date(),
              modelName: 'Система',
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
          }

          const analysisResponse = await executeAnalyzeCommand(
            analyzerModel.model,
            messages,
            analyzerModel.name
          );

          const analysisMessage: Message = {
            id: generateId(),
            type: 'assistant',
            content: analysisResponse.content,
            timestamp: new Date(),
            aiResponse: analysisResponse,
            modelName: analyzerModel.name,
          };

          setMessages((prev) => [...prev, analysisMessage]);
        } else if (commandResult.commandType === 'help') {
          const helpResponse = executeHelpCommand();
          const helpMessage: Message = {
            id: generateId(),
            type: 'assistant',
            content: helpResponse.content,
            timestamp: new Date(),
            aiResponse: helpResponse,
            modelName: 'Система',
          };
          setMessages((prev) => [...prev, helpMessage]);
        } else {
          const errorMessage: Message = {
            id: generateId(),
            type: 'assistant',
            content: `Неизвестная команда: ${content.trim()}\n\nИспользуйте /help для списка доступных команд.`,
            timestamp: new Date(),
            modelName: 'Система',
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Произошла ошибка при выполнении команды';
        setError(errorMessage);
        
        const errorResponseMessage: Message = {
          id: generateId(),
          type: 'assistant',
          content: `Ошибка при выполнении команды: ${errorMessage}`,
          timestamp: new Date(),
          modelName: 'Система',
        };
        
        setMessages((prev) => [...prev, errorResponseMessage]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Обычная логика для не-команд
    const userMessage: Message = {
      id: generateId(),
      type: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const recentMessages = messages.slice(-10);
      
      if (mode === 'parallel') {
        // Параллельный режим: все модели отвечают одновременно на один вопрос
        const aiMessages = models[0].model.convertMessages([
          ...recentMessages,
          { type: 'user', content: content.trim() },
        ]);

        const responses = await sendToMultipleModels(models, aiMessages);
        
        const assistantMessages = responses.map(({ modelName, response }) => ({
          id: generateId(),
          type: 'assistant' as const,
          content: response.content,
          timestamp: new Date(),
          aiResponse: response,
          modelName,
        }));

        setMessages((prev) => [...prev, ...assistantMessages]);
      } else if (mode === 'chain') {
        // Режим цепочки (старая логика): модели отвечают последовательно, каждая видит ответы предыдущих
        let conversationHistory: Message[] = [...recentMessages, userMessage];

        for (let i = 0; i < models.length; i++) {
          const { model, name } = models[i];
          
          try {
            const aiMessages: AIMessage[] = model.convertMessages(
              conversationHistory.map((msg) => ({
                type: msg.type as 'user' | 'assistant',
                content: msg.content,
              }))
            );

            const startTime = performance.now();
            const response = await model.sendMessage(aiMessages);
            const endTime = performance.now();
            const responseTime = endTime - startTime;
            
            const assistantMessage: Message = {
              id: generateId(),
              type: 'assistant',
              content: response.content,
              timestamp: new Date(),
              aiResponse: {
                ...response,
                responseTime: response.responseTime ?? responseTime,
              },
              modelName: name,
            };

            conversationHistory = [...conversationHistory, assistantMessage];
            setMessages((prev) => [...prev, assistantMessage]);
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            const errorMessageObj: Message = {
              id: generateId(),
              type: 'assistant',
              content: `Ошибка ${name}: ${errorMessage}`,
              timestamp: new Date(),
              modelName: name,
            };
            
            conversationHistory = [...conversationHistory, errorMessageObj];
            setMessages((prev) => [...prev, errorMessageObj]);
          }
        }
      } else if (mode === 'chain-fast') {
        // Режим быстрой цепочки: модели выполняются параллельно, первая завершившаяся пишет в чат первой
        // Все модели видят исходную историю разговора (без ответов других моделей из этого запроса)
        const conversationHistory: Message[] = [...recentMessages, userMessage];

        // Запускаем все модели параллельно и обрабатываем результаты по мере готовности
        const promises = models.map(async ({ model, name }) => {
          const startTime = performance.now();
          try {
            // Каждая модель видит исходную историю разговора
            const aiMessages: AIMessage[] = model.convertMessages(
              conversationHistory.map((msg) => ({
                type: msg.type as 'user' | 'assistant',
                content: msg.content,
              }))
            );

            const response = await model.sendMessage(aiMessages);
            const endTime = performance.now();
            const responseTime = endTime - startTime;
            
            const assistantMessage: Message = {
              id: generateId(),
              type: 'assistant',
              content: response.content,
              timestamp: new Date(),
              aiResponse: {
                ...response,
                responseTime: response.responseTime ?? responseTime,
              },
              modelName: name,
            };

            // Добавляем сообщение в чат сразу после получения ответа
            setMessages((prev) => [...prev, assistantMessage]);
            
            return { name, message: assistantMessage, error: null };
          } catch (err) {
            const endTime = performance.now();
            const responseTime = endTime - startTime;
            const errorMessage = err instanceof Error ? err.message : 'Неизвестная ошибка';
            const errorMessageObj: Message = {
              id: generateId(),
              type: 'assistant',
              content: `Ошибка ${name}: ${errorMessage}`,
              timestamp: new Date(),
              modelName: name,
              aiResponse: {
                content: `Ошибка ${name}: ${errorMessage}`,
                references: [],
                responseTime,
              },
            };

            // Добавляем сообщение об ошибке в чат сразу
            setMessages((prev) => [...prev, errorMessageObj]);
            
            return { name, message: errorMessageObj, error: err };
          }
        });

        // Ждем завершения всех промисов (для обработки ошибок)
        await Promise.allSettled(promises);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Произошла ошибка при обращении к AI модели';
      setError(errorMessage);
      
      const errorResponseMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: `Ошибка: ${errorMessage}`,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorResponseMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, models, mode, analyzerModel]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
};

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Message } from '../types/message';
import { generateId } from '../utils/generateId';
import { AIModel, AIMessage } from '../services/aiModel';
import { sendToMultipleModels } from '../utils/multiModel';
import { parseCommand, executeAnalyzeCommand, executeHelpCommand } from '../utils/commands';
import { createSummary, shouldCreateSummary, getMessagesToCompress } from '../utils/summarizer';
import { loadMessages, saveMessages, clearMessages as clearMessagesStorage } from '../services/storage';

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
  enableCompression?: boolean; // Включить сжатие истории
  compressionInterval?: number; // Интервал сжатия (по умолчанию 6 сообщений)
  compressionModel?: { model: AIModel; name: string }; // Модель для создания summary (если не указана, используется первая модель)
}

export interface TokenStatistics {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  summaryTokens: number; // Токены, потраченные на создание summary
  compressedMessages: number; // Количество сжатых сообщений
}

export const useChat = (options: UseChatOptions) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true); // Состояние загрузки сообщений
  const [error, setError] = useState<string | null>(null);
  const isCreatingSummaryRef = useRef(false); // Флаг для предотвращения одновременного создания summary
  const isInitialLoadRef = useRef(true); // Флаг для отслеживания первоначальной загрузки (начинаем с true)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Таймер для отложенного сохранения
  
  const { 
    models, 
    mode = 'parallel', 
    analyzerModel,
    enableCompression = false,
    compressionInterval = 6,
    compressionModel,
  } = options;

  // Вычисляем статистику токенов
  const tokenStatistics = useMemo<TokenStatistics>(() => {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    let summaryTokens = 0;
    let compressedMessages = 0;

    messages.forEach((msg) => {
      if (msg.aiResponse) {
        // Явно преобразуем значения в числа, чтобы избежать конкатенации строк
        const inputTokens = Number(msg.aiResponse.inputTokens) || 0;
        const outputTokens = Number(msg.aiResponse.outputTokens) || 0;
        const cost = Number(msg.aiResponse.cost) || 0;
        
        if (msg.isSummary) {
          summaryTokens += inputTokens + outputTokens;
          compressedMessages++;
        } else {
          totalInputTokens += inputTokens;
          totalOutputTokens += outputTokens;
        }
        totalCost += cost;
      }
    });

    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCost,
      summaryTokens,
      compressedMessages,
    };
  }, [messages]);

  // Получает историю сообщений для отправки в AI, учитывая сжатие
  const getConversationHistory = useCallback((allMessages: Message[], limit?: number): Message[] => {
    // Если сжатие отключено, возвращаем обычную историю
    if (!enableCompression) {
      return limit ? allMessages.slice(-limit) : allMessages;
    }

    // Собираем историю с учетом summary
    // Если сообщение имеет compressedBy, заменяем его на соответствующий summary
    const history: Message[] = [];
    const summaryMap = new Map<string, Message>(); // Map: summaryId -> summary message
    
    // Сначала собираем все summary в map
    allMessages.forEach((msg) => {
      if (msg.isSummary && msg.id) {
        summaryMap.set(msg.id, msg);
      }
    });

    // Проходим с конца и собираем сообщения
    const addedSummaryIds = new Set<string>(); // Отслеживаем уже добавленные summary
    
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i];
      
      // Если это summary, пропускаем его (он будет использован для замены сжатых сообщений)
      if (msg.isSummary) {
        continue;
      }
      
      // Если сообщение сжато, заменяем его на summary
      if (msg.compressedBy) {
        const summary = summaryMap.get(msg.compressedBy);
        if (summary && !addedSummaryIds.has(summary.id)) {
          history.unshift(summary);
          addedSummaryIds.add(summary.id);
        }
      } else {
        // Добавляем обычное сообщение, если оно не было сжато
        history.unshift(msg);
      }

      // Ограничиваем историю, если указан лимит
      if (limit && history.length >= limit) {
        break;
      }
    }

    return history;
  }, [enableCompression]);

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
      // Получаем историю с учетом сжатия
      const recentMessages = getConversationHistory(messages, 10);
      
      if (mode === 'parallel') {
        // Параллельный режим: все модели отвечают одновременно на один вопрос
        const aiMessages = models[0].model.convertMessages([
          ...recentMessages.map((msg) => ({
            type: msg.type as 'user' | 'assistant',
            content: msg.content,
          })),
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

        setMessages((prev) => {
          const updated = [...prev, ...assistantMessages];
          
          // Проверяем, нужно ли создать summary после добавления ответов
          if (enableCompression && !isCreatingSummaryRef.current && shouldCreateSummary(updated, compressionInterval)) {
            // Устанавливаем флаг, чтобы предотвратить повторное создание
            isCreatingSummaryRef.current = true;
            
            // Создаем summary асинхронно, не блокируя UI
            const modelForCompression = compressionModel || models[0];
            const messagesToCompress = getMessagesToCompress(updated, compressionInterval);
            
            createSummary(messagesToCompress, modelForCompression.model, modelForCompression.name)
              .then((summaryMessage) => {
                setMessages((current) => {
                  // Помечаем оригинальные сообщения как сжатые
                  const updated = current.map((msg) => {
                    if (messagesToCompress.some((m) => m.id === msg.id)) {
                      return { ...msg, compressedBy: summaryMessage.id };
                    }
                    return msg;
                  });
                  // Добавляем summary
                  return [...updated, summaryMessage];
                });
              })
              .catch((err) => {
                console.error('Failed to create summary:', err);
              })
              .finally(() => {
                // Сбрасываем флаг после завершения
                isCreatingSummaryRef.current = false;
              });
          }
          
          return updated;
        });
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
            setMessages((prev) => {
              const updated = [...prev, assistantMessage];
              
              // Проверяем, нужно ли создать summary после добавления ответа
              if (enableCompression && !isCreatingSummaryRef.current && shouldCreateSummary(updated, compressionInterval)) {
                // Устанавливаем флаг, чтобы предотвратить повторное создание
                isCreatingSummaryRef.current = true;
                
                const modelForCompression = compressionModel || models[0];
                const messagesToCompress = getMessagesToCompress(updated, compressionInterval);
                
                createSummary(messagesToCompress, modelForCompression.model, modelForCompression.name)
                  .then((summaryMessage) => {
                    setMessages((current) => {
                      // Помечаем оригинальные сообщения как сжатые
                      const updated = current.map((msg) => {
                        if (messagesToCompress.some((m) => m.id === msg.id)) {
                          return { ...msg, compressedBy: summaryMessage.id };
                        }
                        return msg;
                      });
                      // Добавляем summary
                      return [...updated, summaryMessage];
                    });
                  })
                  .catch((err) => {
                    console.error('Failed to create summary:', err);
                  })
                  .finally(() => {
                    // Сбрасываем флаг после завершения
                    isCreatingSummaryRef.current = false;
                  });
              }
              
              return updated;
            });
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
        
        // Проверяем сжатие после завершения всех ответов
        setMessages((current) => {
          if (enableCompression && !isCreatingSummaryRef.current && shouldCreateSummary(current, compressionInterval)) {
            // Устанавливаем флаг, чтобы предотвратить повторное создание
            isCreatingSummaryRef.current = true;
            
            const modelForCompression = compressionModel || models[0];
            const messagesToCompress = getMessagesToCompress(current, compressionInterval);
            
            createSummary(messagesToCompress, modelForCompression.model, modelForCompression.name)
              .then((summaryMessage) => {
                setMessages((prev) => {
                  // Помечаем оригинальные сообщения как сжатые
                  const updated = prev.map((msg) => {
                    if (messagesToCompress.some((m) => m.id === msg.id)) {
                      return { ...msg, compressedBy: summaryMessage.id };
                    }
                    return msg;
                  });
                  // Добавляем summary
                  return [...updated, summaryMessage];
                });
              })
              .catch((err) => {
                console.error('Failed to create summary:', err);
              })
              .finally(() => {
                // Сбрасываем флаг после завершения
                isCreatingSummaryRef.current = false;
              });
          }
          return current;
        });
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
  }, [messages, models, mode, analyzerModel, enableCompression, compressionInterval, compressionModel, getConversationHistory]);

  // Загрузка сообщений при монтировании компонента
  useEffect(() => {
    loadMessages().then((loadedMessages) => {
      if (loadedMessages.length > 0) {
        setMessages(loadedMessages);
      }
      // После загрузки разрешаем автоматическое сохранение
      isInitialLoadRef.current = false;
      setIsLoadingMessages(false);
    }).catch((error) => {
      console.error('Ошибка при загрузке сообщений:', error);
      setIsLoadingMessages(false);
    });
  }, []);

  // Автоматическое сохранение сообщений при их изменении (с debounce)
  useEffect(() => {
    // Пропускаем сохранение при первоначальной загрузке
    if (isInitialLoadRef.current) {
      return;
    }

    // Очищаем предыдущий таймер
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Устанавливаем новый таймер для отложенного сохранения (500ms debounce)
    saveTimeoutRef.current = setTimeout(() => {
      saveMessages(messages).catch((error) => {
        console.error('Ошибка при автоматическом сохранении сообщений:', error);
      });
    }, 500);

    // Очистка таймера при размонтировании
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages]);

  const clearMessages = useCallback(async () => {
    setMessages([]);
    setError(null);
    // Очищаем сообщения на сервере
    await clearMessagesStorage();
  }, []);

  return {
    messages,
    isLoading,
    isLoadingMessages,
    error,
    sendMessage,
    clearMessages,
    tokenStatistics,
  };
};

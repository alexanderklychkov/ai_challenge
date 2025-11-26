import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Message, StatusMessage } from '../types/message';
import { generateId } from '../utils/generateId';
import { AIModel, AIMessage } from '../services/aiModel';
import { sendToMultipleModels } from '../utils/multiModel';
import { parseCommand, executeAnalyzeCommand, executeHelpCommand } from '../utils/commands';
import { createSummary, shouldCreateSummary, getMessagesToCompress } from '../utils/summarizer';
import { loadMessages, saveMessages, clearMessages as clearMessagesStorage } from '../services/storage';
import { compareRAGvsNoRAG, queryWithRAG } from '../services/rag';

const API_BASE_URL = import.meta.env.VITE_API_PROXY_URL?.replace(/\/api\/.*$/, '') || 'http://localhost:3001';

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
  chatId: string; // ID текущего чата
  models: Array<{ model: AIModel; name: string }>;
  mode?: ModelMode; // Режим работы: параллельный или цепочкой
  analyzerModel?: { model: AIModel; name: string }; // Модель для анализа (команда /analyze)
  enableCompression?: boolean; // Включить сжатие истории
  compressionInterval?: number; // Интервал сжатия (по умолчанию 6 сообщений)
  compressionModel?: { model: AIModel; name: string }; // Модель для создания summary (если не указана, используется первая модель)
  ragMode?: 'none' | 'rag' | 'compare'; // Режим RAG: none - без RAG, rag - с RAG, compare - сравнение
  ragTopK?: number; // Количество чанков для поиска
  ragMinScore?: number; // Минимальный score для включения чанка
  modelType?: 'deepseek' | 'yandex' | 'chatgpt' | 'huggingface'; // Тип модели для RAG запросов
  // Настройки reranker
  ragUseReranker?: boolean; // Использовать ли reranker для фильтрации результатов
  ragRerankerStrategy?: 'threshold' | 'llm_score' | 'hybrid'; // Стратегия reranking
  ragRerankerThreshold?: number; // Порог релевантности для reranker (0-1)
  ragRerankerTopK?: number; // Количество результатов после reranking
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
  const statusEventSourceRef = useRef<EventSource | null>(null); // SSE соединение для статусов
  const activeStatusMessagesRef = useRef<Map<string, Message>>(new Map()); // Активные статусные сообщения
  
  const { 
    chatId,
    models, 
    mode = 'parallel', 
    analyzerModel,
    enableCompression = false,
    compressionInterval = 6,
    compressionModel,
    ragMode = 'none',
    ragTopK = 5,
    ragMinScore = 0.3,
    modelType = 'deepseek',
    ragUseReranker = false,
    ragRerankerStrategy = 'threshold',
    ragRerankerThreshold = 0.5,
    ragRerankerTopK,
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

  /**
   * Подключается к SSE потоку для получения статусов выполнения инструментов
   */
  const connectToStatusStream = useCallback((requestId: string) => {
    // Закрываем предыдущее соединение, если оно есть
    if (statusEventSourceRef.current) {
      statusEventSourceRef.current.close();
    }
    
    // Создаем новое SSE соединение
    const eventSource = new EventSource(`${API_BASE_URL}/api/status/${requestId}`);
    statusEventSourceRef.current = eventSource;
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'close') {
          // Соединение закрыто, удаляем статусные сообщения
          setMessages((prev) => {
            return prev.filter((msg) => msg.type !== 'status');
          });
          activeStatusMessagesRef.current.clear();
          eventSource.close();
          statusEventSourceRef.current = null;
          return;
        }
        
        // Создаем или обновляем статусное сообщение
        const statusMessage: StatusMessage = {
          toolName: data.toolName,
          status: data.status,
          message: data.message,
          timestamp: new Date(data.timestamp),
          serverName: data.serverName,
          error: data.error,
        };
        
        const messageId = `status-${data.toolName}-${data.timestamp}`;
        const existingMessage = activeStatusMessagesRef.current.get(data.toolName);
        
        if (existingMessage) {
          // Обновляем существующее сообщение
          setMessages((prev) => {
            return prev.map((msg) => {
              if (msg.id === existingMessage.id) {
                return {
                  ...msg,
                  statusMessage,
                  content: statusMessage.message,
                };
              }
              return msg;
            });
          });
        } else {
          // Создаем новое статусное сообщение
          const newMessage: Message = {
            id: messageId,
            type: 'status',
            content: statusMessage.message,
            timestamp: statusMessage.timestamp,
            statusMessage,
          };
          
          activeStatusMessagesRef.current.set(data.toolName, newMessage);
          setMessages((prev) => [...prev, newMessage]);
        }
        
        // Если статус завершен или ошибка, удаляем сообщение через некоторое время
        // Увеличиваем время показа для лучшей видимости
        if (data.status === 'completed' || data.status === 'error') {
          setTimeout(() => {
            setMessages((prev) => {
              return prev.filter((msg) => msg.id !== messageId);
            });
            activeStatusMessagesRef.current.delete(data.toolName);
          }, 5000); // Увеличено с 2 до 5 секунд
        }
      } catch (error) {
        console.error('Ошибка при обработке статуса:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('Ошибка SSE соединения:', error);
      eventSource.close();
      statusEventSourceRef.current = null;
    };
  }, [setMessages]);

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
      // Обработка RAG режима
      if (ragMode === 'compare') {
        // Режим сравнения: получаем оба ответа и показываем сравнение
        const recentMessages = getConversationHistory(messages, 10);
        const messagesForRAG = recentMessages.map((msg) => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content,
        }));

        const comparison = await compareRAGvsNoRAG(content.trim(), modelType, {
          messages: messagesForRAG,
          topK: ragTopK,
          minScore: ragMinScore,
          model: models[0]?.model.getConfig().model || undefined,
          temperature: models[0]?.model.getConfig().temperature,
          max_tokens: models[0]?.model.getConfig().maxTokens,
          system_prompt: models[0]?.model.getConfig().systemPrompt,
          useReranker: ragUseReranker,
          reranker: ragUseReranker ? {
            strategy: ragRerankerStrategy,
            threshold: ragRerankerThreshold,
            topKAfterRerank: ragRerankerTopK,
          } : undefined,
        });

        // Создаем специальное сообщение для сравнения
        const comparisonMessage: Message = {
          id: generateId(),
          type: 'assistant',
          content: `Сравнение ответов с RAG и без RAG для вопроса: "${comparison.question}"`,
          timestamp: new Date(),
          modelName: `RAG Comparison (${modelType})`,
          ragComparison: comparison,
        };

        setMessages((prev) => [...prev, comparisonMessage]);
        setIsLoading(false);
        return;
      } else if (ragMode === 'rag') {
        // Режим только с RAG
        const recentMessages = getConversationHistory(messages, 10);
        const messagesForRAG = recentMessages.map((msg) => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content,
        }));

        const ragResult = await queryWithRAG(content.trim(), modelType, {
          messages: messagesForRAG,
          topK: ragTopK,
          minScore: ragMinScore,
          model: models[0]?.model.getConfig().model || undefined,
          temperature: models[0]?.model.getConfig().temperature,
          max_tokens: models[0]?.model.getConfig().maxTokens,
          system_prompt: models[0]?.model.getConfig().systemPrompt,
          useReranker: ragUseReranker,
          reranker: ragUseReranker ? {
            strategy: ragRerankerStrategy,
            threshold: ragRerankerThreshold,
            topKAfterRerank: ragRerankerTopK,
          } : undefined,
        });

        const ragMessage: Message = {
          id: generateId(),
          type: 'assistant',
          content: ragResult.answer,
          timestamp: new Date(),
          modelName: `RAG (${modelType})`,
          aiResponse: {
            content: ragResult.answer,
            tokens: ragResult.metadata.tokens,
            inputTokens: ragResult.metadata.inputTokens,
            outputTokens: ragResult.metadata.outputTokens,
            references: [],
          },
          ragChunks: ragResult.chunks,
          ragWarning: ragResult.warning || null,
        };

        setMessages((prev) => [...prev, ragMessage]);
        setIsLoading(false);
        return;
      }

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

        // Генерируем requestId для отслеживания статусов
        const requestId = generateId();
        
        // Подключаемся к SSE для получения статусов
        connectToStatusStream(requestId);
        
        const responses = await sendToMultipleModels(models, aiMessages, chatId, requestId);
        
        // Закрываем SSE соединение после завершения запросов
        // НЕ удаляем статусные сообщения сразу - они будут удалены автоматически через таймаут
        if (statusEventSourceRef.current) {
          statusEventSourceRef.current.close();
          statusEventSourceRef.current = null;
        }
        
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

            // Генерируем requestId для отслеживания статусов
            const requestId = generateId();
            
            // Подключаемся к SSE для получения статусов
            connectToStatusStream(requestId);

            const startTime = performance.now();
            const response = await model.sendMessage(aiMessages, { chatId, requestId });
            const endTime = performance.now();
            
            // Закрываем SSE соединение после завершения запроса
            // НЕ удаляем статусные сообщения сразу - они будут удалены автоматически через таймаут
            if (statusEventSourceRef.current) {
              statusEventSourceRef.current.close();
              statusEventSourceRef.current = null;
            }
            
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

        // Генерируем requestId для отслеживания статусов
        const requestId = generateId();
        
        // Подключаемся к SSE для получения статусов
        connectToStatusStream(requestId);

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

            const response = await model.sendMessage(aiMessages, { chatId, requestId });
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
        
        // Закрываем SSE соединение после завершения всех запросов
        // НЕ удаляем статусные сообщения сразу - они будут удалены автоматически через таймаут
        if (statusEventSourceRef.current) {
          statusEventSourceRef.current.close();
          statusEventSourceRef.current = null;
        }
        
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
  }, [messages, models, mode, analyzerModel, enableCompression, compressionInterval, compressionModel, getConversationHistory, connectToStatusStream, chatId]);

  // Загрузка сообщений при монтировании компонента или смене chatId
  useEffect(() => {
    setIsLoadingMessages(true);
    isInitialLoadRef.current = true;
    setMessages([]);
    
    loadMessages(chatId).then((loadedMessages) => {
      if (loadedMessages.length > 0) {
        setMessages(loadedMessages);
      }
      // После загрузки разрешаем автоматическое сохранение
      isInitialLoadRef.current = false;
      setIsLoadingMessages(false);
    }).catch((error) => {
      console.error('Ошибка при загрузке сообщений:', error);
      setIsLoadingMessages(false);
      isInitialLoadRef.current = false;
    });
  }, [chatId]);

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
      // Сохраняем все сообщения, включая ответы AI
      saveMessages(chatId, messages).then(() => {
        // После сохранения обновляем счетчик на сервере
        // Сервер автоматически обновит messageCount при сохранении
      }).catch((error) => {
        console.error('Ошибка при автоматическом сохранении сообщений:', error);
      });
    }, 500);

    // Очистка таймера при размонтировании
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, chatId]);

  const clearMessages = useCallback(async () => {
    // Закрываем SSE соединение при очистке сообщений
    if (statusEventSourceRef.current) {
      statusEventSourceRef.current.close();
      statusEventSourceRef.current = null;
    }
    activeStatusMessagesRef.current.clear();
    
    setMessages([]);
    setError(null);
    // Очищаем сообщения на сервере
    await clearMessagesStorage(chatId);
  }, [chatId]);

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

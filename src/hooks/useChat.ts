import { useState, useCallback } from 'react';
import { Message } from '../types/message';
import { generateId } from '../utils/generateId';
import { AIModel, AIMessage } from '../services/aiModel';
import { sendToMultipleModels } from '../utils/multiModel';

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
 * - 'parallel' - все модели отвечают параллельно на один вопрос
 * - 'chain' - модели отвечают последовательно, каждая видит ответы предыдущих
 */
export type ModelMode = 'parallel' | 'chain';

interface UseChatOptions {
  models: Array<{ model: AIModel; name: string }>;
  mode?: ModelMode; // Режим работы: параллельный или цепочкой
}

export const useChat = (options: UseChatOptions) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { models, mode = 'parallel' } = options;

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

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
      } else {
        // Режим цепочки: модели отвечают последовательно, каждая видит ответы предыдущих
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

            const response = await model.sendMessage(aiMessages);
            
            const assistantMessage: Message = {
              id: generateId(),
              type: 'assistant',
              content: response.content,
              timestamp: new Date(),
              aiResponse: response,
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
  }, [messages, models, mode]);

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

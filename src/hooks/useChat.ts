import { useState, useCallback } from 'react';
import { Message } from '../types/message';
import { generateId } from '../utils/generateId';
import { sendToYandexGPT, convertMessagesToYandexFormat } from '../services/yandexGPT';

const initialMessages: Message[] = [
  {
    id: generateId(),
    type: 'assistant',
    content: 'Привет! Я ваш помощник по фронтенд-разработке. Задавайте любые вопросы о React, TypeScript, CSS, JavaScript и других технологиях. Я готов помочь с примерами кода, объяснениями и решением задач!',
    timestamp: new Date(),
  },
];

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Конвертируем сообщения в формат Yandex GPT (только последние 10 для контекста)
      const recentMessages = messages.slice(-10);
      const yandexMessages = convertMessagesToYandexFormat([
        ...recentMessages,
        { type: 'user', content: content.trim() },
      ]);

      // Отправляем запрос к Yandex GPT через прокси-сервер
      const response = await sendToYandexGPT(yandexMessages);

      const assistantMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Произошла ошибка при обращении к Yandex GPT';
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
  }, [messages]);

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

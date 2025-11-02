/**
 * Генерирует уникальный ID для сообщений
 * @returns Уникальный строковый идентификатор
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

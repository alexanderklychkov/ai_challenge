/**
 * Пример использования MCP агента для связывания инструментов в цепочку
 * 
 * Этот файл демонстрирует, как использовать агента для автоматического
 * выполнения цепочки инструментов MCP
 */

import { autoExecuteToolChain, createToolChain, executeToolChain, createArticleTaskChain } from './mcpAgent.js';

/**
 * Пример 1: Автоматическое выполнение цепочки на основе запроса пользователя
 */
async function exampleAutoChain() {
  const userQuery = 'Найди все задачи на сегодня и создай сводку';
  
  const result = await autoExecuteToolChain(userQuery);
  
  if (result.success) {
    console.log('Цепочка выполнена успешно!');
    console.log('Использованные инструменты:', result.executedTools.map(t => t.toolName));
    console.log('Финальный результат:', result.finalResult);
  } else {
    console.error('Ошибка выполнения цепочки:', result.error);
  }
}

/**
 * Пример 2: Создание и выполнение конкретной цепочки инструментов
 * Поиск → Суммаризация → Сохранение
 */
async function exampleSearchSummarizeSave() {
  // Создаем цепочку: поиск задач → получение сводки → создание задачи с результатом
  const chain = createToolChain({
    search: {
      query: 'today',
      limit: 10,
    },
    summarize: {
      filter: 'today',
      limit: 10,
    },
    save: {
      content: 'Сводка задач на сегодня (создано автоматически)',
      description: '${reminder.result}', // Используем результат reminder инструмента
    },
  });
  
  const result = await executeToolChain(chain);
  
  if (result.success) {
    console.log('Цепочка выполнена успешно!');
    result.executedTools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.toolName}: ${tool.success ? '✓' : '✗'}`);
    });
  } else {
    console.error('Ошибка выполнения цепочки:', result.error);
  }
}

/**
 * Пример 3: Ручное создание цепочки с кастомными шагами
 */
async function exampleManualChain() {
  const chain = [
    {
      tool: 'searchTasks',
      args: { query: 'overdue', limit: 5 },
      description: 'Поиск просроченных задач',
      critical: true, // Критический шаг - при ошибке цепочка прервется
    },
    {
      tool: 'reminder',
      args: { filter: 'overdue', limit: 5 },
      description: 'Получение сводки просроченных задач',
      critical: false, // Не критический - можно продолжить даже при ошибке
    },
  ];
  
  const result = await executeToolChain(chain);
  
  return result;
}

/**
 * Пример 4: Работа со статьей - чтение и создание задач
 * Чтение статьи → Анализ → Создание задач → Сводка
 */
async function exampleArticleToTasks() {
  const articleUrl = 'https://react.dev/reference/react/useEffect';
  
  // Создаем цепочку для работы со статьей
  const chain = createArticleTaskChain(articleUrl, { maxTasks: 5 });
  
  // Выполняем цепочку
  const result = await executeToolChain(chain);
  
  if (result.success) {
    console.log('Статья прочитана успешно!');
    console.log('Содержимое статьи:', result.finalResult);
    
    // После чтения статьи AI должен сам создать задачи
    // Это будет происходить автоматически через вызовы createTask
  } else {
    console.error('Ошибка при работе со статьей:', result.error);
  }
  
  return result;
}

// Экспортируем примеры для использования в других модулях
export {
  exampleAutoChain,
  exampleSearchSummarizeSave,
  exampleManualChain,
  exampleArticleToTasks,
};


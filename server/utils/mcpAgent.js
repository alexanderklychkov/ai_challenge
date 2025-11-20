/**
 * Агент для связывания MCP инструментов в цепочку
 * Поддерживает автоматическое планирование последовательности вызовов инструментов
 */

import { callLocalMCPTool, getLocalMCPTools } from './localMCP.js';

/**
 * Результат выполнения одного инструмента в цепочке
 * @typedef {Object} ToolExecutionResult
 * @property {string} toolName - Имя инструмента
 * @property {any} args - Аргументы инструмента
 * @property {any} result - Результат выполнения
 * @property {boolean} success - Успешность выполнения
 * @property {string} [error] - Сообщение об ошибке
 */

/**
 * Результат выполнения цепочки инструментов
 * @typedef {Object} ChainExecutionResult
 * @property {ToolExecutionResult[]} executedTools - Список выполненных инструментов
 * @property {any} finalResult - Финальный результат
 * @property {boolean} success - Успешность выполнения цепочки
 * @property {string} [error] - Сообщение об ошибке
 */

/**
 * Планирует цепочку вызовов инструментов на основе запроса пользователя
 * @param {string} userQuery - Запрос пользователя
 * @param {Array} availableTools - Доступные инструменты
 * @returns {Promise<Array>} План цепочки вызовов
 */
async function planToolChain(userQuery, availableTools) {
  // Простая эвристика для планирования цепочки
  // В будущем можно использовать LLM для более умного планирования
  
  const queryLower = userQuery.toLowerCase();
  const plan = [];
  
  // Проверяем наличие URL в запросе
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = userQuery.match(urlRegex);
  
  // Если есть URL, создаем цепочку для работы со статьей
  if (urls && urls.length > 0 && availableTools.some(t => t.name === 'readArticle')) {
    const articleUrl = urls[0];
    plan.push({
      tool: 'readArticle',
      args: { url: articleUrl },
      description: 'Чтение статьи по URL',
      critical: true,
    });
    // После чтения статьи AI сам решит, какие задачи создать
    // Не добавляем createTask автоматически, пусть AI анализирует содержимое
  }
  
  // Паттерны для определения нужных инструментов
  if (queryLower.includes('найди') || queryLower.includes('поиск') || queryLower.includes('найти')) {
    // Если запрос содержит поиск, добавляем searchTasks
    if (availableTools.some(t => t.name === 'searchTasks')) {
      plan.push({
        tool: 'searchTasks',
        description: 'Поиск задач по запросу пользователя',
      });
    }
  }
  
  if (queryLower.includes('сводка') || queryLower.includes('список') || queryLower.includes('задачи')) {
    // Если запрос содержит сводку, добавляем reminder
    if (availableTools.some(t => t.name === 'reminder')) {
      plan.push({
        tool: 'reminder',
        description: 'Получение сводки задач',
      });
    }
  }
  
  if (queryLower.includes('создать') || queryLower.includes('добавить') || queryLower.includes('новая задача')) {
    // Если запрос содержит создание, добавляем createTask
    if (availableTools.some(t => t.name === 'createTask')) {
      plan.push({
        tool: 'createTask',
        description: 'Создание новой задачи',
      });
    }
  }
  
  // Если план пуст, возвращаем пустой массив
  return plan;
}

/**
 * Выполняет цепочку инструментов последовательно
 * @param {Array} toolChain - План цепочки инструментов
 * @param {any} context - Контекст выполнения (результаты предыдущих инструментов)
 * @returns {Promise<ChainExecutionResult>} Результат выполнения цепочки
 */
export async function executeToolChain(toolChain, context = {}) {
  const executedTools = [];
  let currentContext = { ...context };
  
  for (const step of toolChain) {
    try {
      const { tool, args, description } = step;
      
      // Подготавливаем аргументы, используя контекст предыдущих шагов
      const preparedArgs = prepareArgs(args, currentContext);
      
      console.log(`[MCP Agent] Выполнение инструмента: ${tool}`, preparedArgs);
      
      const result = await callLocalMCPTool(tool, preparedArgs);
      
      const executionResult = {
        toolName: tool,
        args: preparedArgs,
        result,
        success: true,
      };
      
      executedTools.push(executionResult);
      
      // Обновляем контекст для следующих шагов
      currentContext[tool] = result;
      currentContext.lastResult = result;
      
    } catch (error) {
      const executionResult = {
        toolName: step.tool,
        args: step.args || {},
        result: null,
        success: false,
        error: error.message || 'Неизвестная ошибка',
      };
      
      executedTools.push(executionResult);
      
      // Если критическая ошибка, прерываем цепочку
      if (step.critical !== false) {
        return {
          executedTools,
          finalResult: null,
          success: false,
          error: `Ошибка при выполнении инструмента ${step.tool}: ${error.message}`,
        };
      }
    }
  }
  
  return {
    executedTools,
    finalResult: currentContext.lastResult,
    success: true,
  };
}

/**
 * Подготавливает аргументы для инструмента, используя контекст
 * @param {any} args - Исходные аргументы
 * @param {any} context - Контекст выполнения
 * @returns {any} Подготовленные аргументы
 */
function prepareArgs(args, context) {
  if (!args || typeof args !== 'object') {
    return args || {};
  }
  
  const prepared = { ...args };
  
  // Заменяем плейсхолдеры из контекста
  for (const key in prepared) {
    if (typeof prepared[key] === 'string') {
      // Заменяем ${toolName.result} на результат выполнения инструмента
      const placeholderRegex = /\$\{([^}]+)\}/g;
      prepared[key] = prepared[key].replace(placeholderRegex, (match, path) => {
        const parts = path.split('.');
        let value = context;
        for (const part of parts) {
          value = value?.[part];
          if (value === undefined) break;
        }
        return value !== undefined ? value : match;
      });
    }
  }
  
  return prepared;
}

/**
 * Автоматически выполняет цепочку инструментов на основе запроса пользователя
 * @param {string} userQuery - Запрос пользователя
 * @returns {Promise<ChainExecutionResult>} Результат выполнения цепочки
 */
export async function autoExecuteToolChain(userQuery) {
  try {
    // Получаем доступные инструменты
    const availableTools = await getLocalMCPTools();
    
    // Планируем цепочку
    const plan = await planToolChain(userQuery, availableTools);
    
    if (plan.length === 0) {
      return {
        executedTools: [],
        finalResult: null,
        success: false,
        error: 'Не удалось определить подходящие инструменты для запроса',
      };
    }
    
    // Выполняем цепочку
    return await executeToolChain(plan, { userQuery });
  } catch (error) {
    return {
      executedTools: [],
      finalResult: null,
      success: false,
      error: error.message || 'Неизвестная ошибка при выполнении цепочки инструментов',
    };
  }
}

/**
 * Создает цепочку инструментов для конкретного сценария
 * Пример: поиск → суммаризация → сохранение
 * @param {Object} scenario - Описание сценария
 * @returns {Array} План цепочки инструментов
 */
export function createToolChain(scenario) {
  const chain = [];
  
  // Чтение статьи
  if (scenario.article) {
    chain.push({
      tool: 'readArticle',
      args: { url: scenario.article.url || scenario.article },
      description: 'Чтение статьи',
      critical: true,
    });
  }
  
  // Поиск
  if (scenario.search) {
    chain.push({
      tool: 'searchTasks',
      args: scenario.search,
      description: 'Поиск задач',
      critical: true,
    });
  }
  
  // Суммаризация (можно использовать reminder для получения сводки)
  if (scenario.summarize) {
    chain.push({
      tool: 'reminder',
      args: scenario.summarize,
      description: 'Получение сводки',
      critical: false,
    });
  }
  
  // Сохранение (создание задачи с результатами)
  if (scenario.save) {
    chain.push({
      tool: 'createTask',
      args: scenario.save,
      description: 'Сохранение результата',
      critical: false,
    });
  }
  
  return chain;
}

/**
 * Создает цепочку для работы со статьей: чтение → анализ → создание задач → сводка
 * @param {string} articleUrl - URL статьи
 * @param {Object} options - Дополнительные опции
 * @returns {Array} План цепочки инструментов
 */
export function createArticleTaskChain(articleUrl, options = {}) {
  const { maxTasks = 5, projectId } = options;
  
  return [
    {
      tool: 'readArticle',
      args: { url: articleUrl },
      description: 'Чтение статьи',
      critical: true,
    },
    // После чтения AI сам создаст задачи через createTask
    // Здесь мы только планируем структуру
  ];
}


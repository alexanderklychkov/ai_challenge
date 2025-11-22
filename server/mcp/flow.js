/**
 * Механизм для выполнения длинных флоу взаимодействия с несколькими MCP серверами
 * Поддерживает планирование, выполнение и отслеживание сложных цепочек операций
 */

import { getAllTools, callTool, getExecutionHistory } from './orchestrator.js';

/**
 * Состояние выполнения флоу
 * @typedef {Object} FlowState
 * @property {string} id - Уникальный идентификатор флоу
 * @property {string} name - Название флоу
 * @property {Array} steps - Шаги выполнения
 * @property {number} currentStep - Текущий шаг
 * @property {Object} context - Контекст выполнения
 * @property {string} status - Статус (pending, running, completed, failed)
 * @property {Date} startedAt - Время начала
 * @property {Date} [completedAt] - Время завершения
 */

/**
 * Хранилище активных флоу
 */
const activeFlows = new Map();

/**
 * Создает новый флоу для выполнения
 * @param {string} name - Название флоу
 * @param {Array} steps - Шаги выполнения
 * @param {Object} initialContext - Начальный контекст
 * @returns {FlowState} Состояние флоу
 */
export function createFlow(name, steps, initialContext = {}) {
  const flowId = `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const flowState = {
    id: flowId,
    name,
    steps: steps.map((step, index) => ({
      ...step,
      index,
      status: 'pending',
      executedAt: null,
      result: null,
      error: null,
    })),
    currentStep: 0,
    context: { ...initialContext },
    status: 'pending',
    startedAt: new Date(),
    completedAt: null,
  };
  
  activeFlows.set(flowId, flowState);
  
  console.log(`[MCP Flow] Создан флоу: ${name} (${flowId})`);
  
  return flowState;
}

/**
 * Выполняет один шаг флоу
 * @param {string} flowId - ID флоу
 * @returns {Promise<Object>} Результат выполнения шага
 */
export async function executeFlowStep(flowId) {
  const flow = activeFlows.get(flowId);
  if (!flow) {
    throw new Error(`Флоу ${flowId} не найден`);
  }
  
  if (flow.status === 'completed') {
    return { completed: true, flow };
  }
  
  if (flow.status === 'failed') {
    throw new Error(`Флоу ${flowId} завершился с ошибкой`);
  }
  
  const step = flow.steps[flow.currentStep];
  if (!step) {
    flow.status = 'completed';
    flow.completedAt = new Date();
    return { completed: true, flow };
  }
  
  flow.status = 'running';
  step.status = 'running';
  step.executedAt = new Date();
  
  try {
    const { tool, args, condition, transform } = step;
    
    // Проверяем условие выполнения шага
    if (condition && !evaluateCondition(condition, flow.context)) {
      step.status = 'skipped';
      flow.currentStep++;
      return { skipped: true, step, flow };
    }
    
    // Подготавливаем аргументы с учетом контекста
    const preparedArgs = prepareArgsWithContext(args || {}, flow.context);
    
    console.log(`[MCP Flow] Выполнение шага ${flow.currentStep + 1}/${flow.steps.length}: ${tool}`, preparedArgs);
    
    // Выполняем инструмент
    const result = await callTool(tool, preparedArgs, step.serverId);
    
    // Применяем трансформацию результата
    const transformedResult = transform 
      ? applyTransform(transform, result, flow.context)
      : result;
    
    step.status = 'completed';
    step.result = transformedResult;
    
    // Обновляем контекст
    const contextKey = step.contextKey || `step_${flow.currentStep}`;
    flow.context[contextKey] = transformedResult;
    flow.context.lastResult = transformedResult;
    flow.context.lastTool = tool;
    
    // Переходим к следующему шагу
    flow.currentStep++;
    
    // Проверяем, завершен ли флоу
    if (flow.currentStep >= flow.steps.length) {
      flow.status = 'completed';
      flow.completedAt = new Date();
    }
    
    return { step, result: transformedResult, flow };
    
  } catch (error) {
    step.status = 'failed';
    step.error = error.message;
    
    // Если шаг критический, останавливаем флоу
    if (step.critical !== false) {
      flow.status = 'failed';
      flow.completedAt = new Date();
      throw error;
    }
    
    // Иначе продолжаем выполнение
    flow.currentStep++;
    
    return { step, error: error.message, flow };
  }
}

/**
 * Выполняет весь флоу от начала до конца
 * @param {string} flowId - ID флоу
 * @param {Object} options - Опции выполнения
 * @param {number} [options.maxSteps] - Максимальное количество шагов
 * @returns {Promise<Object>} Результат выполнения флоу
 */
export async function executeFlow(flowId, options = {}) {
  const { maxSteps = 100 } = options;
  let stepsExecuted = 0;
  
  while (stepsExecuted < maxSteps) {
    const result = await executeFlowStep(flowId);
    
    if (result.completed) {
      return {
        success: true,
        flow: result.flow,
        stepsExecuted: stepsExecuted + 1,
      };
    }
    
    stepsExecuted++;
  }
  
  const flow = activeFlows.get(flowId);
  return {
    success: false,
    flow,
    stepsExecuted,
    error: 'Достигнуто максимальное количество шагов',
  };
}

/**
 * Получает состояние флоу
 * @param {string} flowId - ID флоу
 * @returns {FlowState} Состояние флоу
 */
export function getFlowState(flowId) {
  return activeFlows.get(flowId);
}

/**
 * Получает все активные флоу
 * @returns {Array} Массив состояний флоу
 */
export function getAllFlows() {
  return Array.from(activeFlows.values());
}

/**
 * Удаляет завершенный флоу
 * @param {string} flowId - ID флоу
 */
export function removeFlow(flowId) {
  activeFlows.delete(flowId);
}

/**
 * Очищает все завершенные флоу
 */
export function cleanupCompletedFlows() {
  for (const [flowId, flow] of activeFlows.entries()) {
    if (flow.status === 'completed' || flow.status === 'failed') {
      activeFlows.delete(flowId);
    }
  }
}

/**
 * Создает флоу для работы со статьей: чтение → анализ → создание задач
 * @param {string} articleUrl - URL статьи
 * @param {Object} options - Опции флоу
 * @returns {FlowState} Состояние флоу
 */
export function createArticleProcessingFlow(articleUrl, options = {}) {
  const { maxTasks = 5, projectId } = options;
  
  return createFlow('Article Processing', [
    {
      tool: 'readArticle',
      args: { url: articleUrl },
      description: 'Чтение статьи по URL',
      critical: true,
      contextKey: 'article',
    },
    {
      tool: 'createTask',
      args: {
        content: 'Проанализировать статью: ${article.title}',
        description: 'Статья: ${article.url}\n\nОсновные темы:\n${article.content}',
        projectId: projectId || undefined,
      },
      description: 'Создание задачи для анализа статьи',
      critical: false,
      condition: (context) => context.article && context.article.title,
      contextKey: 'analysisTask',
    },
  ], {
    articleUrl,
    maxTasks,
    projectId,
  });
}

/**
 * Создает флоу для поиска и обработки задач
 * @param {string} query - Поисковый запрос
 * @param {Object} options - Опции флоу
 * @returns {FlowState} Состояние флоу
 */
export function createTaskSearchFlow(query, options = {}) {
  const { filter, projectId } = options;
  
  return createFlow('Task Search', [
    {
      tool: 'searchTasks',
      args: { query, filter, projectId },
      description: 'Поиск задач по запросу',
      critical: true,
      contextKey: 'searchResults',
    },
    {
      tool: 'getTasks',
      args: {
        projectId: projectId || undefined,
      },
      description: 'Получение дополнительной информации о задачах',
      critical: false,
      condition: (context) => context.searchResults && context.searchResults.length > 0,
      contextKey: 'tasks',
    },
  ], {
    query,
    filter,
    projectId,
  });
}

/**
 * Подготавливает аргументы с учетом контекста
 * @param {Object} args - Исходные аргументы
 * @param {Object} context - Контекст выполнения
 * @returns {Object} Подготовленные аргументы
 */
function prepareArgsWithContext(args, context) {
  if (!args || typeof args !== 'object') {
    return args || {};
  }
  
  const prepared = { ...args };
  
  // Заменяем плейсхолдеры из контекста
  for (const key in prepared) {
    if (typeof prepared[key] === 'string') {
      const placeholderRegex = /\$\{([^}]+)\}/g;
      prepared[key] = prepared[key].replace(placeholderRegex, (match, path) => {
        const parts = path.split('.');
        let value = context;
        for (const part of parts) {
          value = value?.[part];
          if (value === undefined) break;
        }
        return value !== undefined ? String(value) : match;
      });
    } else if (typeof prepared[key] === 'object' && prepared[key] !== null) {
      prepared[key] = prepareArgsWithContext(prepared[key], context);
    }
  }
  
  return prepared;
}

/**
 * Вычисляет условие выполнения шага
 * @param {Function|Object} condition - Условие
 * @param {Object} context - Контекст выполнения
 * @returns {boolean} Результат проверки условия
 */
function evaluateCondition(condition, context) {
  if (typeof condition === 'function') {
    return condition(context);
  }
  
  if (typeof condition === 'object' && condition !== null) {
    // Поддерживаем простые условия вида { key: value }
    for (const key in condition) {
      if (context[key] !== condition[key]) {
        return false;
      }
    }
    return true;
  }
  
  return true;
}

/**
 * Применяет трансформацию к результату
 * @param {Function|Object} transform - Трансформация
 * @param {any} result - Результат выполнения
 * @param {Object} context - Контекст выполнения
 * @returns {any} Трансформированный результат
 */
function applyTransform(transform, result, context) {
  if (typeof transform === 'function') {
    return transform(result, context);
  }
  
  if (typeof transform === 'object' && transform !== null) {
    // Поддерживаем простые трансформации вида { key: 'path.to.value' }
    const transformed = {};
    for (const key in transform) {
      const path = transform[key];
      const parts = path.split('.');
      let value = result;
      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      transformed[key] = value;
    }
    return transformed;
  }
  
  return result;
}


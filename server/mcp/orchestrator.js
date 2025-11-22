/**
 * Оркестратор для управления несколькими MCP серверами
 * Поддерживает регистрацию серверов, выбор инструментов и выполнение длинных флоу
 */

/**
 * Регистрация MCP сервера
 * @typedef {Object} MCPServerRegistration
 * @property {string} id - Уникальный идентификатор сервера
 * @property {string} name - Название сервера
 * @property {string} description - Описание сервера
 * @property {string} category - Категория сервера (todoist, article, etc.)
 * @property {number} priority - Приоритет сервера (чем выше, тем важнее)
 * @property {Function} getTools - Функция для получения инструментов сервера
 * @property {Function} callTool - Функция для вызова инструмента сервера
 * @property {Object} metadata - Дополнительные метаданные
 */

/**
 * Реестр зарегистрированных MCP серверов
 */
const serverRegistry = new Map();

/**
 * Кэш инструментов по серверам
 */
const toolsCache = new Map();

/**
 * История выполнения инструментов для отслеживания флоу
 */
const executionHistory = [];

/**
 * Регистрирует новый MCP сервер
 * @param {MCPServerRegistration} registration - Регистрация сервера
 */
export function registerMCPServer(registration) {
  const { id, name, description, category, priority, getTools, callTool, metadata = {} } = registration;
  
  if (!id || !name || !getTools || !callTool) {
    throw new Error('Необходимы поля: id, name, getTools, callTool');
  }
  
  serverRegistry.set(id, {
    id,
    name,
    description: description || '',
    category: category || 'general',
    priority: priority || 0,
    getTools,
    callTool,
    metadata,
    registeredAt: new Date().toISOString(),
  });
  
  // Очищаем кэш инструментов для этого сервера
  toolsCache.delete(id);
  
  console.log(`[MCP Orchestrator] Зарегистрирован сервер: ${name} (${id})`);
}

/**
 * Отменяет регистрацию MCP сервера
 * @param {string} serverId - ID сервера
 */
export function unregisterMCPServer(serverId) {
  if (serverRegistry.delete(serverId)) {
    toolsCache.delete(serverId);
    console.log(`[MCP Orchestrator] Отменена регистрация сервера: ${serverId}`);
  }
}

/**
 * Получает список всех зарегистрированных серверов
 * @returns {Array} Массив серверов
 */
export function getRegisteredServers() {
  return Array.from(serverRegistry.values());
}

/**
 * Получает инструменты конкретного сервера
 * @param {string} serverId - ID сервера
 * @returns {Promise<Array>} Массив инструментов
 */
export async function getServerTools(serverId) {
  const server = serverRegistry.get(serverId);
  if (!server) {
    throw new Error(`Сервер ${serverId} не найден`);
  }
  
  // Проверяем кэш
  if (toolsCache.has(serverId)) {
    return toolsCache.get(serverId);
  }
  
  // Получаем инструменты через функцию сервера
  const tools = await server.getTools();
  
  // Обогащаем инструменты метаданными сервера
  const enrichedTools = tools.map(tool => ({
    ...tool,
    serverId: server.id,
    serverName: server.name,
    serverCategory: server.category,
    serverPriority: server.priority,
  }));
  
  // Кэшируем
  toolsCache.set(serverId, enrichedTools);
  
  return enrichedTools;
}

/**
 * Получает все инструменты из всех зарегистрированных серверов
 * @param {Object} options - Опции фильтрации
 * @param {string} [options.category] - Фильтр по категории
 * @param {number} [options.minPriority] - Минимальный приоритет
 * @returns {Promise<Array>} Массив всех инструментов
 */
export async function getAllTools(options = {}) {
  const { category, minPriority } = options;
  
  const allTools = [];
  
  for (const server of serverRegistry.values()) {
    // Фильтруем по категории
    if (category && server.category !== category) {
      continue;
    }
    
    // Фильтруем по приоритету
    if (minPriority !== undefined && server.priority < minPriority) {
      continue;
    }
    
    try {
      const tools = await getServerTools(server.id);
      allTools.push(...tools);
    } catch (error) {
      console.error(`[MCP Orchestrator] Ошибка при получении инструментов сервера ${server.id}:`, error);
    }
  }
  
  // Сортируем по приоритету сервера
  allTools.sort((a, b) => (b.serverPriority || 0) - (a.serverPriority || 0));
  
  return allTools;
}

/**
 * Вызывает инструмент через оркестратор
 * @param {string} toolName - Имя инструмента
 * @param {Object} args - Аргументы инструмента
 * @param {string} [serverId] - ID сервера (опционально, если не указан, будет найден автоматически)
 * @param {boolean} [returnMetadata] - Если true, возвращает объект с результатом и метаданными
 * @returns {Promise<any>} Результат выполнения инструмента или объект { result, serverId, serverName, serverCategory }
 */
export async function callTool(toolName, args, serverId = null, returnMetadata = false) {
  let targetServerId = serverId;
  
  // Если сервер не указан, ищем инструмент во всех серверах
  if (!targetServerId) {
    const allTools = await getAllTools();
    const tool = allTools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Инструмент ${toolName} не найден ни в одном сервере`);
    }
    targetServerId = tool.serverId;
  }
  
  const server = serverRegistry.get(targetServerId);
  if (!server) {
    throw new Error(`Сервер ${targetServerId} не найден`);
  }
  
  // Записываем в историю
  const executionRecord = {
    toolName,
    serverId: targetServerId,
    args,
    timestamp: new Date().toISOString(),
    status: 'pending',
  };
  
  executionHistory.push(executionRecord);
  
  try {
    const result = await server.callTool(toolName, args);
    
    executionRecord.status = 'success';
    executionRecord.result = result;
    
    // Если запрошены метаданные, возвращаем объект с информацией о сервере
    if (returnMetadata) {
      return {
        result,
        serverId: targetServerId,
        serverName: server.name,
        serverCategory: server.category,
      };
    }
    
    return result;
  } catch (error) {
    executionRecord.status = 'error';
    executionRecord.error = error.message;
    
    // Если запрошены метаданные, возвращаем объект с ошибкой
    if (returnMetadata) {
      return {
        result: null,
        error: error.message,
        serverId: targetServerId,
        serverName: server.name,
        serverCategory: server.category,
      };
    }
    
    throw error;
  }
}

/**
 * Получает историю выполнения инструментов
 * @param {Object} options - Опции фильтрации
 * @param {string} [options.serverId] - Фильтр по серверу
 * @param {string} [options.toolName] - Фильтр по инструменту
 * @param {number} [options.limit] - Лимит записей
 * @returns {Array} История выполнения
 */
export function getExecutionHistory(options = {}) {
  const { serverId, toolName, limit } = options;
  
  let history = [...executionHistory];
  
  if (serverId) {
    history = history.filter(h => h.serverId === serverId);
  }
  
  if (toolName) {
    history = history.filter(h => h.toolName === toolName);
  }
  
  if (limit) {
    history = history.slice(-limit);
  }
  
  return history;
}

/**
 * Очищает историю выполнения
 */
export function clearExecutionHistory() {
  executionHistory.length = 0;
}

/**
 * Преобразует инструменты в формат OpenAI function calling
 * @param {Array} tools - Массив инструментов
 * @returns {Array} Массив OpenAI functions
 */
export function convertToolsToOpenAI(tools) {
  return tools.map(tool => {
    const { name, description, inputSchema, serverName, serverCategory } = tool;
    
    // Обогащаем описание информацией о сервере
    const enrichedDescription = serverName 
      ? `${description} [Сервер: ${serverName}${serverCategory ? `, Категория: ${serverCategory}` : ''}]`
      : description;
    
    return {
      type: 'function',
      function: {
        name,
        description: enrichedDescription,
        parameters: inputSchema || { type: 'object', properties: {} },
      },
    };
  });
}

/**
 * Получает инструменты в формате OpenAI для всех серверов
 * @param {Object} options - Опции фильтрации
 * @returns {Promise<Array>} Массив OpenAI functions
 */
export async function getAllToolsAsOpenAI(options = {}) {
  const tools = await getAllTools(options);
  return convertToolsToOpenAI(tools);
}

/**
 * Планирует цепочку инструментов для выполнения задачи
 * @param {string} userQuery - Запрос пользователя
 * @param {Object} context - Контекст выполнения
 * @returns {Promise<Array>} План цепочки инструментов
 */
export async function planToolChain(userQuery, context = {}) {
  const allTools = await getAllTools();
  const queryLower = userQuery.toLowerCase();
  const plan = [];
  
  // Анализируем запрос и определяем нужные инструменты
  const toolCategories = {
    article: allTools.filter(t => t.name === 'readArticle' || t.name === 'createTasksFromArticle'),
    task: allTools.filter(t => t.name.includes('Task') || t.name.includes('task')),
    project: allTools.filter(t => t.name.includes('Project') || t.name.includes('project')),
    search: allTools.filter(t => t.name.includes('search') || t.name.includes('Search')),
  };
  
  // Если есть URL, добавляем чтение статьи
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = userQuery.match(urlRegex);
  if (urls && urls.length > 0 && toolCategories.article.length > 0) {
    plan.push({
      tool: 'readArticle',
      args: { url: urls[0] },
      description: 'Чтение статьи по URL',
      critical: true,
      serverId: toolCategories.article[0].serverId,
    });
  }
  
  // Поиск задач
  if (queryLower.includes('найди') || queryLower.includes('поиск') || queryLower.includes('найти')) {
    const searchTool = toolCategories.search.find(t => t.name === 'searchTasks');
    if (searchTool) {
      plan.push({
        tool: searchTool.name,
        description: 'Поиск задач по запросу пользователя',
        serverId: searchTool.serverId,
      });
    }
  }
  
  // Создание задач
  if (queryLower.includes('создать') || queryLower.includes('добавить') || queryLower.includes('новая задача')) {
    const createTool = toolCategories.task.find(t => t.name === 'createTask');
    if (createTool) {
      plan.push({
        tool: createTool.name,
        description: 'Создание новой задачи',
        serverId: createTool.serverId,
      });
    }
  }
  
  return plan;
}

/**
 * Выполняет цепочку инструментов последовательно
 * @param {Array} toolChain - План цепочки инструментов
 * @param {Object} context - Контекст выполнения
 * @returns {Promise<Object>} Результат выполнения цепочки
 */
export async function executeToolChain(toolChain, context = {}) {
  const executedTools = [];
  let currentContext = { ...context };
  
  for (const step of toolChain) {
    try {
      const { tool, args, description, serverId } = step;
      
      // Подготавливаем аргументы, используя контекст предыдущих шагов
      const preparedArgs = prepareArgs(args, currentContext);
      
      console.log(`[MCP Orchestrator] Выполнение инструмента: ${tool} (сервер: ${serverId || 'auto'})`, preparedArgs);
      
      const result = await callTool(tool, preparedArgs, serverId);
      
      const executionResult = {
        toolName: tool,
        serverId: serverId || 'auto',
        args: preparedArgs,
        result,
        success: true,
        timestamp: new Date().toISOString(),
      };
      
      executedTools.push(executionResult);
      
      // Обновляем контекст для следующих шагов
      currentContext[tool] = result;
      currentContext.lastResult = result;
      currentContext.lastTool = tool;
      
    } catch (error) {
      const executionResult = {
        toolName: step.tool,
        serverId: step.serverId || 'auto',
        args: step.args || {},
        result: null,
        success: false,
        error: error.message || 'Неизвестная ошибка',
        timestamp: new Date().toISOString(),
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
 * @param {Object} context - Контекст выполнения
 * @returns {Promise<Object>} Результат выполнения цепочки
 */
export async function autoExecuteToolChain(userQuery, context = {}) {
  try {
    // Планируем цепочку
    const plan = await planToolChain(userQuery, context);
    
    if (plan.length === 0) {
      return {
        executedTools: [],
        finalResult: null,
        success: false,
        error: 'Не удалось определить подходящие инструменты для запроса',
      };
    }
    
    // Выполняем цепочку
    return await executeToolChain(plan, { ...context, userQuery });
  } catch (error) {
    return {
      executedTools: [],
      finalResult: null,
      success: false,
      error: error.message || 'Неизвестная ошибка при выполнении цепочки инструментов',
    };
  }
}


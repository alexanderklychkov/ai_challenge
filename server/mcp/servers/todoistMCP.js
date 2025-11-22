/**
 * MCP сервер для работы с Todoist API
 * Предоставляет инструменты для работы с задачами, проектами, метками и секциями
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TodoistApi } from '@doist/todoist-api-typescript';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { registerTaskTools } from '../tools/tasks.js';
import { registerProjectTools } from '../tools/projects.js';
import { registerLabelTools } from '../tools/labels.js';
import { registerSectionTools } from '../tools/sections.js';
import { registerMCPServer } from '../orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env
dotenv.config({ path: resolve(__dirname, '..', '..', '..', '.env') });

// Хранилище для инструментов и их обработчиков
const toolsRegistry = new Map();

let mcpServerInstance = null;
let todoistApiInstance = null;
let serverRegistered = false;

/**
 * Инициализирует Todoist MCP сервер и возвращает его экземпляр
 */
function getTodoistMCPServer() {
  if (mcpServerInstance) {
    return mcpServerInstance;
  }

  const apiKey = process.env.TODOIST_API_KEY;
  
  if (!apiKey) {
    throw new Error('TODOIST_API_KEY не установлен в переменных окружения');
  }

  todoistApiInstance = new TodoistApi(apiKey);
  
  // Создаем MCP сервер без подключения к транспорту
  mcpServerInstance = new McpServer(
    {
      name: 'todoist-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Сохраняем оригинальный метод registerTool
  const originalRegisterTool = mcpServerInstance.registerTool.bind(mcpServerInstance);
  
  // Перехватываем регистрацию инструментов для сохранения в реестре
  mcpServerInstance.registerTool = function(name, options, handler) {
    // Сохраняем инструмент в реестре
    toolsRegistry.set(name, {
      name,
      description: options.description || '',
      inputSchema: options.inputSchema,
      handler,
    });
    
    // Вызываем оригинальный метод
    return originalRegisterTool(name, options, handler);
  };

  // Регистрируем только Todoist инструменты
  registerTaskTools(mcpServerInstance, todoistApiInstance);
  registerProjectTools(mcpServerInstance, todoistApiInstance);
  registerLabelTools(mcpServerInstance, todoistApiInstance);
  registerSectionTools(mcpServerInstance, todoistApiInstance);

  // Регистрируем сервер в оркестраторе только один раз
  if (!serverRegistered) {
    registerMCPServer({
      id: 'todoist-mcp-server',
      name: 'Todoist MCP Server',
      description: 'MCP сервер для работы с Todoist API (задачи, проекты, метки, секции)',
      category: 'todoist',
      priority: 10,
      getTools: async () => {
        return await getTodoistMCPTools();
      },
      callTool: async (toolName, args) => {
        return await callTodoistMCPTool(toolName, args);
      },
      metadata: {
        version: '1.0.0',
        supports: ['tasks', 'projects', 'labels', 'sections'],
      },
    });
    serverRegistered = true;
  }

  return mcpServerInstance;
}

/**
 * Получает список доступных инструментов из Todoist MCP сервера
 * @returns {Promise<Array>} Массив инструментов
 */
export async function getTodoistMCPTools() {
  // Инициализируем сервер, чтобы заполнить реестр
  getTodoistMCPServer();
  
  // Используем реестр инструментов
  if (toolsRegistry.size > 0) {
    return Array.from(toolsRegistry.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }
  
  // Если реестр пуст, пытаемся получить инструменты через метод listTools
  const server = getTodoistMCPServer();
  if (typeof server.listTools === 'function') {
    try {
      const toolsList = await server.listTools();
      return toolsList.tools || [];
    } catch (error) {
      console.warn('[TodoistMCP] Не удалось получить инструменты через listTools:', error.message);
    }
  }
  
  throw new Error('Не удалось получить список инструментов из Todoist MCP сервера');
}

/**
 * Инициализирует Todoist MCP сервер и регистрирует его в оркестраторе
 * Вызывается автоматически при первом использовании
 */
export function initializeTodoistMCP() {
  getTodoistMCPServer();
}

/**
 * Вызывает инструмент Todoist MCP сервера
 * @param {string} toolName - Имя инструмента
 * @param {Object} args - Аргументы для инструмента
 * @returns {Promise<any>} Результат выполнения инструмента
 */
export async function callTodoistMCPTool(toolName, args) {
  // Инициализируем сервер, чтобы заполнить реестр
  getTodoistMCPServer();
  
  try {
    // Используем реестр инструментов (предпочтительный способ)
    const toolHandler = toolsRegistry.get(toolName);
    if (toolHandler && typeof toolHandler.handler === 'function') {
      const result = await toolHandler.handler(args);
      
      // Извлекаем текст из результата
      if (result && result.content && Array.isArray(result.content)) {
        const textContent = result.content.find(c => c.type === 'text');
        if (textContent) {
          // Пытаемся распарсить JSON, если это возможно
          try {
            return JSON.parse(textContent.text);
          } catch {
            return textContent.text;
          }
        }
      }
      
      return result;
    }
    
    // Если инструмент не найден в реестре, пытаемся вызвать через метод callTool
    const server = getTodoistMCPServer();
    if (typeof server.callTool === 'function') {
      try {
        const result = await server.callTool({
          name: toolName,
          arguments: args,
        });
        
        // Извлекаем текст из результата
        if (result && result.content && Array.isArray(result.content)) {
          const textContent = result.content.find(c => c.type === 'text');
          if (textContent) {
            try {
              return JSON.parse(textContent.text);
            } catch {
              return textContent.text;
            }
          }
        }
        
        return result;
      } catch (error) {
        console.warn(`[TodoistMCP] Не удалось вызвать инструмент через callTool:`, error.message);
      }
    }
    
    throw new Error(`Инструмент ${toolName} не найден в Todoist MCP сервере`);
  } catch (error) {
    console.error(`[TodoistMCP] Ошибка при вызове инструмента ${toolName}:`, error);
    throw error;
  }
}

/**
 * Преобразует Todoist MCP tools в формат OpenAI function calling
 * @param {Object} mcpTool - MCP tool объект
 * @returns {Object} OpenAI function формат
 */
function convertTodoistMCPToolToOpenAI(mcpTool) {
  const { name, description, inputSchema } = mcpTool;
  
  // inputSchema уже является JSON схемой, используем её напрямую как parameters
  const parameters = inputSchema || { type: 'object', properties: {} };
  
  return {
    type: 'function',
    function: {
      name,
      description: description || '',
      parameters,
    },
  };
}

/**
 * Преобразует массив Todoist MCP tools в формат OpenAI function calling
 * @returns {Promise<Array>} Массив OpenAI functions
 */
export async function convertTodoistMCPToolsToOpenAI() {
  const tools = await getTodoistMCPTools();
  return tools.map(tool => convertTodoistMCPToolToOpenAI(tool));
}


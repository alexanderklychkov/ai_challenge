/**
 * MCP сервер для работы с CRM (тикеты и пользователи)
 * Предоставляет инструменты для получения информации о пользователях, тикетах и их истории
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { registerCRMTools } from '../tools/crm.js';
import { registerMCPServer } from '../orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env
dotenv.config({ path: resolve(__dirname, '..', '..', '..', '.env') });

// Хранилище для инструментов и их обработчиков
const toolsRegistry = new Map();

let mcpServerInstance = null;
let serverRegistered = false;

/**
 * Инициализирует CRM MCP сервер и возвращает его экземпляр
 */
function getCRMMCPServer() {
  if (mcpServerInstance) {
    return mcpServerInstance;
  }

  // Создаем MCP сервер без подключения к транспорту
  mcpServerInstance = new McpServer(
    {
      name: 'crm-mcp-server',
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

  // Регистрируем только CRM инструменты
  registerCRMTools(mcpServerInstance);

  // Регистрируем сервер в оркестраторе только один раз
  if (!serverRegistered) {
    registerMCPServer({
      id: 'crm-mcp-server',
      name: 'CRM MCP Server',
      description: 'MCP сервер для работы с CRM (тикеты поддержки и пользователи). Предоставляет информацию о пользователях, их тикетах и истории обращений.',
      category: 'crm',
      priority: 9,
      getTools: async () => {
        return await getCRMMCPTools();
      },
      callTool: async (toolName, args) => {
        return await callCRMMCPTool(toolName, args);
      },
      metadata: {
        version: '1.0.0',
        supports: ['createUser', 'getUser', 'getUserTickets', 'getTicket', 'searchTickets', 'createTicket', 'addTicketMessage', 'updateTicketStatus', 'deleteTicket'],
      },
    });
    serverRegistered = true;
  }

  return mcpServerInstance;
}

/**
 * Получает список доступных инструментов из CRM MCP сервера
 * @returns {Promise<Array>} Массив инструментов
 */
export async function getCRMMCPTools() {
  // Инициализируем сервер, чтобы заполнить реестр
  getCRMMCPServer();
  
  // Используем реестр инструментов
  if (toolsRegistry.size > 0) {
    return Array.from(toolsRegistry.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }
  
  // Если реестр пуст, пытаемся получить инструменты через метод listTools
  const server = getCRMMCPServer();
  if (typeof server.listTools === 'function') {
    try {
      const toolsList = await server.listTools();
      return toolsList.tools || [];
    } catch (error) {
      console.warn('[CRMMCP] Не удалось получить инструменты через listTools:', error.message);
    }
  }
  
  throw new Error('Не удалось получить список инструментов из CRM MCP сервера');
}

/**
 * Инициализирует CRM MCP сервер и регистрирует его в оркестраторе
 * Вызывается автоматически при первом использовании
 */
export function initializeCRMMCP() {
  getCRMMCPServer();
}

/**
 * Вызывает инструмент CRM MCP сервера
 * @param {string} toolName - Имя инструмента
 * @param {Object} args - Аргументы для инструмента
 * @returns {Promise<any>} Результат выполнения инструмента
 */
export async function callCRMMCPTool(toolName, args) {
  // Инициализируем сервер, чтобы заполнить реестр
  getCRMMCPServer();
  
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
    const server = getCRMMCPServer();
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
        console.warn(`[CRMMCP] Не удалось вызвать инструмент через callTool:`, error.message);
      }
    }
    
    throw new Error(`Инструмент ${toolName} не найден в CRM MCP сервере`);
  } catch (error) {
    console.error(`[CRMMCP] Ошибка при вызове инструмента ${toolName}:`, error);
    throw error;
  }
}

/**
 * Преобразует CRM MCP tools в формат OpenAI function calling
 * @param {Object} mcpTool - MCP tool объект
 * @returns {Object} OpenAI function формат
 */
function convertCRMMCPToolToOpenAI(mcpTool) {
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
 * Преобразует массив CRM MCP tools в формат OpenAI function calling
 * @returns {Promise<Array>} Массив OpenAI functions
 */
export async function convertCRMMCPToolsToOpenAI() {
  const tools = await getCRMMCPTools();
  return tools.map(tool => convertCRMMCPToolToOpenAI(tool));
}


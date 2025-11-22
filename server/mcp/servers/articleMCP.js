/**
 * MCP сервер для работы со статьями
 * Предоставляет инструменты для чтения и обработки статей из веб-страниц
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { registerArticleTools } from '../tools/article.js';
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
 * Инициализирует Article MCP сервер и возвращает его экземпляр
 */
function getArticleMCPServer() {
  if (mcpServerInstance) {
    return mcpServerInstance;
  }

  // Создаем MCP сервер без подключения к транспорту
  mcpServerInstance = new McpServer(
    {
      name: 'article-mcp-server',
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

  // Регистрируем только Article инструменты
  registerArticleTools(mcpServerInstance);

  // Регистрируем сервер в оркестраторе только один раз
  if (!serverRegistered) {
    registerMCPServer({
      id: 'article-mcp-server',
      name: 'Article MCP Server',
      description: 'MCP сервер для чтения и обработки статей из веб-страниц',
      category: 'article',
      priority: 9,
      getTools: async () => {
        return await getArticleMCPTools();
      },
      callTool: async (toolName, args) => {
        return await callArticleMCPTool(toolName, args);
      },
      metadata: {
        version: '1.0.0',
        supports: ['readArticle', 'createTasksFromArticle'],
      },
    });
    serverRegistered = true;
  }

  return mcpServerInstance;
}

/**
 * Получает список доступных инструментов из Article MCP сервера
 * @returns {Promise<Array>} Массив инструментов
 */
export async function getArticleMCPTools() {
  // Инициализируем сервер, чтобы заполнить реестр
  getArticleMCPServer();
  
  // Используем реестр инструментов
  if (toolsRegistry.size > 0) {
    return Array.from(toolsRegistry.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }
  
  // Если реестр пуст, пытаемся получить инструменты через метод listTools
  const server = getArticleMCPServer();
  if (typeof server.listTools === 'function') {
    try {
      const toolsList = await server.listTools();
      return toolsList.tools || [];
    } catch (error) {
      console.warn('[ArticleMCP] Не удалось получить инструменты через listTools:', error.message);
    }
  }
  
  throw new Error('Не удалось получить список инструментов из Article MCP сервера');
}

/**
 * Инициализирует Article MCP сервер и регистрирует его в оркестраторе
 * Вызывается автоматически при первом использовании
 */
export function initializeArticleMCP() {
  getArticleMCPServer();
}

/**
 * Вызывает инструмент Article MCP сервера
 * @param {string} toolName - Имя инструмента
 * @param {Object} args - Аргументы для инструмента
 * @returns {Promise<any>} Результат выполнения инструмента
 */
export async function callArticleMCPTool(toolName, args) {
  // Инициализируем сервер, чтобы заполнить реестр
  getArticleMCPServer();
  
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
    const server = getArticleMCPServer();
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
        console.warn(`[ArticleMCP] Не удалось вызвать инструмент через callTool:`, error.message);
      }
    }
    
    throw new Error(`Инструмент ${toolName} не найден в Article MCP сервере`);
  } catch (error) {
    console.error(`[ArticleMCP] Ошибка при вызове инструмента ${toolName}:`, error);
    throw error;
  }
}

/**
 * Преобразует Article MCP tools в формат OpenAI function calling
 * @param {Object} mcpTool - MCP tool объект
 * @returns {Object} OpenAI function формат
 */
function convertArticleMCPToolToOpenAI(mcpTool) {
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
 * Преобразует массив Article MCP tools в формат OpenAI function calling
 * @returns {Promise<Array>} Массив OpenAI functions
 */
export async function convertArticleMCPToolsToOpenAI() {
  const tools = await getArticleMCPTools();
  return tools.map(tool => convertArticleMCPToolToOpenAI(tool));
}


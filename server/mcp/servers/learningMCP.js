/**
 * MCP сервер для обучения и изучения материалов
 * Предоставляет инструменты для создания тестов, карточек Anki, планов изучения, флеш-карточек и конспектов
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { registerLearningTools } from '../tools/learning.js';
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
 * Инициализирует Learning MCP сервер и возвращает его экземпляр
 */
function getLearningMCPServer() {
  if (mcpServerInstance) {
    return mcpServerInstance;
  }

  // Создаем MCP сервер без подключения к транспорту
  mcpServerInstance = new McpServer(
    {
      name: 'learning-mcp-server',
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

  // Регистрируем только Learning инструменты
  registerLearningTools(mcpServerInstance);

  // Регистрируем сервер в оркестраторе только один раз
  if (!serverRegistered) {
    registerMCPServer({
      id: 'learning-mcp-server',
      name: 'Learning MCP Server',
      description: 'MCP сервер для обучения и изучения материалов (тесты, карточки Anki, планы изучения, флеш-карточки, конспекты)',
      category: 'learning',
      priority: 8,
      getTools: async () => {
        return await getLearningMCPTools();
      },
      callTool: async (toolName, args) => {
        return await callLearningMCPTool(toolName, args);
      },
      metadata: {
        version: '1.0.0',
        supports: ['createTest', 'createAnkiCards', 'createStudyPlan', 'createFlashcards', 'createSummary'],
      },
    });
    serverRegistered = true;
  }

  return mcpServerInstance;
}

/**
 * Получает список доступных инструментов из Learning MCP сервера
 * @returns {Promise<Array>} Массив инструментов
 */
export async function getLearningMCPTools() {
  // Инициализируем сервер, чтобы заполнить реестр
  getLearningMCPServer();
  
  // Используем реестр инструментов
  if (toolsRegistry.size > 0) {
    return Array.from(toolsRegistry.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }
  
  // Если реестр пуст, пытаемся получить инструменты через метод listTools
  const server = getLearningMCPServer();
  if (typeof server.listTools === 'function') {
    try {
      const toolsList = await server.listTools();
      return toolsList.tools || [];
    } catch (error) {
      console.warn('[LearningMCP] Не удалось получить инструменты через listTools:', error.message);
    }
  }
  
  throw new Error('Не удалось получить список инструментов из Learning MCP сервера');
}

/**
 * Инициализирует Learning MCP сервер и регистрирует его в оркестраторе
 * Вызывается автоматически при первом использовании
 */
export function initializeLearningMCP() {
  getLearningMCPServer();
}

/**
 * Вызывает инструмент Learning MCP сервера
 * @param {string} toolName - Имя инструмента
 * @param {Object} args - Аргументы для инструмента
 * @returns {Promise<any>} Результат выполнения инструмента
 */
export async function callLearningMCPTool(toolName, args) {
  // Инициализируем сервер, чтобы заполнить реестр
  getLearningMCPServer();
  
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
    const server = getLearningMCPServer();
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
        console.warn(`[LearningMCP] Не удалось вызвать инструмент через callTool:`, error.message);
      }
    }
    
    throw new Error(`Инструмент ${toolName} не найден в Learning MCP сервере`);
  } catch (error) {
    console.error(`[LearningMCP] Ошибка при вызове инструмента ${toolName}:`, error);
    throw error;
  }
}

/**
 * Преобразует Learning MCP tools в формат OpenAI function calling
 * @param {Object} mcpTool - MCP tool объект
 * @returns {Object} OpenAI function формат
 */
function convertLearningMCPToolToOpenAI(mcpTool) {
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
 * Преобразует массив Learning MCP tools в формат OpenAI function calling
 * @returns {Promise<Array>} Массив OpenAI functions
 */
export async function convertLearningMCPToolsToOpenAI() {
  const tools = await getLearningMCPTools();
  return tools.map(tool => convertLearningMCPToolToOpenAI(tool));
}


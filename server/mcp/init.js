/**
 * Инициализация и регистрация всех MCP серверов
 * Этот файл содержит конфигурацию всех доступных MCP серверов
 */

import { registerMCPServer } from './orchestrator.js';
import { initializeTodoistMCP, getTodoistMCPTools, callTodoistMCPTool } from './servers/todoistMCP.js';
import { initializeArticleMCP, getArticleMCPTools, callArticleMCPTool } from './servers/articleMCP.js';
import { initializeLearningMCP, getLearningMCPTools, callLearningMCPTool } from './servers/learningMCP.js';
import { initializeGitHubMCP, getGitHubMCPTools, callGitHubMCPTool } from './servers/githubMCP.js';
import { initializeCRMMCP, getCRMMCPTools, callCRMMCPTool } from './servers/crmMCP.js';
import { initializeChangelogMCP, getChangelogMCPTools, callChangelogMCPTool } from './servers/changelogMCP.js';

/**
 * Инициализирует и регистрирует все доступные MCP серверы
 */
export function initializeAllMCPServers() {
  // Регистрируем Todoist MCP сервер
  initializeTodoistMCP(); // Это автоматически зарегистрирует сервер в оркестраторе
  
  // Регистрируем Article MCP сервер
  initializeArticleMCP(); // Это автоматически зарегистрирует сервер в оркестраторе
  
  // Регистрируем Learning MCP сервер
  initializeLearningMCP(); // Это автоматически зарегистрирует сервер в оркестраторе
  
  // Регистрируем GitHub MCP сервер
  initializeGitHubMCP(); // Это автоматически зарегистрирует сервер в оркестраторе
  
  // Регистрируем CRM MCP сервер
  initializeCRMMCP(); // Это автоматически зарегистрирует сервер в оркестраторе
  
  // Регистрируем Changelog MCP сервер
  initializeChangelogMCP(); // Это автоматически зарегистрирует сервер в оркестраторе
  
  // Здесь можно добавить регистрацию других серверов
  // Например, внешние MCP серверы через HTTP или другие протоколы
  // registerExternalHTTPServer();
  
  console.log('[MCP Servers] Все серверы инициализированы');
}

/**
 * Пример регистрации внешнего MCP сервера через HTTP
 * Раскомментируйте и настройте при необходимости
 */
/*
export function registerExternalHTTPServer() {
  registerMCPServer({
    id: 'external-http-server',
    name: 'External HTTP MCP Server',
    description: 'Внешний MCP сервер доступный через HTTP',
    category: 'external',
    priority: 5,
    getTools: async () => {
      // Запрос к внешнему серверу для получения списка инструментов
      const response = await fetch('http://external-server.com/mcp/tools');
      const data = await response.json();
      return data.tools || [];
    },
    callTool: async (toolName, args) => {
      // Вызов инструмента на внешнем сервере
      const response = await fetch('http://external-server.com/mcp/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: toolName, arguments: args }),
      });
      const data = await response.json();
      return data.result;
    },
    metadata: {
      endpoint: 'http://external-server.com/mcp',
      protocol: 'http',
    },
  });
}
*/


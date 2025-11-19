import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TodoistApi } from '@doist/todoist-api-typescript';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { registerTaskTools } from './tools/tasks.js';
import { registerProjectTools } from './tools/projects.js';
import { registerLabelTools } from './tools/labels.js';
import { registerSectionTools } from './tools/sections.js';
import { registerReminderTool } from './tools/reminder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

/**
 * Инициализирует и запускает MCP сервер
 */
async function startMCPServer() {
  const apiKey = process.env.TODOIST_API_KEY;
  
  if (!apiKey) {
    console.error('Ошибка: TODOIST_API_KEY не установлен в переменных окружения');
    process.exit(1);
  }

  const api = new TodoistApi(apiKey);
  
  // Создаем MCP сервер с правильным API
  const server = new McpServer(
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

  // Регистрируем все инструменты
  registerTaskTools(server, api);
  registerProjectTools(server, api);
  registerLabelTools(server, api);
  registerSectionTools(server, api);
  registerReminderTool(server, api);

  // Создаем транспорт для stdio
  const transport = new StdioServerTransport();
  
  // Подключаем сервер к транспорту
  await server.connect(transport);

  console.error('Todoist MCP Server запущен');
}

// Запускаем сервер
startMCPServer().catch((error) => {
  console.error('Ошибка при запуске MCP сервера:', error);
  process.exit(1);
});


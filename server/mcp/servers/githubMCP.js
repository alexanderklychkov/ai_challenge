/**
 * MCP сервер для работы с GitHub репозиторием
 * Предоставляет инструменты для получения информации о GitHub репозитории
 */

import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { registerMCPServer } from '../orchestrator.js';

const execAsync = promisify(exec);

// Хранилище для инструментов и их обработчиков
const toolsRegistry = new Map();

let serverRegistered = false;
let octokit = null;

/**
 * Инициализирует Octokit клиент для GitHub API
 */
function initializeOctokit() {
  if (octokit) {
    return octokit;
  }

  const githubToken = process.env.GITHUB_TOKEN;
  
  if (githubToken) {
    octokit = new Octokit({
      auth: githubToken,
    });
  } else {
    // Если токен не указан, создаем клиент без аутентификации (ограниченный функционал)
    octokit = new Octokit();
    console.warn('[GitHubMCP] GITHUB_TOKEN не установлен. Некоторые функции могут быть недоступны.');
  }

  return octokit;
}

/**
 * Получает текущую ветку git репозитория
 */
async function getCurrentBranch() {
  try {
    const { stdout } = await execAsync('git branch --show-current');
    return stdout.trim();
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Git не установлен в системе');
    }
    throw new Error(`Ошибка при получении текущей ветки: ${error.message}`);
  }
}

/**
 * Получает информацию о текущем репозитории (owner/repo)
 */
async function getRepositoryInfo() {
  try {
    // Пытаемся получить remote URL
    const { stdout } = await execAsync('git config --get remote.origin.url');
    const url = stdout.trim();
    
    // Парсим URL (поддерживаем разные форматы)
    let owner, repo;
    
    if (url.includes('github.com')) {
      // Формат: https://github.com/owner/repo.git или git@github.com:owner/repo.git
      const match = url.match(/github\.com[/:](\w+)\/([\w.-]+)(?:\.git)?/);
      if (match) {
        owner = match[1];
        repo = match[2].replace('.git', '');
      }
    }
    
    if (!owner || !repo) {
      throw new Error('Не удалось определить owner/repo из git remote');
    }
    
    return { owner, repo };
  } catch (error) {
    throw new Error(`Ошибка при получении информации о репозитории: ${error.message}`);
  }
}

/**
 * Получает информацию о текущей ветке из GitHub
 */
async function getBranchInfo(args = {}) {
  try {
    const { owner, repo } = await getRepositoryInfo();
    const branch = args.branch || await getCurrentBranch();
    
    const octokitClient = initializeOctokit();
    const { data } = await octokitClient.repos.getBranch({
      owner,
      repo,
      branch,
    });
    
    return {
      name: data.name,
      sha: data.commit.sha,
      protected: data.protected,
      commit: {
        sha: data.commit.sha,
        message: data.commit.commit.message,
        author: data.commit.commit.author?.name,
        date: data.commit.commit.author?.date,
      },
    };
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`Ветка не найдена в GitHub репозитории`);
    }
    if (error.status === 401 || error.status === 403) {
      throw new Error('Недостаточно прав доступа. Убедитесь, что GITHUB_TOKEN установлен и имеет необходимые права.');
    }
    throw new Error(`Ошибка при получении информации о ветке: ${error.message}`);
  }
}

/**
 * Получает список открытых файлов в репозитории
 */
async function getOpenFiles(args = {}) {
  try {
    // Это локальная функция - получаем список измененных файлов
    const { stdout } = await execAsync('git status --porcelain');
    const files = stdout
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        return {
          file,
          status: status.trim(),
          staged: status[0] !== ' ',
          modified: status[1] !== ' ',
        };
      });
    
    return files;
  } catch (error) {
    throw new Error(`Ошибка при получении открытых файлов: ${error.message}`);
  }
}

/**
 * Получает список доступных инструментов из GitHub MCP сервера
 * @returns {Promise<Array>} Массив инструментов
 */
export async function getGitHubMCPTools() {
  return [
    {
      name: 'getCurrentBranch',
      description: 'Получает название текущей ветки git репозитория',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'getBranchInfo',
      description: 'Получает подробную информацию о ветке из GitHub (требует GITHUB_TOKEN)',
      inputSchema: {
        type: 'object',
        properties: {
          branch: {
            type: 'string',
            description: 'Название ветки (если не указано, используется текущая)',
          },
        },
        required: [],
      },
    },
    {
      name: 'getOpenFiles',
      description: 'Получает список измененных/открытых файлов в рабочей директории',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'getRepositoryInfo',
      description: 'Получает информацию о текущем GitHub репозитории (owner/repo)',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ];
}

/**
 * Инициализирует GitHub MCP сервер и регистрирует его в оркестраторе
 */
export function initializeGitHubMCP() {
  if (serverRegistered) {
    return;
  }

  // Инициализируем Octokit
  initializeOctokit();

  // Регистрируем инструменты в реестре
  toolsRegistry.set('getCurrentBranch', {
    name: 'getCurrentBranch',
    description: 'Получает название текущей ветки git репозитория',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: getCurrentBranch,
  });

  toolsRegistry.set('getBranchInfo', {
    name: 'getBranchInfo',
    description: 'Получает подробную информацию о ветке из GitHub',
    inputSchema: {
      type: 'object',
      properties: {
        branch: {
          type: 'string',
          description: 'Название ветки (если не указано, используется текущая)',
        },
      },
      required: [],
    },
    handler: getBranchInfo,
  });

  toolsRegistry.set('getOpenFiles', {
    name: 'getOpenFiles',
    description: 'Получает список измененных/открытых файлов в рабочей директории',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: getOpenFiles,
  });

  toolsRegistry.set('getRepositoryInfo', {
    name: 'getRepositoryInfo',
    description: 'Получает информацию о текущем GitHub репозитории (owner/repo)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: getRepositoryInfo,
  });

  // Регистрируем сервер в оркестраторе
  registerMCPServer({
    id: 'github-mcp-server',
    name: 'GitHub MCP Server',
    description: 'MCP сервер для работы с GitHub репозиторием (ветки, файлы, информация о репозитории)',
    category: 'github',
    priority: 8,
    getTools: async () => {
      return await getGitHubMCPTools();
    },
    callTool: async (toolName, args) => {
      return await callGitHubMCPTool(toolName, args);
    },
    metadata: {
      version: '1.0.0',
      supports: ['getCurrentBranch', 'getBranchInfo', 'getOpenFiles', 'getRepositoryInfo'],
      requiresToken: !!process.env.GITHUB_TOKEN,
    },
  });

  serverRegistered = true;
  console.log('[GitHubMCP] Сервер инициализирован и зарегистрирован');
}

/**
 * Вызывает инструмент GitHub MCP сервера
 * @param {string} toolName - Имя инструмента
 * @param {Object} args - Аргументы для инструмента
 * @returns {Promise<any>} Результат выполнения инструмента
 */
export async function callGitHubMCPTool(toolName, args) {
  try {
    const toolHandler = toolsRegistry.get(toolName);
    if (toolHandler && typeof toolHandler.handler === 'function') {
      const result = await toolHandler.handler(args);
      return {
        success: true,
        result: result,
      };
    }

    throw new Error(`Инструмент ${toolName} не найден в GitHub MCP сервере`);
  } catch (error) {
    console.error(`[GitHubMCP] Ошибка при вызове инструмента ${toolName}:`, error);
    throw error;
  }
}





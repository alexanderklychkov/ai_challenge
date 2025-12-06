/**
 * MCP сервер для автоматической генерации changelog из коммитов GitHub
 * Использует LLM для анализа коммитов и создания структурированного changelog
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
    octokit = new Octokit();
    console.warn('[ChangelogMCP] GITHUB_TOKEN не установлен. Некоторые функции могут быть недоступны.');
  }

  return octokit;
}

/**
 * Получает информацию о текущем репозитории (owner/repo)
 */
async function getRepositoryInfo() {
  try {
    const { stdout } = await execAsync('git config --get remote.origin.url');
    const url = stdout.trim();
    
    let owner, repo;
    
    if (url.includes('github.com')) {
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
 * Получает список коммитов между двумя точками (тегами, ветками или SHA)
 */
async function getCommits(args = {}) {
  try {
    const { owner, repo } = await getRepositoryInfo();
    const octokitClient = initializeOctokit();
    
    const {
      since = null, // SHA коммита, тег или ветка (начало периода)
      until = null, // SHA коммита, тег или ветка (конец периода, по умолчанию HEAD)
      branch = 'main', // Ветка для получения коммитов
      perPage = 100, // Количество коммитов на страницу
      maxCommits = 250, // Максимальное количество коммитов
    } = args;

    // Получаем SHA для since и until
    let sinceSha = since;
    let untilSha = until;

    if (since && !since.match(/^[0-9a-f]{40}$/)) {
      // Это не SHA, пытаемся получить SHA из тега или ветки
      try {
        const { data: refData } = await octokitClient.git.getRef({
          owner,
          repo,
          ref: `tags/${since}`.replace('tags/tags/', 'tags/'),
        });
        sinceSha = refData.object.sha;
      } catch {
        // Пытаемся как ветку
        try {
          const { data: branchData } = await octokitClient.repos.getBranch({
            owner,
            repo,
            branch: since,
          });
          sinceSha = branchData.commit.sha;
        } catch {
          // Используем как есть, возможно это SHA короткий
          sinceSha = since;
        }
      }
    }

    if (until && !until.match(/^[0-9a-f]{40}$/)) {
      try {
        const { data: refData } = await octokitClient.git.getRef({
          owner,
          repo,
          ref: `tags/${until}`.replace('tags/tags/', 'tags/'),
        });
        untilSha = refData.object.sha;
      } catch {
        try {
          const { data: branchData } = await octokitClient.repos.getBranch({
            owner,
            repo,
            branch: until,
          });
          untilSha = branchData.commit.sha;
        } catch {
          untilSha = until;
        }
      }
    }

    // Получаем коммиты
    const commits = [];
    let page = 1;
    let hasMore = true;
    let foundUntil = false;

    while (hasMore && commits.length < maxCommits && !foundUntil) {
      const params = {
        owner,
        repo,
        sha: branch,
        per_page: Math.min(perPage, maxCommits - commits.length),
        page,
      };

      const { data: pageCommits } = await octokitClient.repos.listCommits(params);

      if (pageCommits.length === 0) {
        hasMore = false;
        break;
      }

      for (const commit of pageCommits) {
        // Если указан until и мы достигли его, останавливаемся
        if (untilSha) {
          if (commit.sha === untilSha || commit.sha.startsWith(untilSha)) {
            foundUntil = true;
            break;
          }
        }

        // Если указан since, пропускаем коммиты до него
        if (sinceSha) {
          if (commit.sha === sinceSha || commit.sha.startsWith(sinceSha)) {
            // Достигли since, останавливаемся
            foundUntil = true;
            break;
          }
        }

        commits.push({
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.commit.author?.name || commit.author?.login,
          date: commit.commit.author?.date,
          url: commit.html_url,
        });
      }

      if (pageCommits.length < perPage || foundUntil) {
        hasMore = false;
      } else {
        page++;
      }
    }

    // Если указан since, фильтруем коммиты (исключаем сам since)
    if (sinceSha) {
      const filteredCommits = commits.filter(c => c.sha !== sinceSha && !c.sha.startsWith(sinceSha));
      // Если until не указан, берем все коммиты после since
      // Если until указан, берем коммиты между since и until
      if (untilSha) {
        const finalCommits = [];
        for (const commit of filteredCommits) {
          if (commit.sha === untilSha || commit.sha.startsWith(untilSha)) {
            break;
          }
          finalCommits.push(commit);
        }
        commits.length = 0;
        commits.push(...finalCommits);
      } else {
        commits.length = 0;
        commits.push(...filteredCommits);
      }
    }

    return {
      commits,
      count: commits.length,
      since: sinceSha || 'начало репозитория',
      until: untilSha || 'HEAD',
      branch,
    };
  } catch (error) {
    if (error.status === 404) {
      throw new Error('Репозиторий или ветка не найдены');
    }
    if (error.status === 401 || error.status === 403) {
      throw new Error('Недостаточно прав доступа. Убедитесь, что GITHUB_TOKEN установлен.');
    }
    throw new Error(`Ошибка при получении коммитов: ${error.message}`);
  }
}

/**
 * Получает список тегов репозитория
 */
async function getTags(args = {}) {
  try {
    const { owner, repo } = await getRepositoryInfo();
    const octokitClient = initializeOctokit();
    
    const { perPage = 100 } = args;

    const { data: tags } = await octokitClient.repos.listTags({
      owner,
      repo,
      per_page: perPage,
    });

    return tags.map(tag => ({
      name: tag.name,
      sha: tag.commit.sha,
      zipballUrl: tag.zipball_url,
      tarballUrl: tag.tarball_url,
    }));
  } catch (error) {
    if (error.status === 404) {
      throw new Error('Репозиторий не найден');
    }
    if (error.status === 401 || error.status === 403) {
      throw new Error('Недостаточно прав доступа. Убедитесь, что GITHUB_TOKEN установлен.');
    }
    throw new Error(`Ошибка при получении тегов: ${error.message}`);
  }
}

/**
 * Генерирует changelog из коммитов с использованием LLM
 * Эта функция будет вызываться через API endpoint с LLM
 */
async function generateChangelog(args = {}) {
  // Эта функция получает коммиты и возвращает их для обработки LLM
  // Сама генерация changelog происходит на стороне API endpoint
  const commitsData = await getCommits(args);
  
  return {
    commits: commitsData.commits,
    metadata: {
      since: commitsData.since,
      until: commitsData.until,
      branch: commitsData.branch,
      count: commitsData.count,
    },
  };
}

/**
 * Получает список доступных инструментов из Changelog MCP сервера
 */
export async function getChangelogMCPTools() {
  return [
    {
      name: 'getCommits',
      description: 'Получает список коммитов из GitHub репозитория между двумя точками (тегами, ветками или SHA)',
      inputSchema: {
        type: 'object',
        properties: {
          since: {
            type: 'string',
            description: 'SHA коммита, тег или ветка для начала периода (например, "v1.0.0" или "abc1234")',
          },
          until: {
            type: 'string',
            description: 'SHA коммита, тег или ветка для конца периода (по умолчанию HEAD)',
          },
          branch: {
            type: 'string',
            description: 'Ветка для получения коммитов (по умолчанию "main")',
          },
          perPage: {
            type: 'number',
            description: 'Количество коммитов на страницу (по умолчанию 100)',
          },
          maxCommits: {
            type: 'number',
            description: 'Максимальное количество коммитов (по умолчанию 250)',
          },
        },
        required: [],
      },
    },
    {
      name: 'getTags',
      description: 'Получает список тегов репозитория GitHub',
      inputSchema: {
        type: 'object',
        properties: {
          perPage: {
            type: 'number',
            description: 'Количество тегов на страницу (по умолчанию 100)',
          },
        },
        required: [],
      },
    },
    {
      name: 'generateChangelog',
      description: 'Получает коммиты для генерации changelog (используется вместе с LLM для создания структурированного changelog)',
      inputSchema: {
        type: 'object',
        properties: {
          since: {
            type: 'string',
            description: 'SHA коммита, тег или ветка для начала периода',
          },
          until: {
            type: 'string',
            description: 'SHA коммита, тег или ветка для конца периода',
          },
          branch: {
            type: 'string',
            description: 'Ветка для получения коммитов (по умолчанию "main")',
          },
        },
        required: [],
      },
    },
  ];
}

/**
 * Инициализирует Changelog MCP сервер и регистрирует его в оркестраторе
 */
export function initializeChangelogMCP() {
  if (serverRegistered) {
    return;
  }

  // Инициализируем Octokit
  initializeOctokit();

  // Регистрируем инструменты в реестре
  toolsRegistry.set('getCommits', {
    name: 'getCommits',
    description: 'Получает список коммитов из GitHub репозитория',
    inputSchema: {
      type: 'object',
      properties: {
        since: { type: 'string' },
        until: { type: 'string' },
        branch: { type: 'string' },
        perPage: { type: 'number' },
        maxCommits: { type: 'number' },
      },
      required: [],
    },
    handler: getCommits,
  });

  toolsRegistry.set('getTags', {
    name: 'getTags',
    description: 'Получает список тегов репозитория GitHub',
    inputSchema: {
      type: 'object',
      properties: {
        perPage: { type: 'number' },
      },
      required: [],
    },
    handler: getTags,
  });

  toolsRegistry.set('generateChangelog', {
    name: 'generateChangelog',
    description: 'Получает коммиты для генерации changelog',
    inputSchema: {
      type: 'object',
      properties: {
        since: { type: 'string' },
        until: { type: 'string' },
        branch: { type: 'string' },
      },
      required: [],
    },
    handler: generateChangelog,
  });

  // Регистрируем сервер в оркестраторе
  registerMCPServer({
    id: 'changelog-mcp-server',
    name: 'Changelog MCP Server',
    description: 'MCP сервер для автоматической генерации changelog из коммитов GitHub',
    category: 'changelog',
    priority: 7,
    getTools: async () => {
      return await getChangelogMCPTools();
    },
    callTool: async (toolName, args) => {
      return await callChangelogMCPTool(toolName, args);
    },
    metadata: {
      version: '1.0.0',
      supports: ['getCommits', 'getTags', 'generateChangelog'],
      requiresToken: !!process.env.GITHUB_TOKEN,
    },
  });

  serverRegistered = true;
  console.log('[ChangelogMCP] Сервер инициализирован и зарегистрирован');
}

/**
 * Вызывает инструмент Changelog MCP сервера
 */
export async function callChangelogMCPTool(toolName, args) {
  try {
    const toolHandler = toolsRegistry.get(toolName);
    if (toolHandler && typeof toolHandler.handler === 'function') {
      const result = await toolHandler.handler(args);
      return {
        success: true,
        result: result,
      };
    }

    throw new Error(`Инструмент ${toolName} не найден в Changelog MCP сервере`);
  } catch (error) {
    console.error(`[ChangelogMCP] Ошибка при вызове инструмента ${toolName}:`, error);
    throw error;
  }
}


/**
 * MCP клиент для работы с Todoist API
 * Предоставляет инструменты для работы с задачами, проектами, метками и секциями
 */

import { TodoistApi } from '@doist/todoist-api-typescript';

export class TodoistMCP {
  constructor() {
    this.api = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    const apiKey = process.env.TODOIST_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️  TODOIST_API_KEY не установлен. Функции работы с задачами будут недоступны.');
      this.initialized = false;
      return;
    }

    this.api = new TodoistApi(apiKey);
    this.initialized = true;
  }

  /**
   * Получает список всех доступных инструментов
   */
  getTools() {
    return [
      {
        name: 'getTasks',
        description: 'Получить список всех задач из Todoist с возможностью фильтрации по проекту, секции, метке или приоритету',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'ID проекта для фильтрации задач',
            },
            sectionId: {
              type: 'string',
              description: 'ID секции для фильтрации задач',
            },
            label: {
              type: 'string',
              description: 'Метка для фильтрации задач',
            },
            priority: {
              type: 'number',
              description: 'Приоритет для фильтрации (1-4, где 4 - самый высокий)',
              minimum: 1,
              maximum: 4,
            },
            limit: {
              type: 'number',
              description: 'Максимальное количество задач (по умолчанию все)',
            },
          },
        },
      },
      {
        name: 'searchTasks',
        description: 'Поиск задач в Todoist по фильтру (query string). Поддерживает фильтры: "today", "overdue", "priority 4", "@label" и т.д.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Строка запроса для фильтрации (например, "today", "overdue", "priority 4", "@label")',
            },
            lang: {
              type: 'string',
              description: 'Язык для парсинга дат (например, "ru", "en")',
            },
            limit: {
              type: 'number',
              description: 'Максимальное количество результатов',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'createTask',
        description: 'Создать новую задачу в Todoist',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Текст задачи (обязательно)',
            },
            description: {
              type: 'string',
              description: 'Описание задачи',
            },
            projectId: {
              type: 'string',
              description: 'ID проекта, в который добавить задачу',
            },
            sectionId: {
              type: 'string',
              description: 'ID секции, в которую добавить задачу',
            },
            parentId: {
              type: 'string',
              description: 'ID родительской задачи (для подзадач)',
            },
            priority: {
              type: 'number',
              description: 'Приоритет задачи (1-4, где 4 - самый высокий)',
              minimum: 1,
              maximum: 4,
            },
            labels: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Массив меток (labels) для задачи',
            },
            dueString: {
              type: 'string',
              description: 'Срок выполнения в виде строки (например, "завтра", "2025-01-15")',
            },
            dueDate: {
              type: 'string',
              description: 'Срок выполнения в формате YYYY-MM-DD',
            },
            dueDatetime: {
              type: 'string',
              description: 'Срок выполнения с временем в формате ISO 8601',
            },
          },
          required: ['content'],
        },
      },
      {
        name: 'updateTask',
        description: 'Обновить существующую задачу в Todoist',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'ID задачи для обновления',
            },
            content: {
              type: 'string',
              description: 'Новый текст задачи',
            },
            description: {
              type: 'string',
              description: 'Новое описание задачи',
            },
            priority: {
              type: 'number',
              description: 'Новый приоритет задачи (1-4)',
              minimum: 1,
              maximum: 4,
            },
            labels: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Новый массив меток',
            },
            dueString: {
              type: 'string',
              description: 'Новый срок выполнения в виде строки',
            },
            dueDate: {
              type: 'string',
              description: 'Новый срок выполнения в формате YYYY-MM-DD',
            },
            dueDatetime: {
              type: 'string',
              description: 'Новый срок выполнения с временем в формате ISO 8601',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'closeTask',
        description: 'Закрыть (завершить) задачу в Todoist',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'ID задачи для закрытия',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'getProjects',
        description: 'Получить список всех проектов из Todoist',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Максимальное количество проектов',
            },
          },
        },
      },
      {
        name: 'getLabels',
        description: 'Получить список всех меток из Todoist',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  /**
   * Вызывает инструмент Todoist
   */
  async callTool(toolName, args) {
    if (!this.initialized || !this.api) {
      throw new Error('Todoist API не инициализирован. Установите TODOIST_API_KEY в переменных окружения.');
    }

    try {
      switch (toolName) {
        case 'getTasks': {
          const params = {};
          if (args.projectId) params.projectId = args.projectId;
          if (args.sectionId) params.sectionId = args.sectionId;
          if (args.label) params.label = args.label;
          if (args.limit) params.limit = args.limit;

          let tasks = await this.api.getTasks(params);
          
          // Фильтруем по приоритету, если указан
          if (args.priority !== undefined) {
            tasks = tasks.filter(task => task.priority === args.priority);
          }

          return JSON.stringify(tasks, null, 2);
        }

        case 'searchTasks': {
          const searchParams = { query: args.query };
          if (args.lang) searchParams.lang = args.lang;
          if (args.limit) searchParams.limit = args.limit;

          const tasks = await this.api.getTasksByFilter(searchParams);
          return JSON.stringify(tasks, null, 2);
        }

        case 'createTask': {
          if (!args.content || args.content.trim() === '') {
            throw new Error('Параметр content обязателен и не может быть пустым');
          }

          const taskData = { content: args.content };
          if (args.description) taskData.description = args.description;
          if (args.projectId) taskData.projectId = args.projectId;
          if (args.sectionId) taskData.sectionId = args.sectionId;
          if (args.parentId) taskData.parentId = args.parentId;
          if (args.priority !== undefined) taskData.priority = args.priority;
          if (args.labels && args.labels.length > 0) taskData.labels = args.labels;
          if (args.dueString) taskData.dueString = args.dueString;
          if (args.dueDate) taskData.dueDate = args.dueDate;
          if (args.dueDatetime) taskData.dueDatetime = args.dueDatetime;

          const task = await this.api.addTask(taskData);
          return `Задача успешно создана!\n\n${JSON.stringify(task, null, 2)}`;
        }

        case 'updateTask': {
          const { taskId, ...updateData } = args;
          const task = await this.api.updateTask(taskId, updateData);
          return `Задача успешно обновлена!\n\n${JSON.stringify(task, null, 2)}`;
        }

        case 'closeTask': {
          const success = await this.api.closeTask(args.taskId);
          return success
            ? `Задача ${args.taskId} успешно закрыта`
            : `Не удалось закрыть задачу ${args.taskId}`;
        }

        case 'getProjects': {
          const params = {};
          if (args.limit) params.limit = args.limit;
          const projects = await this.api.getProjects(params);
          return JSON.stringify(projects, null, 2);
        }

        case 'getLabels': {
          const labels = await this.api.getLabels();
          return JSON.stringify(labels, null, 2);
        }

        default:
          throw new Error(`Неизвестный инструмент: ${toolName}`);
      }
    } catch (error) {
      throw new Error(`Ошибка при вызове инструмента ${toolName}: ${error.message}`);
    }
  }
}


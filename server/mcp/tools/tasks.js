/**
 * Регистрирует все инструменты для работы с задачами Todoist
 * @param {McpServer} server - Экземпляр MCP сервера
 * @param {TodoistApi} api - Экземпляр Todoist API
 */
export function registerTaskTools(server, api) {
  // Получить задачу по ID
  server.registerTool('getTask', {
    description: 'Получить задачу из Todoist по ID',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID задачи в Todoist',
        },
      },
      required: ['taskId'],
    },
  }, async ({ taskId }) => {
    try {
      const task = await api.getTask(taskId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(task, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Получить все задачи
  server.registerTool('getTasks', {
    description: 'Получить список всех задач из Todoist с возможностью фильтрации',
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
        limit: {
          type: 'number',
          description: 'Максимальное количество задач (по умолчанию все)',
        },
      },
    },
  }, async (args) => {
    try {
      const params = {};
      if (args.projectId) params.projectId = args.projectId;
      if (args.sectionId) params.sectionId = args.sectionId;
      if (args.label) params.label = args.label;
      if (args.limit) params.limit = args.limit;

      const tasks = await api.getTasks(params);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Создать задачу
  server.registerTool('createTask', {
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
  }, async (args) => {
    try {
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

      const task = await api.addTask(taskData);
      return {
        content: [
          {
            type: 'text',
            text: `Задача успешно создана!\n\n${JSON.stringify(task, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при создании задачи: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Обновить задачу
  server.registerTool('updateTask', {
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
  }, async (args) => {
    try {
      const { taskId, ...updateData } = args;
      const task = await api.updateTask(taskId, updateData);
      return {
        content: [
          {
            type: 'text',
            text: `Задача успешно обновлена!\n\n${JSON.stringify(task, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при обновлении задачи: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Закрыть (завершить) задачу
  server.registerTool('closeTask', {
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
  }, async ({ taskId }) => {
    try {
      const success = await api.closeTask(taskId);
      return {
        content: [
          {
            type: 'text',
            text: success
              ? `Задача ${taskId} успешно закрыта`
              : `Не удалось закрыть задачу ${taskId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при закрытии задачи: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Повторно открыть задачу
  server.registerTool('reopenTask', {
    description: 'Повторно открыть закрытую задачу в Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID задачи для повторного открытия',
        },
      },
      required: ['taskId'],
    },
  }, async ({ taskId }) => {
    try {
      const success = await api.reopenTask(taskId);
      return {
        content: [
          {
            type: 'text',
            text: success
              ? `Задача ${taskId} успешно открыта`
              : `Не удалось открыть задачу ${taskId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при открытии задачи: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Удалить задачу
  server.registerTool('deleteTask', {
    description: 'Удалить задачу из Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID задачи для удаления',
        },
      },
      required: ['taskId'],
    },
  }, async ({ taskId }) => {
    try {
      const success = await api.deleteTask(taskId);
      return {
        content: [
          {
            type: 'text',
            text: success
              ? `Задача ${taskId} успешно удалена`
              : `Не удалось удалить задачу ${taskId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при удалении задачи: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Поиск задач по фильтру
  server.registerTool('searchTasks', {
    description: 'Поиск задач в Todoist по фильтру (query string)',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Строка запроса для фильтрации (например, "today", "overdue", "@label")',
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
  }, async (args) => {
    try {
      const params = { query: args.query };
      if (args.lang) params.lang = args.lang;
      if (args.limit) params.limit = args.limit;

      const tasks = await api.getTasksByFilter(params);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при поиске задач: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Переместить задачу
  server.registerTool('moveTask', {
    description: 'Переместить задачу в другой проект, секцию или сделать подзадачей',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID задачи для перемещения',
        },
        projectId: {
          type: 'string',
          description: 'ID проекта назначения',
        },
        sectionId: {
          type: 'string',
          description: 'ID секции назначения',
        },
        parentId: {
          type: 'string',
          description: 'ID родительской задачи (чтобы сделать подзадачей)',
        },
      },
      required: ['taskId'],
    },
  }, async (args) => {
    try {
      const { taskId, ...moveData } = args;
      
      // Проверяем, что указан ровно один из параметров
      const paramsCount = [moveData.projectId, moveData.sectionId, moveData.parentId].filter(Boolean).length;
      if (paramsCount !== 1) {
        throw new Error('Необходимо указать ровно один из параметров: projectId, sectionId или parentId');
      }

      const task = await api.moveTask(taskId, moveData);
      return {
        content: [
          {
            type: 'text',
            text: `Задача успешно перемещена!\n\n${JSON.stringify(task, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при перемещении задачи: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}

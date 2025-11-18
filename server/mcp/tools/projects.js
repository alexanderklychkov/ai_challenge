/**
 * Регистрирует все инструменты для работы с проектами Todoist
 * @param {McpServer} server - Экземпляр MCP сервера
 * @param {TodoistApi} api - Экземпляр Todoist API
 */
export function registerProjectTools(server, api) {
  // Получить проект по ID
  server.registerTool('getProject', {
    description: 'Получить проект из Todoist по ID',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'ID проекта в Todoist',
        },
      },
      required: ['projectId'],
    },
  }, async ({ projectId }) => {
    try {
      const project = await api.getProject(projectId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(project, null, 2),
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

  // Получить все проекты
  server.registerTool('getProjects', {
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
  }, async (args) => {
    try {
      const params = {};
      if (args.limit) params.limit = args.limit;

      const projects = await api.getProjects(params);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(projects, null, 2),
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

  // Создать проект
  server.registerTool('createProject', {
    description: 'Создать новый проект в Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Название проекта (обязательно)',
        },
        parentId: {
          type: 'string',
          description: 'ID родительского проекта (для подпроектов)',
        },
        color: {
          type: 'string',
          description: 'Цвет проекта (например, "berry_red", "red", "orange")',
        },
        isFavorite: {
          type: 'boolean',
          description: 'Добавить проект в избранное',
        },
        viewStyle: {
          type: 'string',
          enum: ['list', 'board'],
          description: 'Стиль отображения проекта',
        },
      },
      required: ['name'],
    },
  }, async (args) => {
    try {
      if (!args.name || args.name.trim() === '') {
        throw new Error('Параметр name обязателен и не может быть пустым');
      }

      const projectData = { name: args.name };
      if (args.parentId) projectData.parentId = args.parentId;
      if (args.color) projectData.color = args.color;
      if (args.isFavorite !== undefined) projectData.isFavorite = args.isFavorite;
      if (args.viewStyle) projectData.viewStyle = args.viewStyle;

      const project = await api.addProject(projectData);
      return {
        content: [
          {
            type: 'text',
            text: `Проект успешно создан!\n\n${JSON.stringify(project, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при создании проекта: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Обновить проект
  server.registerTool('updateProject', {
    description: 'Обновить существующий проект в Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'ID проекта для обновления',
        },
        name: {
          type: 'string',
          description: 'Новое название проекта',
        },
        color: {
          type: 'string',
          description: 'Новый цвет проекта',
        },
        isFavorite: {
          type: 'boolean',
          description: 'Добавить/убрать из избранного',
        },
        viewStyle: {
          type: 'string',
          enum: ['list', 'board'],
          description: 'Новый стиль отображения',
        },
      },
      required: ['projectId'],
    },
  }, async (args) => {
    try {
      const { projectId, ...updateData } = args;
      const project = await api.updateProject(projectId, updateData);
      return {
        content: [
          {
            type: 'text',
            text: `Проект успешно обновлен!\n\n${JSON.stringify(project, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при обновлении проекта: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Получить архивные проекты
  server.registerTool('getArchivedProjects', {
    description: 'Получить список архивных проектов из Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Максимальное количество проектов',
        },
      },
    },
  }, async (args) => {
    try {
      const params = {};
      if (args.limit) params.limit = args.limit;

      const projects = await api.getArchivedProjects(params);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(projects, null, 2),
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
}

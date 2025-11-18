/**
 * Регистрирует все инструменты для работы с секциями Todoist
 * @param {McpServer} server - Экземпляр MCP сервера
 * @param {TodoistApi} api - Экземпляр Todoist API
 */
export function registerSectionTools(server, api) {
  // Получить секции проекта
  server.registerTool('getSections', {
    description: 'Получить список всех секций проекта из Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'ID проекта для получения секций',
        },
      },
      required: ['projectId'],
    },
  }, async ({ projectId }) => {
    try {
      const sections = await api.getSections({ projectId });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(sections, null, 2),
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

  // Создать секцию
  server.registerTool('createSection', {
    description: 'Создать новую секцию в проекте Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Название секции (обязательно)',
        },
        projectId: {
          type: 'string',
          description: 'ID проекта, в котором создать секцию',
        },
        order: {
          type: 'number',
          description: 'Порядок сортировки секции',
        },
      },
      required: ['name', 'projectId'],
    },
  }, async (args) => {
    try {
      if (!args.name || args.name.trim() === '') {
        throw new Error('Параметр name обязателен и не может быть пустым');
      }

      const sectionData = {
        name: args.name,
        projectId: args.projectId,
      };
      if (args.order !== undefined) sectionData.order = args.order;

      const section = await api.addSection(sectionData);
      return {
        content: [
          {
            type: 'text',
            text: `Секция успешно создана!\n\n${JSON.stringify(section, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при создании секции: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Обновить секцию
  server.registerTool('updateSection', {
    description: 'Обновить существующую секцию в Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        sectionId: {
          type: 'string',
          description: 'ID секции для обновления',
        },
        name: {
          type: 'string',
          description: 'Новое название секции (обязательно)',
        },
      },
      required: ['sectionId', 'name'],
    },
  }, async (args) => {
    try {
      if (!args.name || args.name.trim() === '') {
        throw new Error('Параметр name обязателен и не может быть пустым');
      }

      const { sectionId, name } = args;
      const section = await api.updateSection(sectionId, { name });
      return {
        content: [
          {
            type: 'text',
            text: `Секция успешно обновлена!\n\n${JSON.stringify(section, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при обновлении секции: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Удалить секцию
  server.registerTool('deleteSection', {
    description: 'Удалить секцию из Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        sectionId: {
          type: 'string',
          description: 'ID секции для удаления',
        },
      },
      required: ['sectionId'],
    },
  }, async ({ sectionId }) => {
    try {
      const success = await api.deleteSection(sectionId);
      return {
        content: [
          {
            type: 'text',
            text: success
              ? `Секция ${sectionId} успешно удалена`
              : `Не удалось удалить секцию ${sectionId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при удалении секции: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}

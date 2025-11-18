/**
 * Регистрирует все инструменты для работы с метками Todoist
 * @param {McpServer} server - Экземпляр MCP сервера
 * @param {TodoistApi} api - Экземпляр Todoist API
 */
export function registerLabelTools(server, api) {
  // Получить все метки
  server.registerTool('getLabels', {
    description: 'Получить список всех меток из Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Максимальное количество меток',
        },
      },
    },
  }, async (args) => {
    try {
      const params = {};
      if (args.limit) params.limit = args.limit;

      const labels = await api.getLabels(params);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(labels, null, 2),
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

  // Создать метку
  server.registerTool('createLabel', {
    description: 'Создать новую метку в Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Название метки (обязательно)',
        },
        order: {
          type: 'number',
          description: 'Порядок сортировки метки',
        },
        color: {
          type: 'string',
          description: 'Цвет метки (например, "berry_red", "red", "orange")',
        },
        isFavorite: {
          type: 'boolean',
          description: 'Добавить метку в избранное',
        },
      },
      required: ['name'],
    },
  }, async (args) => {
    try {
      if (!args.name || args.name.trim() === '') {
        throw new Error('Параметр name обязателен и не может быть пустым');
      }

      const labelData = { name: args.name };
      if (args.order !== undefined) labelData.order = args.order;
      if (args.color) labelData.color = args.color;
      if (args.isFavorite !== undefined) labelData.isFavorite = args.isFavorite;

      const label = await api.addLabel(labelData);
      return {
        content: [
          {
            type: 'text',
            text: `Метка успешно создана!\n\n${JSON.stringify(label, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при создании метки: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Обновить метку
  server.registerTool('updateLabel', {
    description: 'Обновить существующую метку в Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: {
          type: 'string',
          description: 'ID метки для обновления',
        },
        name: {
          type: 'string',
          description: 'Новое название метки',
        },
        order: {
          type: 'number',
          description: 'Новый порядок сортировки',
        },
        color: {
          type: 'string',
          description: 'Новый цвет метки',
        },
        isFavorite: {
          type: 'boolean',
          description: 'Добавить/убрать из избранного',
        },
      },
      required: ['labelId'],
    },
  }, async (args) => {
    try {
      const { labelId, ...updateData } = args;
      const label = await api.updateLabel(labelId, updateData);
      return {
        content: [
          {
            type: 'text',
            text: `Метка успешно обновлена!\n\n${JSON.stringify(label, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при обновлении метки: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Удалить метку
  server.registerTool('deleteLabel', {
    description: 'Удалить метку из Todoist',
    inputSchema: {
      type: 'object',
      properties: {
        labelId: {
          type: 'string',
          description: 'ID метки для удаления',
        },
      },
      required: ['labelId'],
    },
  }, async ({ labelId }) => {
    try {
      const success = await api.deleteLabel(labelId);
      return {
        content: [
          {
            type: 'text',
            text: success
              ? `Метка ${labelId} успешно удалена`
              : `Не удалось удалить метку ${labelId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при удалении метки: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}

/**
 * Регистрирует инструмент reminder для получения сводки задач
 * @param {McpServer} server - Экземпляр MCP сервера
 * @param {TodoistApi} api - Экземпляр Todoist API
 */
export function registerReminderTool(server, api) {
  server.registerTool('reminder', {
    description: 'Получить сводку о текущих задачах из Todoist. Возвращает список активных задач с их приоритетами и сроками выполнения.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Фильтр для задач (например, "today", "overdue", или пустая строка для всех активных задач)',
        },
        limit: {
          type: 'number',
          description: 'Максимальное количество задач для отображения (по умолчанию 20)',
        },
      },
    },
  }, async (args) => {
    try {
      const filter = args.filter || '';
      const limit = args.limit || 20;

      // Получаем задачи с учетом фильтра
      // getTasks() не принимает параметр filter, используем getTasksByFilter для фильтров
      let tasksResult;
      if (filter === 'today') {
        // Задачи на сегодня - используем getTasksByFilter с запросом "today"
        tasksResult = await api.getTasksByFilter({ query: 'today' });
      } else if (filter === 'overdue') {
        // Просроченные задачи - используем getTasksByFilter с запросом "overdue"
        tasksResult = await api.getTasksByFilter({ query: 'overdue' });
      } else {
        // Все активные задачи - используем getTasks() без параметров
        tasksResult = await api.getTasks();
      }

      // Проверяем, что результат является массивом
      // API должен возвращать массив напрямую
      let tasks;
      if (Array.isArray(tasksResult)) {
        tasks = tasksResult;
      } else if (tasksResult && Array.isArray(tasksResult.data)) {
        tasks = tasksResult.data;
      } else if (tasksResult && Array.isArray(tasksResult.tasks)) {
        tasks = tasksResult.tasks;
      } else if (tasksResult && tasksResult !== null && tasksResult !== undefined) {
        // Если это объект, но не массив, попробуем найти массив внутри
        // Логируем структуру для отладки
        console.error('getTasks/getTasksByFilter вернул объект. Структура:', Object.keys(tasksResult));
        console.error('Тип:', typeof tasksResult);
        console.error('Значение (первые 500 символов):', JSON.stringify(tasksResult, null, 2).substring(0, 500));
        
        // Попробуем найти массив в объекте
        const possibleArrayKeys = ['items', 'results', 'tasks', 'data', 'list'];
        for (const key of possibleArrayKeys) {
          if (Array.isArray(tasksResult[key])) {
            tasks = tasksResult[key];
            break;
          }
        }
        
        if (!tasks) {
          throw new Error(`Ожидался массив задач, получен объект. Структура: ${Object.keys(tasksResult).join(', ')}`);
        }
      } else {
        // Если результат null или undefined, возвращаем пустой массив
        tasks = [];
      }

      // Фильтруем только невыполненные задачи
      const activeTasks = tasks.filter(task => !task.isCompleted);

      // Ограничиваем количество
      const limitedTasks = activeTasks.slice(0, limit);

      if (limitedTasks.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '✅ У вас нет активных задач!',
            },
          ],
        };
      }

      // Форматируем задачи в читаемый вид
      const formatTask = (task) => {
        // В Todoist приоритеты: 1 - нормальный, 2 - средний, 3 - высокий, 4 - критический
        const priorityEmoji = {
          1: '⚪', // p1 - нормальный
          2: '🟡', // p2 - средний
          3: '🟠', // p3 - высокий
          4: '🔴', // p4 - критический
        };

        const priority = priorityEmoji[task.priority] || '⚪';
        const content = task.content || 'Без названия';
        
        // Обрабатываем дату выполнения
        let dueDateStr = '';
        if (task.due) {
          try {
            const dueDate = task.due.date ? new Date(task.due.date) : new Date(task.due);
            dueDateStr = `📅 ${dueDate.toLocaleDateString('ru-RU')}`;
          } catch (e) {
            // Если не удалось распарсить дату, пропускаем
          }
        }
        
        // Обрабатываем метки
        const labelsStr = task.labels && Array.isArray(task.labels) && task.labels.length > 0 
          ? `🏷️ ${task.labels.join(', ')}` 
          : '';

        return `${priority} ${content}${dueDateStr ? ' ' + dueDateStr : ''}${labelsStr ? ' ' + labelsStr : ''}`;
      };

      const formattedTasks = limitedTasks.map(formatTask);
      const summary = `📋 Сводка задач (${limitedTasks.length} из ${activeTasks.length}):\n\n${formattedTasks.join('\n')}`;

      return {
        content: [
          {
            type: 'text',
            text: summary,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при получении сводки задач: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}


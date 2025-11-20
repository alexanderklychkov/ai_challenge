/**
 * Регистрирует инструменты для работы со статьями
 * @param {McpServer} server - Экземпляр MCP сервера
 */

/**
 * Получает содержимое статьи по URL
 * Использует простой fetch для получения HTML и извлечения текста
 */
export function registerArticleTools(server) {
  server.registerTool('readArticle', {
    description: 'Прочитать содержимое статьи по URL. Извлекает основной текст статьи, игнорируя навигацию, рекламу и другие элементы страницы. После чтения статьи рекомендуется проанализировать её содержимое и создать задачи для изучения материала (используйте createTask для создания задач).',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL статьи для чтения (например, https://react.dev/reference/react/useEffect)',
        },
      },
      required: ['url'],
    },
  }, async ({ url }) => {
    try {
      if (!url || typeof url !== 'string') {
        throw new Error('URL обязателен и должен быть строкой');
      }

      // Валидация URL
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch (e) {
        throw new Error(`Некорректный URL: ${url}`);
      }

      // Получаем содержимое страницы
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Не удалось загрузить страницу: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();

      // Простое извлечение текста из HTML
      // Удаляем скрипты и стили
      let text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

      // Извлекаем текст из основных тегов контента
      const contentTags = ['article', 'main', '[role="main"]', '.content', '.post', '.article'];
      let articleText = '';

      // Извлекаем заголовок страницы
      let title = '';
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
      }
      
      // Пытаемся найти article тег
      const articleMatch = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (articleMatch) {
        text = articleMatch[1];
      }
      
      // Также пытаемся найти main контент
      const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
      if (mainMatch && !articleMatch) {
        text = mainMatch[1];
      }

      // Извлекаем текст из параграфов, заголовков и списков
      const paragraphs = text.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
      const headings = text.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi) || [];
      const listItems = text.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      const codeBlocks = text.match(/<code[^>]*>([\s\S]*?)<\/code>/gi) || [];
      const preBlocks = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/gi) || [];

      // Объединяем все элементы контента
      const allContent = [...headings, ...paragraphs, ...listItems, ...codeBlocks, ...preBlocks];
      
      // Функция для очистки HTML тегов
      const cleanHtml = (html) => {
        return html
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&apos;/g, "'")
          .replace(/&mdash;/g, '—')
          .replace(/&ndash;/g, '–')
          .replace(/&hellip;/g, '...')
          .replace(/\s+/g, ' ')
          .trim();
      };
      
      // Извлекаем чистый текст из HTML тегов
      articleText = allContent
        .map(tag => cleanHtml(tag))
        .filter(text => text.length > 10) // Фильтруем слишком короткие фрагменты
        .join('\n\n');

      // Если не удалось извлечь достаточно текста, используем весь текст страницы
      if (articleText.length < 500) {
        articleText = text
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
      }

      if (!articleText || articleText.length < 100) {
        throw new Error('Не удалось извлечь содержимое статьи из страницы');
      }

      // Ограничиваем размер текста (первые 50000 символов)
      const maxLength = 50000;
      const truncatedText = articleText.length > maxLength 
        ? articleText.substring(0, maxLength) + '\n\n[... текст обрезан ...]'
        : articleText;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              url: parsedUrl.href,
              title: title || parsedUrl.hostname + parsedUrl.pathname,
              content: truncatedText,
              length: truncatedText.length,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Ошибка при чтении статьи: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  /**
   * Создает задачи на основе анализа статьи
   * Этот инструмент использует AI для анализа статьи и создания задач
   */
  server.registerTool('createTasksFromArticle', {
    description: 'Анализирует статью и создает задачи на основе её содержимого. Принимает URL статьи и создает релевантные задачи для изучения материала.',
    inputSchema: {
      type: 'object',
      properties: {
        articleUrl: {
          type: 'string',
          description: 'URL статьи для анализа',
        },
        articleContent: {
          type: 'string',
          description: 'Содержимое статьи (если уже прочитано)',
        },
        maxTasks: {
          type: 'number',
          description: 'Максимальное количество задач для создания (по умолчанию 5)',
          default: 5,
        },
        projectId: {
          type: 'string',
          description: 'ID проекта Todoist для создания задач',
        },
      },
      required: ['articleUrl'],
    },
  }, async (args) => {
    try {
      // Этот инструмент будет использоваться AI для планирования
      // Реальная реализация будет через цепочку инструментов
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'Используйте цепочку инструментов: сначала readArticle для чтения статьи, затем createTask для создания задач на основе анализа.',
              articleUrl: args.articleUrl,
            }, null, 2),
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


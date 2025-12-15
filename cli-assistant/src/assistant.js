/**
 * Основной класс ассистента
 * Интегрирует RAG для документации и MCP для git
 */

import { RAGService } from './rag/ragService.js';
import { DocumentIndexer } from './rag/indexer.js';
import { GitMCP } from './mcp/gitMCP.js';
import { TodoistMCP } from './mcp/todoistMCP.js';
import { LLMClient } from './llm/client.js';
import path from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { 
  loadPersonalization, 
  buildPersonalizedSystemPrompt 
} from '../../server/utils/personalizationService.js';

export class Assistant {
  constructor() {
    this.ragService = null;
    this.indexer = null;
    this.gitMCP = null;
    this.todoistMCP = null;
    this.llmClient = null;
    this.initialized = false;
    
    // Путь к индексу документации (в директории проекта)
    this.indexPath = path.resolve(process.cwd(), '.dev-assistant', 'index.json');
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    // Создаем директорию для индекса если её нет
    const indexDir = path.dirname(this.indexPath);
    if (!existsSync(indexDir)) {
      await mkdir(indexDir, { recursive: true });
    }

    // Инициализируем RAG
    // Если USE_TEXT_SEARCH=true, пропускаем эмбеддинги и используем только текстовый поиск
    let embeddingConfig = {};
    if (process.env.USE_TEXT_SEARCH === 'true') {
      // Принудительно используем только текстовый поиск
      embeddingConfig = {
        skipEmbeddings: true,
      };
    } else {
      // Используем Hugging Face Inference Providers API
      // Документация: https://huggingface.co/docs/inference-providers/index
      if (!process.env.HF_TOKEN) {
        throw new Error('Не найден API ключ для эмбеддингов. Установите переменную окружения HF_TOKEN');
      }
      // Используем модель, которая точно доступна через Inference Providers
      const defaultModel = 'sentence-transformers/all-MiniLM-L6-v2';
      embeddingConfig = {
        apiKey: process.env.HF_TOKEN,
        model: defaultModel,
      };
    }

    this.indexer = new DocumentIndexer({
      indexPath: this.indexPath,
      embeddingConfig,
      chunkOptions: {
        chunkSize: 1000,
        chunkOverlap: 200,
      },
    });

    await this.indexer.initialize();
    this.ragService = new RAGService(this.indexer);

    // Инициализируем Git MCP
    this.gitMCP = new GitMCP();
    await this.gitMCP.initialize();

    // Инициализируем Todoist MCP
    this.todoistMCP = new TodoistMCP();
    await this.todoistMCP.initialize();

    // Инициализируем LLM клиент
    this.llmClient = new LLMClient();

    this.initialized = true;
  }

  async ask(question) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Получаем контекст из git
    const gitContext = await this.gitMCP.getContext();
    
    // Получаем доступные инструменты Todoist
    const todoistTools = this.todoistMCP.initialized ? this.todoistMCP.getTools() : [];
    
    // Загружаем персонализацию
    const personalization = await loadPersonalization();
    
    // Формируем базовый системный промпт с контекстом git и информацией о задачах
    const baseSystemPrompt = this.buildSystemPrompt(gitContext, todoistTools.length > 0);
    
    // Обогащаем системный промпт персонализацией
    const systemPrompt = buildPersonalizedSystemPrompt(personalization, baseSystemPrompt);

    // Выполняем RAG запрос с поддержкой function calling
    const result = await this.ragService.queryWithRAG(
      question,
      async (prompt, messages) => {
        return await this.chatWithTools(prompt, messages, systemPrompt, todoistTools);
      },
      {
        topK: 5,
        minScore: 0.3,
        messages: [],
      }
    );

    return result.answer;
  }

  async chatWithTools(prompt, messages, systemPrompt, tools) {
    const conversationMessages = [...messages];
    
    // Добавляем пользовательский запрос
    if (prompt) {
      conversationMessages.push({ role: 'user', content: prompt });
    }

    let maxIterations = 5; // Максимум итераций для обработки function calls
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Вызываем LLM с инструментами (только в первой итерации передаем tools)
      const response = await this.llmClient.chat(
        null,
        conversationMessages,
        systemPrompt,
        iteration === 1 ? tools : null // Передаем tools только в первой итерации
      );

      // Если есть вызовы функций, выполняем их
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Добавляем ответ ассистента в историю
        const assistantMessage = {
          role: 'assistant',
          content: response.text || null,
          tool_calls: response.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function?.name,
              arguments: tc.function?.arguments,
            },
          })),
        };
        conversationMessages.push(assistantMessage);

        // Выполняем все вызовы функций
        const toolResults = [];
        for (const toolCall of response.toolCalls) {
          try {
            const toolName = toolCall.function?.name;
            let toolArgs = {};
            
            try {
              toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
            } catch (parseError) {
              // Если не удалось распарсить JSON, пробуем как строку
              toolArgs = { query: toolCall.function?.arguments || '' };
            }

            // Нормализуем параметры для Todoist инструментов
            toolArgs = this.normalizeToolArgs(toolName, toolArgs);

            if (this.todoistMCP.initialized) {
              const result = await this.todoistMCP.callTool(toolName, toolArgs);
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolName,
                content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
              });
            } else {
              toolResults.push({
                tool_call_id: toolCall.id,
                role: 'tool',
                name: toolName,
                content: 'Todoist API не инициализирован. Установите TODOIST_API_KEY в переменных окружения.',
              });
            }
          } catch (error) {
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: toolCall.function?.name,
              content: `Ошибка: ${error.message}`,
            });
          }
        }

        // Добавляем результаты выполнения функций в историю
        conversationMessages.push(...toolResults);

        // Продолжаем цикл для получения финального ответа
        continue;
      }

      // Если нет вызовов функций, возвращаем ответ
      return response;
    }

    // Если достигнут лимит итераций, возвращаем последний ответ
    const finalResponse = await this.llmClient.chat(
      null,
      conversationMessages,
      systemPrompt,
      null
    );

    return finalResponse;
  }

  async indexDocumentation(dirPath) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Индексируем документацию
    const result = await this.indexer.indexDirectory(dirPath, [
      '.git',
      'node_modules',
      'dist',
      '.next',
      'build',
      '.dev-assistant',
    ], (progress) => {
      console.log(`[${progress.stage}] ${progress.message}`);
    });

    console.log(`\n✅ Проиндексировано документов: ${result.totalDocuments}`);
    console.log(`✅ Всего чанков: ${result.totalChunks}`);
  }

  buildSystemPrompt(gitContext, hasTodoistTools = false) {
    let prompt = `Ты - полезный AI ассистент для команды разработчиков. Твоя задача - помогать команде управлять проектом, понимать его структуру и работать с задачами.

Ты - мой личный агент, который знает меня и мои предпочтения.

Ты имеешь доступ к:
1. Документации проекта через RAG (Retrieval-Augmented Generation)
2. Информации о текущем git-репозитории через MCP
${hasTodoistTools ? '3. Инструментам для работы с задачами Todoist (создание, поиск, обновление задач)' : ''}

`;

    if (gitContext) {
      prompt += `Текущий контекст git-репозитория:
- Текущая ветка: ${gitContext.branch || 'неизвестна'}
- Измененные файлы: ${gitContext.modifiedFiles?.length || 0}
`;

      if (gitContext.modifiedFiles && gitContext.modifiedFiles.length > 0) {
        prompt += `- Список измененных файлов:\n`;
        gitContext.modifiedFiles.forEach(file => {
          prompt += `  - ${file.file} (${file.status})\n`;
        });
      }
    }

    prompt += `
При ответе на вопросы:
1. Используй информацию из документации проекта, если она доступна
2. Учитывай текущий контекст git-репозитория
3. ВАЖНО: Если пользователь просит создать задачу, обновить задачу или выполнить другое действие через Todoist - ВСЕГДА используй соответствующие инструменты. Это не "придумывание ответа", это выполнение действия.
4. При работе с задачами:
   - Если пользователь просит создать задачу - используй createTask с указанными параметрами (content обязателен, priority=4 для высокого приоритета)
   - Используй searchTasks для поиска задач по фильтрам (например, "priority 4" для задач с высоким приоритетом)
   - Используй getTasks для получения списка задач с фильтрацией
   - Анализируй задачи и давай рекомендации по приоритетам
   - Предлагай, что делать первым, основываясь на приоритетах и сроках
5. Если информации в документации нет, но пользователь просит выполнить действие (создать задачу, найти информацию и т.д.) - выполняй действие через инструменты
6. Предоставляй конкретные примеры кода, если они есть в документации
7. Помогай находить фрагменты кода и объяснять правила стиля проекта
`;

    return prompt;
  }

  /**
   * Нормализует аргументы инструментов для корректной работы с Todoist API
   */
  normalizeToolArgs(toolName, args) {
    const normalized = { ...args };

    // Если пришел параметр filter, обрабатываем его
    if (normalized.filter) {
      const filterValue = normalized.filter;
      
      // Если filter содержит "priority X", извлекаем приоритет
      const priorityMatch = filterValue.match(/priority\s+(\d+)/i);
      
      if (priorityMatch) {
        const priority = parseInt(priorityMatch[1], 10);
        
        // Для getTasks используем параметр priority
        if (toolName === 'getTasks') {
          normalized.priority = priority;
          delete normalized.filter;
        } 
        // Для searchTasks используем query с фильтром
        else if (toolName === 'searchTasks') {
          normalized.query = filterValue;
          delete normalized.filter;
        }
      } else {
        // Если это не приоритет, преобразуем filter в query для searchTasks
        if (toolName === 'searchTasks') {
          normalized.query = filterValue;
          delete normalized.filter;
        }
      }
    }

    // Для searchTasks: преобразуем filter в query, если нужно
    if (toolName === 'searchTasks' && normalized.filter && !normalized.query) {
      normalized.query = normalized.filter;
      delete normalized.filter;
    }

    // Для getTasks: если query содержит "priority X", преобразуем в параметр priority
    if (toolName === 'getTasks' && normalized.query) {
      const priorityMatch = normalized.query.match(/priority\s+(\d+)/i);
      if (priorityMatch) {
        normalized.priority = parseInt(priorityMatch[1], 10);
        delete normalized.query;
      }
    }

    return normalized;
  }
}


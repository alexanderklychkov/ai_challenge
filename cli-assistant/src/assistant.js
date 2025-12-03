/**
 * Основной класс ассистента
 * Интегрирует RAG для документации и MCP для git
 */

import { RAGService } from './rag/ragService.js';
import { DocumentIndexer } from './rag/indexer.js';
import { GitMCP } from './mcp/gitMCP.js';
import { LLMClient } from './llm/client.js';
import path from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';

export class Assistant {
  constructor() {
    this.ragService = null;
    this.indexer = null;
    this.gitMCP = null;
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
    
    // Формируем системный промпт с контекстом git
    const systemPrompt = this.buildSystemPrompt(gitContext);

    // Выполняем RAG запрос
    const result = await this.ragService.queryWithRAG(
      question,
      async (prompt, messages) => {
        return await this.llmClient.chat(prompt, messages, systemPrompt);
      },
      {
        topK: 5,
        minScore: 0.3,
        messages: [],
      }
    );

    return result.answer;
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

  buildSystemPrompt(gitContext) {
    let prompt = `Ты - полезный AI ассистент для разработчиков. Твоя задача - помогать разработчикам понимать проект, находить нужные фрагменты кода и отвечать на вопросы о проекте.

Ты имеешь доступ к:
1. Документации проекта через RAG (Retrieval-Augmented Generation)
2. Информации о текущем git-репозитории через MCP

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
3. Если информации в документации нет, честно скажи об этом
4. Предоставляй конкретные примеры кода, если они есть в документации
5. Помогай находить фрагменты кода и объяснять правила стиля проекта
`;

    return prompt;
  }
}


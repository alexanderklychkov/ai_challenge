import { DocumentIndexer } from './indexer.js';

/**
 * Сервис для работы с RAG (Retrieval-Augmented Generation)
 */
export class RAGService {
  /**
   * @param {DocumentIndexer} indexer - Индексатор документов
   */
  constructor(indexer) {
    this.indexer = indexer;
  }

  /**
   * Формирует промпт с контекстом из релевантных чанков
   * @param {string} question - Вопрос пользователя
   * @param {Array} chunks - Релевантные чанки
   * @returns {string} Промпт с контекстом
   */
  buildRAGPrompt(question, chunks) {
    if (!chunks || chunks.length === 0) {
      return question;
    }

    const contextText = chunks
      .map((chunk, index) => {
        const source = chunk.document?.fileName || chunk.document?.id || 'Неизвестный источник';
        return `[Источник ${index + 1}: ${source}]\n${chunk.text}`;
      })
      .join('\n\n---\n\n');

    return `Используй следующую информацию из документов для ответа на вопрос. Если информация в документах не содержит ответа на вопрос, скажи об этом честно.

Контекст из документов:
${contextText}

Вопрос: ${question}

Ответ:`;
  }

  /**
   * Ищет релевантные чанки для вопроса
   * @param {string} question - Вопрос пользователя
   * @param {number} topK - Количество чанков для поиска
   * @param {number} minScore - Минимальный score для включения
   * @returns {Promise<Array>} Массив релевантных чанков
   */
  async searchRelevantChunks(question, topK = 5, minScore = 0.3) {
    try {
      const results = await this.indexer.search(question, topK, minScore);
      return results.map(result => ({
        text: result.chunk.text,
        score: result.score,
        metadata: result.chunk.metadata,
        document: result.document,
      }));
    } catch (error) {
      console.error('Ошибка при поиске релевантных чанков:', error);
      return [];
    }
  }

  /**
   * Выполняет RAG запрос: поиск чанков → объединение с вопросом → запрос к LLM
   * @param {string} question - Вопрос пользователя
   * @param {Function} llmCaller - Функция для вызова LLM (async (prompt, messages) => response)
   * @param {object} options - Опции
   * @param {number} options.topK - Количество чанков для поиска
   * @param {number} options.minScore - Минимальный score для включения
   * @param {Array} options.messages - История сообщений для контекста
   * @returns {Promise<object>} Результат с ответом и метаданными
   */
  async queryWithRAG(question, llmCaller, options = {}) {
    const { topK = 5, minScore = 0.3, messages = [] } = options;

    // Шаг 1: Поиск релевантных чанков
    const chunks = await this.searchRelevantChunks(question, topK, minScore);

    // Шаг 2: Объединение с вопросом
    const ragPrompt = this.buildRAGPrompt(question, chunks);

    // Шаг 3: Запрос к LLM
    const ragMessages = [
      ...messages.slice(0, -1), // Все сообщения кроме последнего
      { role: 'user', content: ragPrompt }, // Заменяем последнее сообщение на RAG промпт
    ];

    const response = await llmCaller(ragPrompt, ragMessages);

    return {
      answer: response.text || response.content || response,
      chunks: chunks.map(chunk => ({
        text: chunk.text.substring(0, 200) + '...', // Обрезаем для отображения
        score: chunk.score,
        source: chunk.document?.fileName || chunk.document?.id || 'Неизвестный источник',
      })),
      chunksCount: chunks.length,
      usedRAG: true,
      metadata: {
        topK,
        minScore,
        tokens: response.tokens,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    };
  }

  /**
   * Выполняет запрос без RAG (обычный запрос к LLM)
   * @param {string} question - Вопрос пользователя
   * @param {Function} llmCaller - Функция для вызова LLM
   * @param {Array} messages - История сообщений
   * @returns {Promise<object>} Результат с ответом
   */
  async queryWithoutRAG(question, llmCaller, messages = []) {
    const response = await llmCaller(question, messages);

    return {
      answer: response.text || response.content || response,
      chunks: [],
      chunksCount: 0,
      usedRAG: false,
      metadata: {
        tokens: response.tokens,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    };
  }

  /**
   * Сравнивает ответы с RAG и без RAG
   * @param {string} question - Вопрос пользователя
   * @param {Function} llmCaller - Функция для вызова LLM
   * @param {object} options - Опции
   * @returns {Promise<object>} Результат сравнения
   */
  async compareRAGvsNoRAG(question, llmCaller, options = {}) {
    const { messages = [], topK = 5, minScore = 0.3 } = options;

    // Выполняем оба запроса параллельно
    const [ragResult, noRagResult] = await Promise.all([
      this.queryWithRAG(question, llmCaller, { messages, topK, minScore }),
      this.queryWithoutRAG(question, llmCaller, messages),
    ]);

    return {
      question,
      ragAnswer: ragResult.answer,
      noRagAnswer: noRagResult.answer,
      ragChunks: ragResult.chunks,
      ragMetadata: ragResult.metadata,
      noRagMetadata: noRagResult.metadata,
      comparison: {
        ragUsedChunks: ragResult.chunksCount,
        ragTokens: ragResult.metadata.tokens,
        noRagTokens: noRagResult.metadata.tokens,
        tokenDifference: (ragResult.metadata.tokens || 0) - (noRagResult.metadata.tokens || 0),
      },
    };
  }
}


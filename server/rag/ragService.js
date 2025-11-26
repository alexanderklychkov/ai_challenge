import { DocumentIndexer } from './indexer.js';
import { RelevanceReranker } from './reranker/relevanceReranker.js';

/**
 * Сервис для работы с RAG (Retrieval-Augmented Generation)
 */
export class RAGService {
  /**
   * @param {DocumentIndexer} indexer - Индексатор документов
   * @param {object} rerankerConfig - Конфигурация reranker (опционально)
   */
  constructor(indexer, rerankerConfig = null) {
    this.indexer = indexer;
    this.reranker = rerankerConfig ? new RelevanceReranker(rerankerConfig) : null;
  }

  /**
   * Формирует промпт с контекстом из релевантных чанков
   * @param {string} question - Вопрос пользователя
   * @param {Array} chunks - Релевантные чанки
   * @param {boolean} noRelevantChunks - Флаг, что не найдено релевантных чанков
   * @returns {string} Промпт с контекстом
   */
  buildRAGPrompt(question, chunks, noRelevantChunks = false) {
    if (!chunks || chunks.length === 0) {
      if (noRelevantChunks) {
        return `Пользователь задал вопрос, но в документах не найдено релевантной информации для ответа.

Вопрос: ${question}

ВАЖНО: Не придумывай ответ от себя. Честно скажи, что в предоставленных документах нет информации для ответа на этот вопрос. Не используй свои знания, если они не подтверждены документами.`;
      }
      return question;
    }

    // Проверяем, есть ли fallback чанки (с низкой релевантностью)
    const hasFallback = chunks.some(chunk => chunk.isFallback);
    const fallbackChunks = chunks.filter(chunk => chunk.isFallback);
    const normalChunks = chunks.filter(chunk => !chunk.isFallback);

    const contextText = chunks
      .map((chunk, index) => {
        const source = chunk.document?.fileName || chunk.document?.id || 'Неизвестный источник';
        const fallbackNote = chunk.isFallback ? '\n[ВНИМАНИЕ: Этот чанк имеет низкую релевантность и используется как запасной вариант]' : '';
        return `[Источник ${index + 1}: ${source}]${fallbackNote}\n${chunk.text}`;
      })
      .join('\n\n---\n\n');

    let prompt = `Используй следующую информацию из документов для ответа на вопрос.`;
    
    if (hasFallback) {
      prompt += `\n\nВАЖНО: Все релевантные чанки были отфильтрованы из-за строгого порога релевантности. Предоставленные чанки имеют низкую релевантность запросу. Если информация в этих чанках не содержит ответа на вопрос, честно скажи об этом. НЕ придумывай ответ от себя.`;
    } else {
      prompt += ` Если информация в документах не содержит ответа на вопрос, скажи об этом честно.`;
    }

    prompt += `\n\nКонтекст из документов:\n${contextText}\n\nВопрос: ${question}\n\nОтвет:`;

    return prompt;
  }

  /**
   * Ищет релевантные чанки для вопроса
   * @param {string} question - Вопрос пользователя
   * @param {number} topK - Количество чанков для поиска
   * @param {number} minScore - Минимальный score для включения
   * @param {object} rerankerOptions - Опции для reranker (опционально)
   * @returns {Promise<Array>} Массив релевантных чанков
   */
  async searchRelevantChunks(question, topK = 5, minScore = 0.3, rerankerOptions = null) {
    try {
      // Шаг 1: Первичный поиск (берем больше результатов, если используется reranker)
      const initialTopK = rerankerOptions ? Math.max(topK * 2, 10) : topK;
      const searchResults = await this.indexer.search(question, initialTopK, 0); // Не фильтруем по minScore на этом этапе

      // Шаг 2: Применяем reranker, если он настроен
      let finalResults = searchResults;
      let rerankStats = null;

      if (rerankerOptions && this.reranker) {
        // Временно обновляем конфигурацию reranker из опций
        const originalThreshold = this.reranker.relevanceThreshold;
        const originalStrategy = this.reranker.strategy;
        const originalTopK = this.reranker.topKAfterRerank;

        if (rerankerOptions.threshold !== undefined) {
          this.reranker.relevanceThreshold = rerankerOptions.threshold;
        }
        if (rerankerOptions.strategy !== undefined) {
          this.reranker.strategy = rerankerOptions.strategy;
        }
        if (rerankerOptions.topKAfterRerank !== undefined) {
          this.reranker.topKAfterRerank = rerankerOptions.topKAfterRerank || topK;
        }

        finalResults = await this.reranker.rerank(question, searchResults);
        rerankStats = this.reranker.getRerankStats(searchResults, finalResults);

        // Восстанавливаем оригинальную конфигурацию
        this.reranker.relevanceThreshold = originalThreshold;
        this.reranker.strategy = originalStrategy;
        this.reranker.topKAfterRerank = originalTopK;
      } else if (!rerankerOptions) {
        // Если reranker не используется, применяем простую фильтрацию по minScore
        finalResults = searchResults
          .filter(result => result.score >= minScore)
          .slice(0, topK);
      }

      return {
        chunks: finalResults.map(result => ({
          text: result.chunk.text,
          score: result.combinedScore || result.score,
          originalScore: result.score,
          rerankScore: result.rerankScore,
          isFallback: result.isFallback || false,
          fallbackReason: result.fallbackReason,
          metadata: result.chunk.metadata,
          document: result.document,
        })),
        rerankStats,
      };
    } catch (error) {
      console.error('Ошибка при поиске релевантных чанков:', error);
      return { chunks: [], rerankStats: null };
    }
  }

  /**
   * Выполняет RAG запрос: поиск чанков → reranking → объединение с вопросом → запрос к LLM
   * @param {string} question - Вопрос пользователя
   * @param {Function} llmCaller - Функция для вызова LLM (async (prompt, messages) => response)
   * @param {object} options - Опции
   * @param {number} options.topK - Количество чанков для поиска
   * @param {number} options.minScore - Минимальный score для включения
   * @param {Array} options.messages - История сообщений для контекста
   * @param {object} options.reranker - Опции reranker (опционально)
   * @param {string} options.reranker.strategy - Стратегия reranking (threshold, llm_score, hybrid)
   * @param {number} options.reranker.threshold - Порог релевантности для reranker
   * @param {number} options.reranker.topKAfterRerank - Количество результатов после reranking
   * @param {boolean} options.useReranker - Использовать ли reranker (по умолчанию false)
   * @returns {Promise<object>} Результат с ответом и метаданными
   */
  async queryWithRAG(question, llmCaller, options = {}) {
    const { 
      topK = 5, 
      minScore = 0.3, 
      messages = [],
      reranker: rerankerOptions = null,
      useReranker = false,
    } = options;

    // Шаг 1: Поиск релевантных чанков (с опциональным reranking)
    const searchResult = await this.searchRelevantChunks(
      question, 
      topK, 
      minScore,
      useReranker ? (rerankerOptions || {}) : null
    );
    const chunks = searchResult.chunks;
    
    // Проверяем, были ли отфильтрованы все чанки из-за строгого порога
    // Или использован fallback чанк
    const hasFallbackChunk = chunks.some(chunk => chunk.isFallback);
    const noRelevantChunks = (chunks.length === 0 && searchResult.rerankStats && searchResult.rerankStats.filteredOut > 0) 
      || hasFallbackChunk;

    // Шаг 2: Объединение с вопросом
    const ragPrompt = this.buildRAGPrompt(question, chunks, noRelevantChunks);

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
        originalScore: chunk.originalScore,
        rerankScore: chunk.rerankScore,
        source: chunk.document?.fileName || chunk.document?.id || 'Неизвестный источник',
      })),
      chunksCount: chunks.length,
      usedRAG: true,
      usedReranker: useReranker,
      rerankStats: searchResult.rerankStats,
      noRelevantChunks: noRelevantChunks,
      warning: noRelevantChunks 
        ? (hasFallbackChunk 
          ? chunks.find(c => c.fallbackReason)?.fallbackReason || 
            `Внимание: Все чанки были отфильтрованы из-за строгого порога релевантности (${rerankerOptions?.threshold || 'N/A'}). Использован лучший доступный чанк с низкой релевантностью. Рекомендуется снизить порог.`
          : `Внимание: Все чанки были отфильтрованы из-за строгого порога релевантности (${rerankerOptions?.threshold || 'N/A'}). Модель отвечает без контекста из документов. Рекомендуется снизить порог.`)
        : null,
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

  /**
   * Сравнивает качество ответа с фильтром reranker и без фильтра
   * @param {string} question - Вопрос пользователя
   * @param {Function} llmCaller - Функция для вызова LLM
   * @param {object} options - Опции
   * @returns {Promise<object>} Результат сравнения
   */
  async compareWithAndWithoutReranker(question, llmCaller, options = {}) {
    const { 
      messages = [], 
      topK = 5, 
      minScore = 0.3,
      reranker: rerankerOptions = {},
    } = options;

    // Выполняем оба запроса параллельно
    const [withRerankerResult, withoutRerankerResult] = await Promise.all([
      this.queryWithRAG(question, llmCaller, { 
        messages, 
        topK, 
        minScore,
        useReranker: true,
        reranker: rerankerOptions,
      }),
      this.queryWithRAG(question, llmCaller, { 
        messages, 
        topK, 
        minScore,
        useReranker: false,
      }),
    ]);

    return {
      question,
      withReranker: {
        answer: withRerankerResult.answer,
        chunks: withRerankerResult.chunks,
        chunksCount: withRerankerResult.chunksCount,
        rerankStats: withRerankerResult.rerankStats,
        metadata: withRerankerResult.metadata,
      },
      withoutReranker: {
        answer: withoutRerankerResult.answer,
        chunks: withoutRerankerResult.chunks,
        chunksCount: withoutRerankerResult.chunksCount,
        metadata: withoutRerankerResult.metadata,
      },
      comparison: {
        chunksDifference: withRerankerResult.chunksCount - withoutRerankerResult.chunksCount,
        avgScoreWithReranker: withRerankerResult.chunks.length > 0
          ? withRerankerResult.chunks.reduce((sum, c) => sum + (c.score || 0), 0) / withRerankerResult.chunks.length
          : 0,
        avgScoreWithoutReranker: withoutRerankerResult.chunks.length > 0
          ? withoutRerankerResult.chunks.reduce((sum, c) => sum + (c.score || 0), 0) / withoutRerankerResult.chunks.length
          : 0,
        tokensWithReranker: withRerankerResult.metadata.tokens || 0,
        tokensWithoutReranker: withoutRerankerResult.metadata.tokens || 0,
        tokenDifference: (withRerankerResult.metadata.tokens || 0) - (withoutRerankerResult.metadata.tokens || 0),
      },
    };
  }
}


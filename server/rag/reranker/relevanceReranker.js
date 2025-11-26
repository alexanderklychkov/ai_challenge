/**
 * Модуль для reranking и фильтрации релевантных результатов поиска
 */

/**
 * Стратегии reranking
 */
export const RerankStrategy = {
  /** Простая фильтрация по порогу score */
  THRESHOLD: 'threshold',
  /** Использование LLM для оценки релевантности */
  LLM_SCORE: 'llm_score',
  /** Комбинированный подход: порог + LLM для топ результатов */
  HYBRID: 'hybrid',
};

/**
 * Reranker для улучшения релевантности результатов поиска
 */
export class RelevanceReranker {
  /**
   * @param {object} config - Конфигурация
   * @param {string} config.strategy - Стратегия reranking (threshold, llm_score, hybrid)
   * @param {number} config.relevanceThreshold - Порог релевантности (0-1)
   * @param {Function} config.llmCaller - Функция для вызова LLM (для LLM-based reranking)
   * @param {number} config.topKAfterRerank - Количество результатов после reranking
   */
  constructor(config = {}) {
    this.strategy = config.strategy || RerankStrategy.THRESHOLD;
    this.relevanceThreshold = config.relevanceThreshold ?? 0.5;
    this.llmCaller = config.llmCaller || null;
    this.topKAfterRerank = config.topKAfterRerank || null;
  }

  /**
   * Выполняет reranking результатов поиска
   * @param {string} query - Исходный запрос
   * @param {Array<{chunk: object, score: number, document: object}>} searchResults - Результаты поиска
   * @returns {Promise<Array<{chunk: object, score: number, document: object, rerankScore?: number}>>}
   */
  async rerank(query, searchResults) {
    if (!searchResults || searchResults.length === 0) {
      return [];
    }

    switch (this.strategy) {
      case RerankStrategy.THRESHOLD:
        return this._rerankByThreshold(query, searchResults);
      
      case RerankStrategy.LLM_SCORE:
        return await this._rerankByLLM(query, searchResults);
      
      case RerankStrategy.HYBRID:
        return await this._rerankHybrid(query, searchResults);
      
      default:
        console.warn(`Неизвестная стратегия reranking: ${this.strategy}, используется threshold`);
        return this._rerankByThreshold(query, searchResults);
    }
  }

  /**
   * Простая фильтрация по порогу score
   * @private
   */
  _rerankByThreshold(query, searchResults) {
    const filtered = searchResults
      .filter(result => result.score >= this.relevanceThreshold)
      .sort((a, b) => b.score - a.score);

    // Fallback: если все отфильтрованы, возвращаем хотя бы один лучший чанк
    // Это предотвращает ситуацию, когда модель отвечает без контекста
    if (filtered.length === 0 && searchResults.length > 0) {
      const bestResult = searchResults
        .sort((a, b) => b.score - a.score)[0];
      // Помечаем, что это fallback (score ниже порога)
      return [{
        ...bestResult,
        isFallback: true,
        fallbackReason: `Все чанки отфильтрованы порогом ${this.relevanceThreshold}. Использован лучший доступный чанк (score: ${bestResult.score.toFixed(3)})`,
      }];
    }

    // Если указан topKAfterRerank, ограничиваем количество
    if (this.topKAfterRerank !== null) {
      return filtered.slice(0, this.topKAfterRerank);
    }

    return filtered;
  }

  /**
   * Reranking с использованием LLM для оценки релевантности
   * @private
   */
  async _rerankByLLM(query, searchResults) {
    if (!this.llmCaller) {
      console.warn('LLM caller не предоставлен, используется threshold фильтрация');
      return this._rerankByThreshold(query, searchResults);
    }

    // Оцениваем каждый результат через LLM
    const scoredResults = await Promise.all(
      searchResults.map(async (result) => {
        const relevanceScore = await this._scoreRelevanceWithLLM(query, result);
        return {
          ...result,
          rerankScore: relevanceScore,
          // Комбинируем оригинальный score и LLM score (можно настроить веса)
          combinedScore: (result.score * 0.3) + (relevanceScore * 0.7),
        };
      })
    );

    // Фильтруем по порогу и сортируем
    const filtered = scoredResults
      .filter(result => result.combinedScore >= this.relevanceThreshold)
      .sort((a, b) => b.combinedScore - a.combinedScore);

    if (this.topKAfterRerank !== null) {
      return filtered.slice(0, this.topKAfterRerank);
    }

    return filtered;
  }

  /**
   * Гибридный подход: сначала фильтр по порогу, затем LLM для топ результатов
   * @private
   */
  async _rerankHybrid(query, searchResults) {
    // Сначала применяем пороговую фильтрацию
    const thresholdFiltered = this._rerankByThreshold(query, searchResults);

    // Если LLM не доступен, возвращаем результаты пороговой фильтрации
    if (!this.llmCaller || thresholdFiltered.length === 0) {
      return thresholdFiltered;
    }

    // Берем топ результаты для более точной оценки через LLM
    const topResults = thresholdFiltered.slice(0, Math.min(10, thresholdFiltered.length));

    // Оцениваем через LLM
    const scoredResults = await Promise.all(
      topResults.map(async (result) => {
        const relevanceScore = await this._scoreRelevanceWithLLM(query, result);
        return {
          ...result,
          rerankScore: relevanceScore,
          combinedScore: (result.score * 0.4) + (relevanceScore * 0.6),
        };
      })
    );

    // Сортируем по combined score
    const sorted = scoredResults
      .filter(result => result.combinedScore >= this.relevanceThreshold)
      .sort((a, b) => b.combinedScore - a.combinedScore);

    // Добавляем остальные результаты (которые прошли порог, но не были оценены LLM)
    const remaining = thresholdFiltered
      .slice(topResults.length)
      .filter(result => result.score >= this.relevanceThreshold);

    const finalResults = [...sorted, ...remaining];

    if (this.topKAfterRerank !== null) {
      return finalResults.slice(0, this.topKAfterRerank);
    }

    return finalResults;
  }

  /**
   * Оценивает релевантность чанка запросу через LLM
   * @private
   * @param {string} query - Запрос
   * @param {object} result - Результат поиска
   * @returns {Promise<number>} Score релевантности (0-1)
   */
  async _scoreRelevanceWithLLM(query, result) {
    try {
      const prompt = `Оцени релевантность следующего текста запросу пользователя. Ответь только числом от 0 до 1, где:
- 0 = текст совершенно не релевантен запросу
- 0.5 = текст частично релевантен
- 1 = текст полностью релевантен запросу

Запрос: "${query}"

Текст для оценки:
"${result.chunk.text.substring(0, 500)}"

Только число (0-1):`;

      const response = await this.llmCaller(prompt, []);
      const text = response.text || response.content || response;
      
      // Извлекаем число из ответа
      const match = text.match(/0?\.?\d+/);
      if (match) {
        const score = parseFloat(match[0]);
        return Math.max(0, Math.min(1, score)); // Ограничиваем диапазон 0-1
      }

      // Если не удалось извлечь число, используем оригинальный score
      console.warn('Не удалось извлечь score из LLM ответа:', text);
      return result.score;
    } catch (error) {
      console.error('Ошибка при оценке релевантности через LLM:', error);
      // В случае ошибки возвращаем оригинальный score
      return result.score;
    }
  }

  /**
   * Статистика reranking
   * @param {Array} originalResults - Оригинальные результаты
   * @param {Array} rerankedResults - Результаты после reranking
   * @returns {object}
   */
  getRerankStats(originalResults, rerankedResults) {
    return {
      originalCount: originalResults.length,
      rerankedCount: rerankedResults.length,
      filteredOut: originalResults.length - rerankedResults.length,
      strategy: this.strategy,
      threshold: this.relevanceThreshold,
      avgOriginalScore: originalResults.length > 0
        ? originalResults.reduce((sum, r) => sum + r.score, 0) / originalResults.length
        : 0,
      avgRerankedScore: rerankedResults.length > 0
        ? rerankedResults.reduce((sum, r) => sum + (r.combinedScore || r.score), 0) / rerankedResults.length
        : 0,
    };
  }
}


/**
 * Генерирует эмбеддинги через LM Studio или другие OpenAI-совместимые API
 */
export class EmbeddingGenerator {
  /**
   * @param {object} config - Конфигурация
   * @param {string} config.apiUrl - URL API для эмбеддингов (по умолчанию LM Studio)
   * @param {string} config.apiKey - API ключ (опционально для LM Studio)
   * @param {string} config.model - Название модели для эмбеддингов
   */
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || process.env.LM_STUDIO_URL || 'http://localhost:1234/v1/embeddings';
    this.apiKey = config.apiKey || process.env.LM_STUDIO_API_KEY || 'lm-studio';
    this.model = config.model || process.env.LM_STUDIO_EMBEDDING_MODEL || 'all-MiniLM-L6-v2';
    this.dimension = config.dimension || 384; // Размерность для all-MiniLM-L6-v2
  }

  /**
   * Генерирует эмбеддинг для одного текста
   * @param {string} text - Текст для эмбеддинга
   * @returns {Promise<number[]>}
   */
  async generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Текст не может быть пустым');
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка API эмбеддингов: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      
      // OpenAI-совместимый формат
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const embedding = data.data[0].embedding;
        if (Array.isArray(embedding)) {
          return embedding;
        }
      }

      // Альтернативный формат
      if (Array.isArray(data.embedding)) {
        return data.embedding;
      }

      // Если data - это массив напрямую
      if (Array.isArray(data)) {
        return data;
      }

      throw new Error('Неожиданный формат ответа от API эмбеддингов');
    } catch (error) {
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        throw new Error(
          `Не удалось подключиться к LM Studio. Убедитесь, что LM Studio запущен и доступен по адресу ${this.apiUrl}`
        );
      }
      throw error;
    }
  }

  /**
   * Генерирует эмбеддинги для массива текстов (батчинг)
   * @param {string[]} texts - Массив текстов
   * @param {number} batchSize - Размер батча
   * @param {Function} onProgress - Callback для отслеживания прогресса
   * @returns {Promise<number[][]>}
   */
  async generateEmbeddings(texts, batchSize = 10, onProgress = null) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    const embeddings = [];
    const total = texts.length;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        // Пытаемся отправить батч
        const batchEmbeddings = await this.generateBatchEmbeddings(batch);
        embeddings.push(...batchEmbeddings);
      } catch (error) {
        // Если батч не поддерживается, обрабатываем по одному
        console.warn('Батч не поддерживается, обрабатываем по одному:', error.message);
        for (const text of batch) {
          const embedding = await this.generateEmbedding(text);
          embeddings.push(embedding);
        }
      }

      if (onProgress) {
        onProgress(Math.min(i + batchSize, total), total);
      }
    }

    return embeddings;
  }

  /**
   * Генерирует эмбеддинги для батча текстов
   * @param {string[]} texts - Массив текстов
   * @returns {Promise<number[][]>}
   */
  async generateBatchEmbeddings(texts) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка API эмбеддингов: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      
      if (data.data && Array.isArray(data.data)) {
        return data.data.map(item => item.embedding);
      }

      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data;
      }

      throw new Error('Неожиданный формат ответа от API эмбеддингов');
    } catch (error) {
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        throw new Error(
          `Не удалось подключиться к LM Studio. Убедитесь, что LM Studio запущен и доступен по адресу ${this.apiUrl}`
        );
      }
      throw error;
    }
  }

  /**
   * Проверяет доступность API
   * @returns {Promise<boolean>}
   */
  async checkAvailability() {
    try {
      await this.generateEmbedding('test');
      return true;
    } catch (error) {
      console.error('API эмбеддингов недоступно:', error.message);
      return false;
    }
  }
}



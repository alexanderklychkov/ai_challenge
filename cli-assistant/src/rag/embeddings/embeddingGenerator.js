/**
 * Генерирует эмбеддинги через различные провайдеры
 * Поддерживает: Hugging Face, LM Studio, кастомные OpenAI-совместимые API, DeepSeek, OpenAI
 * Приоритет: CUSTOM_EMBEDDING_URL > HUGGINGFACE_API_KEY > LM_STUDIO_URL > DEEPSEEK_API_KEY > OPENAI_API_KEY
 */

export class EmbeddingGenerator {
  constructor(config = {}) {
    // Определяем провайдера по переменным окружения
    // Приоритет: Кастомный URL > Hugging Face > LM Studio > DeepSeek > OpenAI
    
    if (process.env.CUSTOM_EMBEDDING_URL) {
      // Используем кастомный OpenAI-совместимый API
      this.provider = 'custom';
      this.apiUrl = config.apiUrl || process.env.CUSTOM_EMBEDDING_URL;
      this.apiKey = config.apiKey || process.env.CUSTOM_EMBEDDING_API_KEY || '';
      this.model = config.model || process.env.CUSTOM_EMBEDDING_MODEL || 'text-embedding-ada-002';
      this.dimension = config.dimension || 1536;
    } else if (process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN) {
      // Используем Hugging Face Inference API
      // Поддерживаем оба варианта: HUGGINGFACE_API_KEY и HF_TOKEN (они эквивалентны)
      this.provider = 'huggingface';
      const defaultModel = process.env.HUGGINGFACE_EMBEDDING_MODEL || 'nomic-ai/nomic-embed-text-v1.5';
      this.apiUrl = config.apiUrl || `https://api-inference.huggingface.co/pipeline/feature-extraction/${defaultModel}`;
      this.apiKey = config.apiKey || process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
      this.model = config.model || defaultModel;
      this.dimension = config.dimension || 768;
    } else if (process.env.LM_STUDIO_URL) {
      // Используем LM Studio или другой локальный сервис
      this.provider = 'lm-studio';
      this.apiUrl = config.apiUrl || process.env.LM_STUDIO_URL;
      this.apiKey = config.apiKey || process.env.LM_STUDIO_API_KEY || 'lm-studio';
      this.model = config.model || process.env.LM_STUDIO_EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5';
      this.dimension = config.dimension || 768;
    } else if (process.env.DEEPSEEK_API_KEY) {
      // Используем DeepSeek embeddings
      this.provider = 'deepseek';
      this.apiUrl = config.apiUrl || 'https://api.deepseek.com/v1/embeddings';
      this.apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY;
      this.model = config.model || process.env.DEEPSEEK_EMBEDDING_MODEL || 'deepseek-embedding';
      this.dimension = config.dimension || 1536;
    } else if (process.env.OPENAI_API_KEY) {
      // Используем OpenAI embeddings
      this.provider = 'openai';
      this.apiUrl = config.apiUrl || 'https://api.openai.com/v1/embeddings';
      this.apiKey = config.apiKey || process.env.OPENAI_API_KEY;
      this.model = config.model || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
      this.dimension = config.dimension || 1536;
    } else {
      throw new Error('Не найден API ключ для эмбеддингов. Установите один из: CUSTOM_EMBEDDING_URL, HUGGINGFACE_API_KEY, LM_STUDIO_URL, DEEPSEEK_API_KEY или OPENAI_API_KEY');
    }
  }

  async generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Текст не может быть пустым');
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      // Добавляем Authorization в зависимости от провайдера
      if (this.provider === 'huggingface') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      } else if (this.provider === 'deepseek' || this.provider === 'openai' || this.provider === 'custom') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      } else if (this.apiKey && this.apiKey !== 'lm-studio') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      let requestBody;
      
      // Hugging Face использует другой формат
      if (this.provider === 'huggingface') {
        requestBody = JSON.stringify({
          inputs: text,
        });
      } else {
        // OpenAI-совместимый формат
        requestBody = JSON.stringify({
          model: this.model,
          input: text,
        });
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: requestBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка API эмбеддингов: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      
      // Hugging Face возвращает массив напрямую
      if (this.provider === 'huggingface') {
        if (Array.isArray(data) && Array.isArray(data[0])) {
          // Если массив массивов, берем первый
          return data[0];
        }
        if (Array.isArray(data)) {
          return data;
        }
      }
      
      // OpenAI-совместимый формат
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const embedding = data.data[0].embedding;
        if (Array.isArray(embedding)) {
          return embedding;
        }
      }

      if (Array.isArray(data.embedding)) {
        return data.embedding;
      }

      if (Array.isArray(data)) {
        return data;
      }

      throw new Error('Неожиданный формат ответа от API эмбеддингов');
    } catch (error) {
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        const serviceNames = {
          'huggingface': 'Hugging Face',
          'custom': 'Кастомный API',
          'deepseek': 'DeepSeek',
          'openai': 'OpenAI',
          'lm-studio': 'LM Studio'
        };
        const serviceName = serviceNames[this.provider] || 'сервису эмбеддингов';
        throw new Error(
          `Не удалось подключиться к ${serviceName}. Убедитесь, что сервис доступен по адресу ${this.apiUrl}`
        );
      }
      throw error;
    }
  }

  async generateEmbeddings(texts, batchSize = 10, onProgress = null) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    const embeddings = [];
    const total = texts.length;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const batchEmbeddings = await this.generateBatchEmbeddings(batch);
        embeddings.push(...batchEmbeddings);
      } catch (error) {
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

  async generateBatchEmbeddings(texts) {
    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      // Добавляем Authorization в зависимости от провайдера
      if (this.provider === 'huggingface') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      } else if (this.provider === 'deepseek' || this.provider === 'openai' || this.provider === 'custom') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      } else if (this.apiKey && this.apiKey !== 'lm-studio') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      let requestBody;
      
      // Hugging Face использует другой формат
      if (this.provider === 'huggingface') {
        requestBody = JSON.stringify({
          inputs: texts,
        });
      } else {
        // OpenAI-совместимый формат
        requestBody = JSON.stringify({
          model: this.model,
          input: texts,
        });
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: requestBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка API эмбеддингов: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json();
      
      // Hugging Face возвращает массив массивов напрямую
      if (this.provider === 'huggingface') {
        if (Array.isArray(data) && Array.isArray(data[0])) {
          return data;
        }
        if (Array.isArray(data)) {
          return [data]; // Обертываем в массив если один элемент
        }
      }
      
      // OpenAI-совместимый формат
      if (data.data && Array.isArray(data.data)) {
        return data.data.map(item => item.embedding || item);
      }

      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data;
      }

      throw new Error('Неожиданный формат ответа от API эмбеддингов');
    } catch (error) {
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        const serviceNames = {
          'huggingface': 'Hugging Face',
          'custom': 'Кастомный API',
          'deepseek': 'DeepSeek',
          'openai': 'OpenAI',
          'lm-studio': 'LM Studio'
        };
        const serviceName = serviceNames[this.provider] || 'сервису эмбеддингов';
        throw new Error(
          `Не удалось подключиться к ${serviceName}. Убедитесь, что сервис доступен по адресу ${this.apiUrl}`
        );
      }
      throw error;
    }
  }

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




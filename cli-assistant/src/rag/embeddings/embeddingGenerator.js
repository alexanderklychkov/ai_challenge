/**
 * Генерирует эмбеддинги через различные провайдеры
 * Поддерживает: Hugging Face, LM Studio, кастомные OpenAI-совместимые API, DeepSeek, OpenAI
 * Приоритет: CUSTOM_EMBEDDING_URL > HUGGINGFACE_API_KEY > LM_STUDIO_URL > DEEPSEEK_API_KEY > OPENAI_API_KEY
 */

import { HfInference } from '@huggingface/inference';

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
      // Используем Hugging Face Inference Providers API
      // Документация: https://huggingface.co/docs/inference-providers/index
      this.provider = 'huggingface';
      const apiKey = config.apiKey || process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
      // Используем модель, которая точно доступна через Inference Providers
      // sentence-transformers/all-MiniLM-L6-v2 - популярная модель, доступная через hf-inference
      const defaultModel = config.model || process.env.HUGGINGFACE_EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2';
      
      // Инициализируем InferenceClient из @huggingface/inference
      // Согласно документации: https://huggingface.co/docs/inference-providers/index
      this.hfClient = new HfInference(apiKey);
      this.model = defaultModel;
      this.dimension = config.dimension || 384; // all-MiniLM-L6-v2 имеет размерность 384
      
      // Опционально можно указать провайдера явно
      // Например: "hf-inference", "nebius", "sambanova" и т.д.
      // Если не указан, используется "auto" (автоматический выбор)
      // Для надежности можно использовать "hf-inference" явно
      this.hfProvider = config.provider || process.env.HUGGINGFACE_PROVIDER || 'hf-inference';
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
      // Используем Hugging Face InferenceClient для feature extraction
      if (this.provider === 'huggingface') {
        try {
          // Используем featureExtraction метод из InferenceClient
          // Согласно документации: https://huggingface.co/docs/inference-providers/index
          const params = {
            model: this.model,
            inputs: text,
          };
          
          // Опционально можно указать провайдера явно (если не 'auto')
          if (this.hfProvider && this.hfProvider !== 'auto') {
            params.provider = this.hfProvider;
          }
          
          const result = await this.hfClient.featureExtraction(params);

          // Результат может быть массивом чисел (для одного текста) или массивом массивов (для батча)
          if (Array.isArray(result)) {
            // Если это массив массивов (batch response), берем первый элемент
            if (result.length > 0 && Array.isArray(result[0])) {
              return result[0];
            }
            // Если это массив чисел (single response)
            if (result.length > 0 && typeof result[0] === 'number') {
              return result;
            }
          }

          throw new Error('Неожиданный формат ответа от Hugging Face API');
        } catch (error) {
          // Улучшаем сообщения об ошибках
          const errorMsg = error.message || String(error);
          
          if (errorMsg.includes('503') || errorMsg.includes('loading')) {
            throw new Error('Модель загружается. Попробуйте повторить запрос через несколько секунд.');
          }
          if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
            throw new Error('Неверный токен Hugging Face. Проверьте HUGGINGFACE_API_KEY или HF_TOKEN.');
          }
          if (errorMsg.includes('404') || errorMsg.includes('not found')) {
            throw new Error(`Модель ${this.model} не найдена. Проверьте название модели.`);
          }
          if (errorMsg.includes('No Inference Provider available') || errorMsg.includes('inference provider')) {
            throw new Error(
              `Модель ${this.model} не доступна через Inference Providers. ` +
              `Попробуйте использовать другую модель, например: sentence-transformers/all-MiniLM-L6-v2, ` +
              `intfloat/multilingual-e5-base, или BAAI/bge-small-en-v1.5. ` +
              `Также можно указать другой провайдер через переменную HUGGINGFACE_PROVIDER.`
            );
          }
          throw error;
        }
      }

      // Для остальных провайдеров используем старую логику
      const headers = {
        'Content-Type': 'application/json',
      };

      if (this.provider === 'deepseek' || this.provider === 'openai' || this.provider === 'custom') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      } else if (this.apiKey && this.apiKey !== 'lm-studio') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const requestBody = JSON.stringify({
        model: this.model,
        input: text,
      });

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
        const url = this.provider === 'huggingface' ? 'Hugging Face Inference Providers' : this.apiUrl;
        throw new Error(
          `Не удалось подключиться к ${serviceName}. ${this.provider === 'huggingface' ? 'Проверьте токен и доступность сервиса.' : `Убедитесь, что сервис доступен по адресу ${url}`}`
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
      // Используем Hugging Face InferenceClient для feature extraction
      if (this.provider === 'huggingface') {
        try {
          // Используем featureExtraction метод из InferenceClient для батча
          // Согласно документации: https://huggingface.co/docs/inference-providers/index
          const params = {
            model: this.model,
            inputs: texts, // Передаем массив текстов
          };
          
          // Опционально можно указать провайдера явно (если не 'auto')
          if (this.hfProvider && this.hfProvider !== 'auto') {
            params.provider = this.hfProvider;
          }
          
          const result = await this.hfClient.featureExtraction(params);

          // Результат должен быть массивом массивов для батча
          if (Array.isArray(result)) {
            // Если это массив массивов (batch response)
            if (result.length > 0 && Array.isArray(result[0])) {
              return result;
            }
            // Если это один массив (single response), оборачиваем в массив
            if (result.length > 0 && typeof result[0] === 'number') {
              return [result];
            }
          }

          throw new Error('Неожиданный формат ответа от Hugging Face API');
        } catch (error) {
          // Улучшаем сообщения об ошибках
          const errorMsg = error.message || String(error);
          
          if (errorMsg.includes('503') || errorMsg.includes('loading')) {
            throw new Error('Модель загружается. Попробуйте повторить запрос через несколько секунд.');
          }
          if (errorMsg.includes('401') || errorMsg.includes('unauthorized')) {
            throw new Error('Неверный токен Hugging Face. Проверьте HUGGINGFACE_API_KEY или HF_TOKEN.');
          }
          if (errorMsg.includes('404') || errorMsg.includes('not found')) {
            throw new Error(`Модель ${this.model} не найдена. Проверьте название модели.`);
          }
          if (errorMsg.includes('No Inference Provider available') || errorMsg.includes('inference provider')) {
            throw new Error(
              `Модель ${this.model} не доступна через Inference Providers. ` +
              `Попробуйте использовать другую модель, например: sentence-transformers/all-MiniLM-L6-v2, ` +
              `intfloat/multilingual-e5-base, или BAAI/bge-small-en-v1.5. ` +
              `Также можно указать другой провайдер через переменную HUGGINGFACE_PROVIDER.`
            );
          }
          throw error;
        }
      }

      // Для остальных провайдеров используем старую логику
      const headers = {
        'Content-Type': 'application/json',
      };

      if (this.provider === 'deepseek' || this.provider === 'openai' || this.provider === 'custom') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      } else if (this.apiKey && this.apiKey !== 'lm-studio') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const requestBody = JSON.stringify({
        model: this.model,
        input: texts,
      });

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
        const url = this.provider === 'huggingface' ? 'Hugging Face Inference Providers' : this.apiUrl;
        throw new Error(
          `Не удалось подключиться к ${serviceName}. ${this.provider === 'huggingface' ? 'Проверьте токен и доступность сервиса.' : `Убедитесь, что сервис доступен по адресу ${url}`}`
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




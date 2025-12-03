/**
 * Генерирует эмбеддинги через Hugging Face Inference Providers API
 * Документация: https://huggingface.co/docs/inference-providers/index
 */

import { HfInference } from '@huggingface/inference';

export class EmbeddingGenerator {
  constructor(config = {}) {
    // Используем Hugging Face Inference Providers API
    const apiKey = config.apiKey || process.env.HF_TOKEN;
    
    if (!apiKey) {
      throw new Error('Не найден API ключ для эмбеддингов. Установите переменную окружения HF_TOKEN');
    }
    
    this.provider = 'huggingface';
    // Используем модель, которая точно доступна через Inference Providers
    // sentence-transformers/all-MiniLM-L6-v2 - популярная модель, доступная через hf-inference
    const defaultModel = config.model || 'sentence-transformers/all-MiniLM-L6-v2';
    
    // Инициализируем InferenceClient из @huggingface/inference
    // Согласно документации: https://huggingface.co/docs/inference-providers/index
    this.hfClient = new HfInference(apiKey);
    this.model = defaultModel;
    this.dimension = config.dimension || 384; // all-MiniLM-L6-v2 имеет размерность 384
  }

  async generateEmbedding(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Текст не может быть пустым');
    }

    try {
      // Используем Hugging Face InferenceClient для feature extraction
      // Используем featureExtraction метод из InferenceClient
      // Согласно документации: https://huggingface.co/docs/inference-providers/index
      const params = {
        model: this.model,
        inputs: text,
      };
      
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
        throw new Error('Неверный токен Hugging Face. Проверьте HF_TOKEN.');
      }
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        throw new Error(`Модель ${this.model} не найдена. Проверьте название модели.`);
      }
      if (errorMsg.includes('No Inference Provider available') || errorMsg.includes('inference provider')) {
        throw new Error(
          `Модель ${this.model} не доступна через Inference Providers. ` +
          `Попробуйте использовать другую модель, например: sentence-transformers/all-MiniLM-L6-v2, ` +
          `intfloat/multilingual-e5-base, или BAAI/bge-small-en-v1.5.`
        );
      }
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        throw new Error('Не удалось подключиться к Hugging Face Inference Providers. Проверьте токен и доступность сервиса.');
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
      // Используем featureExtraction метод из InferenceClient для батча
      // Согласно документации: https://huggingface.co/docs/inference-providers/index
      const params = {
        model: this.model,
        inputs: texts, // Передаем массив текстов
      };
      
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
        throw new Error('Неверный токен Hugging Face. Проверьте HF_TOKEN.');
      }
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        throw new Error(`Модель ${this.model} не найдена. Проверьте название модели.`);
      }
      if (errorMsg.includes('No Inference Provider available') || errorMsg.includes('inference provider')) {
        throw new Error(
          `Модель ${this.model} не доступна через Inference Providers. ` +
          `Попробуйте использовать другую модель, например: sentence-transformers/all-MiniLM-L6-v2, ` +
          `intfloat/multilingual-e5-base, или BAAI/bge-small-en-v1.5.`
        );
      }
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        throw new Error('Не удалось подключиться к Hugging Face Inference Providers. Проверьте токен и доступность сервиса.');
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




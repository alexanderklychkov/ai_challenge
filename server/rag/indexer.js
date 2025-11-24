import { DocumentProcessor } from './processors/documentProcessor.js';
import { TextChunker } from './chunkers/textChunker.js';
import { EmbeddingGenerator } from './embeddings/embeddingGenerator.js';
import { DocumentIndex } from './index/documentIndex.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * Основной пайплайн для индексации документов
 */
export class DocumentIndexer {
  /**
   * @param {object} config - Конфигурация
   * @param {string} config.indexPath - Путь к файлу индекса
   * @param {object} config.embeddingConfig - Конфигурация для генерации эмбеддингов
   * @param {object} config.chunkOptions - Опции для разбивки текста
   */
  constructor(config = {}) {
    this.index = new DocumentIndex(config.indexPath);
    this.embeddingGenerator = new EmbeddingGenerator(config.embeddingConfig || {});
    this.chunkOptions = config.chunkOptions || {
      chunkSize: 1000,
      chunkOverlap: 200,
    };
  }

  /**
   * Инициализирует индекс (загружает существующий или создает новый)
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.index.load();
  }

  /**
   * Индексирует файл
   * @param {string} filePath - Путь к файлу
   * @param {Function} onProgress - Callback для отслеживания прогресса
   * @returns {Promise<{documentId: string, chunksCount: number}>}
   */
  async indexFile(filePath, onProgress = null) {
    try {
      // Проверяем существование файла
      await fs.access(filePath);

      if (onProgress) onProgress({ stage: 'processing', message: 'Обработка файла...' });

      // Обрабатываем файл
      const document = await DocumentProcessor.processFile(filePath);

      if (onProgress) onProgress({ stage: 'chunking', message: 'Разбивка на чанки...' });

      // Разбиваем на чанки
      const chunks = TextChunker.chunkDocument(document, this.chunkOptions);

      if (chunks.length === 0) {
        throw new Error('Не удалось создать чанки из документа');
      }

      if (onProgress) {
        onProgress({ 
          stage: 'embedding', 
          message: `Генерация эмбеддингов для ${chunks.length} чанков...`,
          progress: 0,
          total: chunks.length,
        });
      }

      // Генерируем эмбеддинги
      const texts = chunks.map(chunk => chunk.text);
      const embeddings = await this.embeddingGenerator.generateEmbeddings(
        texts,
        10, // batch size
        (current, total) => {
          if (onProgress) {
            onProgress({
              stage: 'embedding',
              message: `Генерация эмбеддингов: ${current}/${total}`,
              progress: current,
              total,
            });
          }
        }
      );

      // Сохраняем информацию о модели эмбеддингов
      if (embeddings.length > 0) {
        this.index.setEmbeddingModel(
          this.embeddingGenerator.model,
          embeddings[0].length
        );
      }

      // Добавляем документ в индекс
      const documentId = this.index.addDocument(document);

      // Добавляем чанки в индекс
      chunks.forEach((chunk, index) => {
        this.index.addChunk(
          {
            text: chunk.text,
            metadata: chunk.metadata,
            embedding: embeddings[index],
          },
          documentId
        );
      });

      if (onProgress) onProgress({ stage: 'saving', message: 'Сохранение индекса...' });

      // Сохраняем индекс
      await this.index.save();

      return {
        documentId,
        chunksCount: chunks.length,
        fileName: path.basename(filePath),
      };
    } catch (error) {
      throw new Error(`Ошибка при индексации файла ${filePath}: ${error.message}`);
    }
  }

  /**
   * Индексирует директорию рекурсивно
   * @param {string} dirPath - Путь к директории
   * @param {string[]} ignorePatterns - Паттерны для игнорирования
   * @param {Function} onProgress - Callback для отслеживания прогресса
   * @returns {Promise<{totalDocuments: number, totalChunks: number}>}
   */
  async indexDirectory(dirPath, ignorePatterns = ['.git', 'node_modules', 'dist', '.next', 'build'], onProgress = null) {
    try {
      if (onProgress) onProgress({ stage: 'scanning', message: 'Сканирование директории...' });

      // Обрабатываем все файлы в директории
      const documents = await DocumentProcessor.processDirectory(dirPath, ignorePatterns);

      if (documents.length === 0) {
        throw new Error('Не найдено документов для индексации');
      }

      let totalChunks = 0;
      const results = [];

      for (let i = 0; i < documents.length; i++) {
        const document = documents[i];
        
        if (onProgress) {
          onProgress({
            stage: 'indexing',
            message: `Индексация документа ${i + 1}/${documents.length}: ${document.metadata.fileName}`,
            current: i + 1,
            total: documents.length,
          });
        }

        // Разбиваем на чанки
        const chunks = TextChunker.chunkDocument(document, this.chunkOptions);

        if (chunks.length === 0) {
          console.warn(`Пропущен документ ${document.metadata.fileName}: нет чанков`);
          continue;
        }

        // Генерируем эмбеддинги
        const texts = chunks.map(chunk => chunk.text);
        const embeddings = await this.embeddingGenerator.generateEmbeddings(
          texts,
          10,
          (current, total) => {
            if (onProgress) {
              onProgress({
                stage: 'embedding',
                message: `Эмбеддинги для ${document.metadata.fileName}: ${current}/${total}`,
                progress: current,
                total,
              });
            }
          }
        );

        // Сохраняем информацию о модели эмбеддингов
        if (embeddings.length > 0 && !this.index.index.metadata.embeddingModel) {
          this.index.setEmbeddingModel(
            this.embeddingGenerator.model,
            embeddings[0].length
          );
        }

        // Добавляем документ и чанки
        const documentId = this.index.addDocument(document);
        chunks.forEach((chunk, index) => {
          this.index.addChunk(
            {
              text: chunk.text,
              metadata: chunk.metadata,
              embedding: embeddings[index],
            },
            documentId
        );
        });

        totalChunks += chunks.length;
        results.push({
          documentId,
          fileName: document.metadata.fileName,
          chunksCount: chunks.length,
        });
      }

      if (onProgress) onProgress({ stage: 'saving', message: 'Сохранение индекса...' });

      // Сохраняем индекс
      await this.index.save();

      return {
        totalDocuments: results.length,
        totalChunks,
        results,
      };
    } catch (error) {
      throw new Error(`Ошибка при индексации директории ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Индексирует текст напрямую
   * @param {string} text - Текст для индексации
   * @param {object} metadata - Метаданные
   * @param {Function} onProgress - Callback для отслеживания прогресса
   * @returns {Promise<{documentId: string, chunksCount: number}>}
   */
  async indexText(text, metadata = {}, onProgress = null) {
    try {
      if (onProgress) onProgress({ stage: 'processing', message: 'Обработка текста...' });

      const document = DocumentProcessor.processTextDirect(text, metadata);

      if (onProgress) onProgress({ stage: 'chunking', message: 'Разбивка на чанки...' });

      const chunks = TextChunker.chunkDocument(document, this.chunkOptions);

      if (chunks.length === 0) {
        throw new Error('Не удалось создать чанки из текста');
      }

      if (onProgress) {
        onProgress({
          stage: 'embedding',
          message: `Генерация эмбеддингов для ${chunks.length} чанков...`,
          progress: 0,
          total: chunks.length,
        });
      }

      const texts = chunks.map(chunk => chunk.text);
      const embeddings = await this.embeddingGenerator.generateEmbeddings(
        texts,
        10,
        (current, total) => {
          if (onProgress) {
            onProgress({
              stage: 'embedding',
              message: `Генерация эмбеддингов: ${current}/${total}`,
              progress: current,
              total,
            });
          }
        }
      );

      if (embeddings.length > 0) {
        this.index.setEmbeddingModel(
          this.embeddingGenerator.model,
          embeddings[0].length
        );
      }

      const documentId = this.index.addDocument(document);

      chunks.forEach((chunk, index) => {
        this.index.addChunk(
          {
            text: chunk.text,
            metadata: chunk.metadata,
            embedding: embeddings[index],
          },
          documentId
        );
      });

      if (onProgress) onProgress({ stage: 'saving', message: 'Сохранение индекса...' });

      await this.index.save();

      return {
        documentId,
        chunksCount: chunks.length,
      };
    } catch (error) {
      throw new Error(`Ошибка при индексации текста: ${error.message}`);
    }
  }

  /**
   * Ищет похожие документы по текстовому запросу
   * @param {string} query - Текстовый запрос
   * @param {number} topK - Количество результатов
   * @param {number} minScore - Минимальный score
   * @returns {Promise<Array<{chunk: object, score: number, document: object}>>}
   */
  async search(query, topK = 5, minScore = 0.5) {
    // Генерируем эмбеддинг для запроса
    const queryEmbedding = await this.embeddingGenerator.generateEmbedding(query);

    // Ищем похожие чанки
    const results = this.index.searchSimilar(queryEmbedding, topK, minScore);

    // Добавляем информацию о документах
    return results.map(result => ({
      ...result,
      document: this.index.getDocument(result.chunk.documentId),
    }));
  }

  /**
   * Проверяет доступность API эмбеддингов
   * @returns {Promise<boolean>}
   */
  async checkEmbeddingAvailability() {
    return await this.embeddingGenerator.checkAvailability();
  }

  /**
   * Получает статистику индекса
   * @returns {object}
   */
  getStats() {
    return {
      totalDocuments: this.index.index.metadata.totalDocuments,
      totalChunks: this.index.index.metadata.totalChunks,
      embeddingModel: this.index.index.metadata.embeddingModel,
      embeddingDimension: this.index.index.metadata.embeddingDimension,
      createdAt: this.index.index.createdAt,
      updatedAt: this.index.index.updatedAt,
    };
  }
}



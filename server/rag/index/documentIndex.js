import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Управляет сохранением и загрузкой индекса документов
 */
export class DocumentIndex {
  /**
   * @param {string} indexPath - Путь к файлу индекса
   */
  constructor(indexPath = null) {
    // Путь относительно server/rag/index/
    const defaultPath = path.join(__dirname, '../../data/document-index.json');
    this.indexPath = indexPath || defaultPath;
    this.index = {
      version: '1.0',
      createdAt: null,
      updatedAt: null,
      documents: [],
      chunks: [],
      metadata: {
        totalDocuments: 0,
        totalChunks: 0,
        embeddingModel: null,
        embeddingDimension: null,
      },
    };
  }

  /**
   * Загружает индекс из файла
   * @returns {Promise<DocumentIndex>}
   */
  async load() {
    try {
      // Создаем директорию, если её нет
      const dir = path.dirname(this.indexPath);
      await fs.mkdir(dir, { recursive: true });

      // Пытаемся загрузить существующий индекс
      try {
        const data = await fs.readFile(this.indexPath, 'utf-8');
        // Проверяем, что файл не пустой
        if (!data || data.trim().length === 0) {
          console.log('Индекс пустой, создан новый');
          return this;
        }
        this.index = JSON.parse(data);
        // Проверяем валидность структуры индекса
        if (!this.index.documents || !this.index.chunks) {
          console.log('Индекс имеет невалидную структуру, создан новый');
          this.index = {
            version: '1.0',
            createdAt: null,
            updatedAt: null,
            documents: [],
            chunks: [],
            metadata: {
              totalDocuments: 0,
              totalChunks: 0,
              embeddingModel: null,
              embeddingDimension: null,
            },
          };
          return this;
        }
        console.log(`Индекс загружен: ${this.index.chunks.length} чанков из ${this.index.documents.length} документов`);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log('Индекс не найден, создан новый');
        } else if (error instanceof SyntaxError) {
          // Ошибка парсинга JSON - файл поврежден
          console.log('Индекс содержит невалидный JSON, создан новый');
        } else {
          throw error;
        }
      }
      
      return this;
    } catch (error) {
      throw new Error(`Ошибка при загрузке индекса: ${error.message}`);
    }
  }

  /**
   * Сохраняет индекс в файл
   * @returns {Promise<void>}
   */
  async save() {
    try {
      this.index.updatedAt = new Date().toISOString();
      if (!this.index.createdAt) {
        this.index.createdAt = this.index.updatedAt;
      }

      // Обновляем метаданные
      this.index.metadata.totalDocuments = this.index.documents.length;
      this.index.metadata.totalChunks = this.index.chunks.length;

      const dir = path.dirname(this.indexPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
      console.log(`Индекс сохранен: ${this.index.chunks.length} чанков из ${this.index.documents.length} документов`);
    } catch (error) {
      throw new Error(`Ошибка при сохранении индекса: ${error.message}`);
    }
  }

  /**
   * Добавляет документ в индекс
   * @param {object} document - Документ с метаданными
   * @returns {string} - ID документа
   */
  addDocument(document) {
    const docId = this.generateId();
    const docEntry = {
      id: docId,
      ...document.metadata,
      addedAt: new Date().toISOString(),
    };
    
    this.index.documents.push(docEntry);
    return docId;
  }

  /**
   * Добавляет чанк в индекс
   * @param {object} chunk - Чанк с текстом, метаданными и эмбеддингом
   * @param {string} documentId - ID документа
   * @returns {string} - ID чанка
   */
  addChunk(chunk, documentId) {
    const chunkId = this.generateId();
    const chunkEntry = {
      id: chunkId,
      documentId,
      text: chunk.text,
      embedding: chunk.embedding,
      metadata: chunk.metadata,
      addedAt: new Date().toISOString(),
    };
    
    this.index.chunks.push(chunkEntry);
    return chunkId;
  }

  /**
   * Обновляет метаданные модели эмбеддингов
   * @param {string} model - Название модели
   * @param {number} dimension - Размерность эмбеддингов
   */
  setEmbeddingModel(model, dimension) {
    this.index.metadata.embeddingModel = model;
    this.index.metadata.embeddingDimension = dimension;
  }

  /**
   * Получает все чанки
   * @returns {Array}
   */
  getAllChunks() {
    return this.index.chunks;
  }

  /**
   * Получает все документы
   * @returns {Array}
   */
  getAllDocuments() {
    return this.index.documents;
  }

  /**
   * Получает чанки по ID документа
   * @param {string} documentId - ID документа
   * @returns {Array}
   */
  getChunksByDocument(documentId) {
    return this.index.chunks.filter(chunk => chunk.documentId === documentId);
  }

  /**
   * Получает документ по ID
   * @param {string} documentId - ID документа
   * @returns {object|null}
   */
  getDocument(documentId) {
    return this.index.documents.find(doc => doc.id === documentId) || null;
  }

  /**
   * Удаляет документ и все его чанки
   * @param {string} documentId - ID документа
   * @returns {boolean}
   */
  removeDocument(documentId) {
    const docIndex = this.index.documents.findIndex(doc => doc.id === documentId);
    if (docIndex === -1) {
      return false;
    }

    this.index.documents.splice(docIndex, 1);
    this.index.chunks = this.index.chunks.filter(chunk => chunk.documentId !== documentId);
    return true;
  }

  /**
   * Очищает весь индекс
   */
  clear() {
    this.index = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: [],
      chunks: [],
      metadata: {
        totalDocuments: 0,
        totalChunks: 0,
        embeddingModel: null,
        embeddingDimension: null,
      },
    };
  }

  /**
   * Генерирует уникальный ID
   * @returns {string}
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Вычисляет косинусное сходство между двумя векторами
   * @param {number[]} vec1 - Первый вектор
   * @param {number[]} vec2 - Второй вектор
   * @returns {number}
   */
  static cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('Векторы должны иметь одинаковую размерность');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Ищет наиболее похожие чанки по эмбеддингу
   * @param {number[]} queryEmbedding - Эмбеддинг запроса
   * @param {number} topK - Количество результатов
   * @param {number} minScore - Минимальный score для включения
   * @returns {Array<{chunk: object, score: number}>}
   */
  searchSimilar(queryEmbedding, topK = 5, minScore = 0) {
    const results = this.index.chunks
      .map(chunk => ({
        chunk,
        score: DocumentIndex.cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .filter(result => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }
}

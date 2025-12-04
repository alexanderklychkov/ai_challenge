/**
 * Индексатор документов для CLI ассистента
 * Адаптированная версия из основного проекта
 */

import { DocumentProcessor } from './processors/documentProcessor.js';
import { TextChunker } from './chunkers/textChunker.js';
import { EmbeddingGenerator } from './embeddings/embeddingGenerator.js';
import { DocumentIndex } from './index/documentIndex.js';
import path from 'path';
import fs from 'fs/promises';

export class DocumentIndexer {
  constructor(config = {}) {
    this.index = new DocumentIndex(config.indexPath);
    this.skipEmbeddings = config.embeddingConfig?.skipEmbeddings === true;
    if (!this.skipEmbeddings) {
      this.embeddingGenerator = new EmbeddingGenerator(config.embeddingConfig || {});
    }
    this.chunkOptions = config.chunkOptions || {
      chunkSize: 1000,
      chunkOverlap: 200,
    };
  }

  async initialize() {
    await this.index.load();
  }

  async indexFile(filePath, onProgress = null) {
    try {
      await fs.access(filePath);

      if (onProgress) onProgress({ stage: 'processing', message: 'Обработка файла...' });

      const document = await DocumentProcessor.processFile(filePath);

      if (onProgress) onProgress({ stage: 'chunking', message: 'Разбивка на чанки...' });

      const chunks = TextChunker.chunkDocument(document, this.chunkOptions);

      if (chunks.length === 0) {
        throw new Error('Не удалось создать чанки из документа');
      }

      let embeddings = [];
      
      if (!this.skipEmbeddings) {
        if (onProgress) {
          onProgress({ 
            stage: 'embedding', 
            message: `Генерация эмбеддингов для ${chunks.length} чанков...`,
            progress: 0,
            total: chunks.length,
          });
        }

        const texts = chunks.map(chunk => chunk.text);
        try {
          embeddings = await this.embeddingGenerator.generateEmbeddings(
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
        } catch (error) {
          this.skipEmbeddings = true;
          embeddings = [];
        }
      }

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
            embedding: embeddings[index] || null, // null если эмбеддинги не используются
          },
          documentId
        );
      });

      if (onProgress) onProgress({ stage: 'saving', message: 'Сохранение индекса...' });

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

  async indexDirectory(dirPath, ignorePatterns = ['.git', 'node_modules', 'dist', '.next', 'build', '.dev-assistant'], onProgress = null) {
    try {
      if (onProgress) onProgress({ stage: 'scanning', message: 'Сканирование директории...' });

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

        const chunks = TextChunker.chunkDocument(document, this.chunkOptions);

        if (chunks.length === 0) {
          console.warn(`Пропущен документ ${document.metadata.fileName}: нет чанков`);
          continue;
        }

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

        if (embeddings.length > 0 && !this.index.index.metadata.embeddingModel) {
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

        totalChunks += chunks.length;
        results.push({
          documentId,
          fileName: document.metadata.fileName,
          chunksCount: chunks.length,
        });
      }

      if (onProgress) onProgress({ stage: 'saving', message: 'Сохранение индекса...' });

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

  async search(query, topK = 5, minScore = 0.5) {
    // Если эмбеддинги пропущены или недоступны, используем текстовый поиск
    if (this.skipEmbeddings || !this.embeddingGenerator) {
      return this.textSearch(query, topK);
    }

    try {
      const queryEmbedding = await this.embeddingGenerator.generateEmbedding(query);
      const results = this.index.searchSimilar(queryEmbedding, topK, minScore);

      return results.map(result => ({
        ...result,
        document: this.index.getDocument(result.chunk.documentId),
      }));
    } catch (error) {
      // Fallback: простой текстовый поиск если эмбеддинги недоступны
      this.skipEmbeddings = true; // Помечаем, чтобы не пытаться снова
      return this.textSearch(query, topK);
    }
  }

  /**
   * Простой текстовый поиск без эмбеддингов
   * Использует поиск по ключевым словам и фразам
   */
  textSearch(query, topK = 5) {
    const queryLower = query.toLowerCase().trim();
    if (!queryLower) {
      return [];
    }

    // Извлекаем слова (длина > 2) и фразы
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const queryPhrase = queryLower; // Полная фраза для точного совпадения
    
    if (queryWords.length === 0) {
      // Если нет слов длиннее 2 символов, используем всю фразу
      queryWords.push(queryLower);
    }

    const scoredChunks = [];
    const documents = this.index.getAllDocuments();
    const chunks = this.index.getAllChunks();

    for (const chunk of chunks) {
      const chunkText = chunk.text.toLowerCase();
      let score = 0;
      
      // Бонус за точное совпадение фразы
      if (chunkText.includes(queryPhrase)) {
        score += 2.0;
      }
      
      // Подсчитываем совпадения слов
      for (const word of queryWords) {
        const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = (chunkText.match(regex) || []).length;
        score += matches * 0.5; // Вес для каждого совпадения
      }

      // Нормализуем score
      const maxPossibleScore = 2.0 + (queryWords.length * 0.5);
      score = Math.min(score / maxPossibleScore, 1.0);

      if (score > 0) {
        scoredChunks.push({
          chunk,
          score,
          document: documents.find(d => d.id === chunk.documentId),
        });
      }
    }

    // Сортируем по score и берем topK
    scoredChunks.sort((a, b) => b.score - a.score);
    
    return scoredChunks.slice(0, topK).map(result => ({
      ...result,
      document: result.document || this.index.getDocument(result.chunk.documentId),
    }));
  }
}




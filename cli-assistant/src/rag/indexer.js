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
    this.embeddingGenerator = new EmbeddingGenerator(config.embeddingConfig || {});
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
    const queryEmbedding = await this.embeddingGenerator.generateEmbedding(query);
    const results = this.index.searchSimilar(queryEmbedding, topK, minScore);

    return results.map(result => ({
      ...result,
      document: this.index.getDocument(result.chunk.documentId),
    }));
  }
}




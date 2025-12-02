/**
 * Управляет сохранением и загрузкой индекса документов
 */

import fs from 'fs/promises';
import path from 'path';

export class DocumentIndex {
  constructor(indexPath = null) {
    this.indexPath = indexPath;
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

  async load() {
    try {
      const dir = path.dirname(this.indexPath);
      await fs.mkdir(dir, { recursive: true });

      try {
        const data = await fs.readFile(this.indexPath, 'utf-8');
        if (!data || data.trim().length === 0) {
          return this;
        }
        this.index = JSON.parse(data);
        if (!this.index.documents || !this.index.chunks) {
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
      } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) {
          // Создаем новый индекс
        } else {
          throw error;
        }
      }
      
      return this;
    } catch (error) {
      throw new Error(`Ошибка при загрузке индекса: ${error.message}`);
    }
  }

  async save() {
    try {
      this.index.updatedAt = new Date().toISOString();
      if (!this.index.createdAt) {
        this.index.createdAt = this.index.updatedAt;
      }

      this.index.metadata.totalDocuments = this.index.documents.length;
      this.index.metadata.totalChunks = this.index.chunks.length;

      const dir = path.dirname(this.indexPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
    } catch (error) {
      throw new Error(`Ошибка при сохранении индекса: ${error.message}`);
    }
  }

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

  setEmbeddingModel(model, dimension) {
    this.index.metadata.embeddingModel = model;
    this.index.metadata.embeddingDimension = dimension;
  }

  getDocument(documentId) {
    return this.index.documents.find(doc => doc.id === documentId) || null;
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

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




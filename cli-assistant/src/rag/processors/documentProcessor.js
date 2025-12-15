/**
 * Обрабатывает различные типы документов и извлекает текст
 */

import fs from 'fs/promises';
import path from 'path';

export class DocumentProcessor {
  static async processFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const stats = await fs.stat(filePath);
    
    const baseMetadata = {
      filePath,
      fileName: path.basename(filePath),
      fileSize: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      extension: ext,
    };

    try {
      switch (ext) {
        case '.md':
        case '.markdown':
          return await this.processMarkdown(filePath, baseMetadata);
        case '.txt':
          return await this.processText(filePath, baseMetadata);
        case '.pdf':
          return await this.processPDF(filePath, baseMetadata);
        case '.js':
        case '.ts':
        case '.jsx':
        case '.tsx':
        case '.py':
        case '.java':
        case '.cpp':
        case '.c':
        case '.cs':
        case '.go':
        case '.rs':
        case '.rb':
        case '.php':
        case '.swift':
        case '.kt':
        case '.scala':
        case '.html':
        case '.css':
        case '.json':
        case '.xml':
        case '.yaml':
        case '.yml':
          return await this.processCode(filePath, baseMetadata);
        default:
          return await this.processText(filePath, baseMetadata);
      }
    } catch (error) {
      throw new Error(`Ошибка при обработке файла ${filePath}: ${error.message}`);
    }
  }

  static async processMarkdown(filePath, metadata) {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      text: content,
      metadata: {
        ...metadata,
        type: 'markdown',
      },
    };
  }

  static async processText(filePath, metadata) {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      text: content,
      metadata: {
        ...metadata,
        type: 'text',
      },
    };
  }

  static async processPDF(filePath, metadata) {
    try {
      const pdfParse = await import('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse.default(dataBuffer);
      
      return {
        text: data.text,
        metadata: {
          ...metadata,
          type: 'pdf',
          pages: data.numpages,
          info: data.info,
        },
      };
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error('pdf-parse не установлен. Установите его: npm install pdf-parse');
      }
      throw error;
    }
  }

  static async processCode(filePath, metadata) {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      text: content,
      metadata: {
        ...metadata,
        type: 'code',
        language: path.extname(filePath).slice(1),
      },
    };
  }

  static async processDirectory(dirPath, ignorePatterns = ['.git', 'node_modules', 'dist', '.next', 'build']) {
    const results = [];
    
    async function traverseDir(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (ignorePatterns.some(pattern => entry.name.includes(pattern))) {
          continue;
        }
        
        if (entry.isDirectory()) {
          await traverseDir(fullPath);
        } else if (entry.isFile()) {
          try {
            const processed = await DocumentProcessor.processFile(fullPath);
            results.push(processed);
          } catch (error) {
            console.warn(`Не удалось обработать файл ${fullPath}: ${error.message}`);
          }
        }
      }
    }
    
    await traverseDir(dirPath);
    return results;
  }

  static processTextDirect(text, metadata = {}) {
    return {
      text,
      metadata: {
        ...metadata,
        type: 'text',
        processedAt: new Date().toISOString(),
      },
    };
  }
}




















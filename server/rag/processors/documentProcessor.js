import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Обрабатывает различные типы документов и извлекает текст
 */
export class DocumentProcessor {
  /**
   * Обрабатывает файл и извлекает текст
   * @param {string} filePath - Путь к файлу
   * @returns {Promise<{text: string, metadata: object}>}
   */
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
          // Пытаемся обработать как текст
          return await this.processText(filePath, baseMetadata);
      }
    } catch (error) {
      throw new Error(`Ошибка при обработке файла ${filePath}: ${error.message}`);
    }
  }

  /**
   * Обрабатывает Markdown файл
   */
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

  /**
   * Обрабатывает текстовый файл
   */
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

  /**
   * Обрабатывает PDF файл
   */
  static async processPDF(filePath, metadata) {
    try {
      // Пытаемся импортировать pdf-parse динамически
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

  /**
   * Обрабатывает файл с кодом
   */
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

  /**
   * Обрабатывает директорию рекурсивно
   * @param {string} dirPath - Путь к директории
   * @param {string[]} ignorePatterns - Паттерны файлов для игнорирования
   * @returns {Promise<Array<{text: string, metadata: object}>>}
   */
  static async processDirectory(dirPath, ignorePatterns = ['.git', 'node_modules', 'dist', '.next', 'build']) {
    const results = [];
    
    async function traverseDir(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        // Пропускаем игнорируемые паттерны
        if (ignorePatterns.some(pattern => entry.name.includes(pattern))) {
          continue;
        }
        
        if (entry.isDirectory()) {
          await traverseDir(fullPath);
        } else if (entry.isFile()) {
          try {
            const processed = await this.processFile(fullPath);
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

  /**
   * Обрабатывает текст напрямую (без файла)
   * @param {string} text - Текст для обработки
   * @param {object} metadata - Метаданные
   * @returns {{text: string, metadata: object}}
   */
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



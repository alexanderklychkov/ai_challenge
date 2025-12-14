import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Парсер данных для локального аналитика
 * Поддерживает CSV, JSON и логи
 */
export class DataParser {
  /**
   * Парсит CSV файл
   * @param {string} filePath - Путь к файлу
   * @returns {Promise<{data: Array, columns: Array, summary: Object}>}
   */
  static async parseCSV(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error('CSV файл пуст');
      }

      // Определяем разделитель (запятая или точка с запятой)
      const firstLine = lines[0];
      const delimiter = firstLine.includes(';') ? ';' : ',';
      
      // Парсим заголовки
      const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
      
      // Парсим данные
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i], delimiter);
        if (values.length === headers.length) {
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index];
          });
          data.push(row);
        }
      }

      // Создаем сводку
      const summary = {
        totalRows: data.length,
        columns: headers.map(header => ({
          name: header,
          type: this.detectColumnType(data, header),
          sampleValues: data.slice(0, 5).map(row => row[header]).filter(v => v !== undefined && v !== null && v !== ''),
        })),
      };

      return { data, columns: headers, summary };
    } catch (error) {
      throw new Error(`Ошибка при парсинге CSV: ${error.message}`);
    }
  }

  /**
   * Парсит строку CSV с учетом кавычек
   */
  static parseCSVLine(line, delimiter) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Пропускаем следующую кавычку
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }

  /**
   * Парсит JSON файл
   * @param {string} filePath - Путь к файлу
   * @returns {Promise<{data: Array, summary: Object}>}
   */
  static async parseJSON(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const jsonData = JSON.parse(content);

      // Если это массив
      if (Array.isArray(jsonData)) {
        if (jsonData.length === 0) {
          throw new Error('JSON массив пуст');
        }

        // Определяем структуру первого элемента
        const firstItem = jsonData[0];
        const columns = Object.keys(firstItem);
        
        const summary = {
          totalRows: jsonData.length,
          columns: columns.map(col => ({
            name: col,
            type: this.detectColumnType(jsonData, col),
            sampleValues: jsonData.slice(0, 5).map(item => item[col]).filter(v => v !== undefined && v !== null),
          })),
        };

        return { data: jsonData, columns, summary };
      }
      
      // Если это объект
      if (typeof jsonData === 'object' && jsonData !== null) {
        const columns = Object.keys(jsonData);
        const summary = {
          totalRows: 1,
          columns: columns.map(col => ({
            name: col,
            type: this.detectType(jsonData[col]),
            sampleValues: [jsonData[col]],
          })),
        };

        return { data: [jsonData], columns, summary };
      }

      throw new Error('JSON должен быть объектом или массивом');
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Ошибка парсинга JSON: ${error.message}`);
      }
      throw new Error(`Ошибка при чтении JSON: ${error.message}`);
    }
  }

  /**
   * Парсит лог файл
   * @param {string} filePath - Путь к файлу
   * @returns {Promise<{data: Array, summary: Object}>}
   */
  static async parseLog(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error('Лог файл пуст');
      }

      // Парсим логи (попытка извлечь timestamp, level, message)
      const data = lines.map((line, index) => {
        const logEntry = {
          lineNumber: index + 1,
          raw: line,
        };

        // Пытаемся найти timestamp (различные форматы)
        const timestampMatch = line.match(/(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})|(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/);
        if (timestampMatch) {
          logEntry.timestamp = timestampMatch[0];
        }

        // Пытаемся найти уровень логирования
        const levelMatch = line.match(/\b(ERROR|WARN|WARNING|INFO|DEBUG|FATAL|TRACE)\b/i);
        if (levelMatch) {
          logEntry.level = levelMatch[0].toUpperCase();
        }

        // Извлекаем сообщение (всё после timestamp и level)
        const messageStart = timestampMatch ? timestampMatch.index + timestampMatch[0].length : 0;
        const levelStart = levelMatch ? levelMatch.index : messageStart;
        logEntry.message = line.substring(Math.max(messageStart, levelStart + (levelMatch ? levelMatch[0].length : 0))).trim();

        // Пытаемся найти ошибки
        if (logEntry.level === 'ERROR' || logEntry.level === 'FATAL' || line.toLowerCase().includes('error') || line.toLowerCase().includes('exception')) {
          logEntry.isError = true;
          
          // Извлекаем тип ошибки
          const errorTypeMatch = line.match(/(\w+Error|\w+Exception):/i);
          if (errorTypeMatch) {
            logEntry.errorType = errorTypeMatch[1];
          }
        }

        return logEntry;
      });

      // Подсчитываем статистику
      const errorCount = data.filter(entry => entry.isError).length;
      const levelCounts = {};
      data.forEach(entry => {
        if (entry.level) {
          levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1;
        }
      });

      const errorTypes = {};
      data.forEach(entry => {
        if (entry.errorType) {
          errorTypes[entry.errorType] = (errorTypes[entry.errorType] || 0) + 1;
        }
      });

      const summary = {
        totalRows: data.length,
        errorCount,
        levelCounts,
        errorTypes,
        columns: [
          { name: 'lineNumber', type: 'number' },
          { name: 'timestamp', type: 'string' },
          { name: 'level', type: 'string' },
          { name: 'message', type: 'string' },
          { name: 'errorType', type: 'string' },
          { name: 'isError', type: 'boolean' },
        ],
      };

      return { data, summary };
    } catch (error) {
      throw new Error(`Ошибка при парсинге логов: ${error.message}`);
    }
  }

  /**
   * Определяет тип колонки на основе данных
   */
  static detectColumnType(data, columnName) {
    if (!data || data.length === 0) return 'string';
    
    const sampleSize = Math.min(10, data.length);
    const sample = data.slice(0, sampleSize).map(row => row[columnName]).filter(v => v !== undefined && v !== null && v !== '');
    
    if (sample.length === 0) return 'string';

    // Проверяем, все ли значения числа
    const allNumbers = sample.every(v => {
      const num = Number(v);
      return !isNaN(num) && isFinite(num);
    });
    if (allNumbers) {
      // Проверяем, целые ли числа
      const allIntegers = sample.every(v => Number.isInteger(Number(v)));
      return allIntegers ? 'integer' : 'number';
    }

    // Проверяем, все ли значения даты
    const allDates = sample.every(v => {
      const date = new Date(v);
      return !isNaN(date.getTime());
    });
    if (allDates) return 'date';

    // Проверяем, все ли значения булевы
    const allBooleans = sample.every(v => {
      const str = String(v).toLowerCase();
      return str === 'true' || str === 'false' || str === '1' || str === '0' || str === 'yes' || str === 'no';
    });
    if (allBooleans) return 'boolean';

    return 'string';
  }

  /**
   * Определяет тип значения
   */
  static detectType(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    if (typeof value === 'string') {
      // Проверяем, является ли строка датой
      const date = new Date(value);
      if (!isNaN(date.getTime()) && value.length > 10) return 'date';
      return 'string';
    }
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }

  /**
   * Определяет тип файла и парсит его
   * @param {string} filePath - Путь к файлу
   * @returns {Promise<{data: Array, summary: Object, type: string}>}
   */
  static async parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    // Определяем тип файла
    let fileType;
    if (ext === '.csv') {
      fileType = 'csv';
    } else if (ext === '.json') {
      fileType = 'json';
    } else if (ext === '.log' || fileName.includes('log')) {
      fileType = 'log';
    } else {
      // Пытаемся определить по содержимому
      const content = await fs.readFile(filePath, 'utf-8');
      if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
        fileType = 'json';
      } else if (content.includes(',') || content.includes(';')) {
        fileType = 'csv';
      } else {
        fileType = 'log';
      }
    }

    // Парсим файл
    let result;
    switch (fileType) {
      case 'csv':
        result = await this.parseCSV(filePath);
        break;
      case 'json':
        result = await this.parseJSON(filePath);
        break;
      case 'log':
        result = await this.parseLog(filePath);
        break;
      default:
        throw new Error(`Неподдерживаемый тип файла: ${ext}`);
    }

    return {
      ...result,
      type: fileType,
      fileName: path.basename(filePath),
    };
  }

  /**
   * Сохраняет загруженный файл во временную директорию
   * @param {Buffer} fileBuffer - Буфер файла
   * @param {string} originalName - Оригинальное имя файла
   * @returns {Promise<string>} Путь к сохраненному файлу
   */
  static async saveUploadedFile(fileBuffer, originalName) {
    const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
    
    // Создаем директорию, если её нет
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    // Генерируем уникальное имя файла
    const timestamp = Date.now();
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${safeName}`;
    const filePath = path.join(uploadsDir, fileName);

    // Сохраняем файл
    await fs.writeFile(filePath, fileBuffer);

    return filePath;
  }
}

import { DataParser } from './dataParser.js';
import { handleOllama } from '../handlers/ollama.js';
import { handleLMStudio } from '../handlers/lmStudio.js';

/**
 * Сервис для локального анализа данных
 */
export class AnalyticsService {
  /**
   * Анализирует данные с помощью локальной LLM
   * @param {Array} data - Данные для анализа
   * @param {Object} summary - Сводка данных
   * @param {string} question - Вопрос для анализа
   * @param {string} modelType - Тип модели ('ollama' или 'lmstudio')
   * @param {Object} options - Дополнительные опции
   * @returns {Promise<string>} Ответ модели
   */
  static async analyzeData(data, summary, question, modelType = 'ollama', options = {}) {
    try {
      // Формируем промпт с контекстом данных
      const dataContext = this.formatDataContext(data, summary);
      
      const systemPrompt = `Ты - опытный аналитик данных. Твоя задача - анализировать предоставленные данные и отвечать на вопросы пользователя.

ВАЖНО:
- Отвечай на русском языке
- Будь точным и конкретным
- Используй конкретные числа и факты из данных
- Если данных недостаточно для ответа, честно скажи об этом
- Предлагай инсайты и выводы на основе данных

Формат данных:
${dataContext}

Используй эту информацию для ответа на вопросы пользователя.`;

      const userMessage = question;

      // Формируем запрос к LLM
      const requestBody = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        system_prompt: systemPrompt,
        model: options.model || undefined,
        temperature: options.temperature || 0.3,
        max_tokens: options.maxTokens || 4000,
      };

      // Выбираем обработчик в зависимости от типа модели
      let handler;
      if (modelType === 'ollama') {
        handler = handleOllama;
      } else if (modelType === 'lmstudio') {
        handler = handleLMStudio;
      } else {
        throw new Error(`Неподдерживаемый тип модели: ${modelType}`);
      }

      // Вызываем обработчик
      return new Promise((resolve, reject) => {
        const mockReq = { body: requestBody };
        const mockRes = {
          json: (data) => {
            // Ollama возвращает { text, tokens, inputTokens, outputTokens }
            // LM Studio может возвращать { content, tokens, ... }
            const text = data.text || data.content || '';
            if (!text) {
              reject(new Error('Пустой ответ от модели'));
              return;
            }
            resolve(text);
          },
          status: (code) => ({
            json: (data) => reject(new Error(data.error || `HTTP ${code}`)),
          }),
        };

        handler(mockReq, mockRes).catch(reject);
      });
    } catch (error) {
      throw new Error(`Ошибка при анализе данных: ${error.message}`);
    }
  }

  /**
   * Форматирует контекст данных для промпта
   */
  static formatDataContext(data, summary) {
    let context = '';

    // Добавляем сводку
    if (summary) {
      context += `\nСВОДКА ДАННЫХ:\n`;
      context += `- Всего записей: ${summary.totalRows || data.length}\n`;
      
      if (summary.columns) {
        context += `- Колонки:\n`;
        summary.columns.forEach(col => {
          context += `  * ${col.name} (${col.type})`;
          if (col.sampleValues && col.sampleValues.length > 0) {
            context += ` - примеры: ${col.sampleValues.slice(0, 3).join(', ')}`;
          }
          context += `\n`;
        });
      }

      // Для логов добавляем дополнительную статистику
      if (summary.errorCount !== undefined) {
        context += `- Всего ошибок: ${summary.errorCount}\n`;
      }
      if (summary.levelCounts) {
        context += `- Распределение по уровням:\n`;
        Object.entries(summary.levelCounts).forEach(([level, count]) => {
          context += `  * ${level}: ${count}\n`;
        });
      }
      if (summary.errorTypes && Object.keys(summary.errorTypes).length > 0) {
        context += `- Типы ошибок:\n`;
        Object.entries(summary.errorTypes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([type, count]) => {
            context += `  * ${type}: ${count}\n`;
          });
      }
    }

    // Добавляем примеры данных (первые несколько строк)
    const sampleSize = Math.min(20, data.length);
    context += `\nПРИМЕРЫ ДАННЫХ (первые ${sampleSize} записей из ${data.length}):\n`;
    
    if (data.length > 0) {
      const sample = data.slice(0, sampleSize);
      sample.forEach((row, index) => {
        context += `\nЗапись ${index + 1}:\n`;
        if (typeof row === 'object' && row !== null) {
          Object.entries(row).forEach(([key, value]) => {
            const displayValue = value !== null && value !== undefined 
              ? String(value).substring(0, 200) 
              : 'null';
            context += `  ${key}: ${displayValue}\n`;
          });
        } else {
          context += `  ${row}\n`;
        }
      });
    }

    // Если данных много, добавляем статистику
    if (data.length > sampleSize) {
      context += `\n... и еще ${data.length - sampleSize} записей\n`;
    }

    return context;
  }

  /**
   * Получает быструю статистику по данным
   */
  static getQuickStats(data, summary) {
    const stats = {
      totalRows: data.length,
      columns: summary?.columns || [],
    };

    // Для логов добавляем статистику ошибок
    if (summary?.errorCount !== undefined) {
      stats.errorCount = summary.errorCount;
      stats.levelCounts = summary.levelCounts || {};
      stats.errorTypes = summary.errorTypes || {};
    }

    // Для табличных данных добавляем базовую статистику по числовым колонкам
    if (summary?.columns && data.length > 0) {
      stats.numericStats = {};
      summary.columns.forEach(col => {
        if (col.type === 'number' || col.type === 'integer') {
          const values = data
            .map(row => row[col.name])
            .filter(v => v !== null && v !== undefined && v !== '')
            .map(v => Number(v))
            .filter(v => !isNaN(v) && isFinite(v));

          if (values.length > 0) {
            const sorted = values.sort((a, b) => a - b);
            stats.numericStats[col.name] = {
              min: sorted[0],
              max: sorted[sorted.length - 1],
              avg: values.reduce((a, b) => a + b, 0) / values.length,
              count: values.length,
            };
          }
        }
      });
    }

    return stats;
  }
}

/**
 * Класс для ревью PR с использованием RAG и MCP
 */

import { Assistant } from './assistant.js';
import { GitHubMCP } from './mcp/githubMCP.js';

export class PRReviewer {
  constructor() {
    this.assistant = null;
    this.githubMCP = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    this.assistant = new Assistant();
    await this.assistant.initialize();

    this.githubMCP = new GitHubMCP();
    await this.githubMCP.initialize();

    this.initialized = true;
  }

  /**
   * Выполняет ревью PR
   * @param {number} prNumber - Номер PR
   * @returns {Promise<Object>} Результат ревью
   */
  async reviewPR(prNumber) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Получаем контекст PR
    const prContext = await this.githubMCP.getPRContext(prNumber);

    // Формируем промпт для ревью
    const reviewPrompt = this.buildReviewPrompt(prContext);

    // Получаем релевантные чанки из документации через RAG
    const ragResult = await this.assistant.ragService.queryWithRAG(
      reviewPrompt,
      async (prompt, messages) => {
        const systemPrompt = this.buildSystemPrompt(prContext);
        return await this.assistant.llmClient.chat(prompt, messages, systemPrompt);
      },
      {
        topK: 10,
        minScore: 0.3,
        messages: [],
      }
    );

    // Парсим ответ для структурированного ревью
    const review = this.parseReviewResponse(ragResult.answer, prContext);

    return {
      prNumber: prNumber,
      prTitle: prContext.pr.title,
      review: review,
      metadata: {
        filesReviewed: prContext.files.length,
        chunksUsed: ragResult.chunksCount,
        tokensUsed: ragResult.metadata?.tokens || 0,
      },
    };
  }

  /**
   * Формирует промпт для ревью
   */
  buildReviewPrompt(prContext) {
    const { pr, files, diff } = prContext;

    let prompt = `Проведи детальное ревью Pull Request #${pr.number}: "${pr.title}"

Описание PR:
${pr.body || 'Описание отсутствует'}

Измененные файлы (${files.length}):
${files.map(f => `- ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`).join('\n')}

Diff изменений:
`;

    // Добавляем diff для каждого файла
    diff.forEach((fileDiff, index) => {
      if (fileDiff.patch) {
        prompt += `\n--- Файл ${index + 1}: ${fileDiff.filename} ---\n`;
        prompt += fileDiff.patch.substring(0, 5000); // Ограничиваем размер
        if (fileDiff.patch.length > 5000) {
          prompt += '\n... (diff обрезан)';
        }
      }
    });

    prompt += `

Проведи ревью и предоставь ответ в следующем формате:

## 🔍 Найденные проблемы
- [Список конкретных проблем с указанием файла и строки]

## 🐛 Потенциальные баги
- [Список потенциальных багов с объяснением]

## 💡 Советы по улучшению
- [Конструктивные предложения по улучшению кода]

## ✅ Положительные моменты
- [Что сделано хорошо]

Будь конкретным, указывай номера строк и файлы. Предлагай конкретные решения.`;

    return prompt;
  }

  /**
   * Формирует системный промпт для ревью
   */
  buildSystemPrompt(prContext) {
    return `Ты - опытный code reviewer, который проводит детальный анализ Pull Request.

Твоя задача:
1. Найти реальные проблемы в коде (ошибки, баги, уязвимости)
2. Выявить потенциальные проблемы (возможные баги, edge cases)
3. Предложить улучшения (рефакторинг, оптимизация, лучшие практики)
4. Отметить положительные моменты

Принципы ревью:
- Будь конструктивным и вежливым
- Указывай конкретные файлы и строки кода
- Предлагай конкретные решения, а не только указывай на проблемы
- Учитывай контекст проекта из документации
- Обращай внимание на:
  * Безопасность (SQL injection, XSS, утечки данных)
  * Производительность (неоптимальные запросы, лишние рендеры)
  * Читаемость кода (именование, структура)
  * Тестируемость (отсутствие тестов, сложные зависимости)
  * Соответствие стандартам проекта

PR информация:
- Автор: ${prContext.pr.author}
- Файлов изменено: ${prContext.files.length}
- Добавлено строк: ${prContext.pr.additions}
- Удалено строк: ${prContext.pr.deletions}`;
  }

  /**
   * Парсит ответ LLM в структурированный формат ревью
   */
  parseReviewResponse(response, prContext) {
    // Пытаемся извлечь структурированные секции из ответа
    const sections = {
      problems: [],
      bugs: [],
      improvements: [],
      positives: [],
      raw: response,
    };

    // Простой парсинг markdown структуры
    const lines = response.split('\n');
    let currentSection = null;

    for (const line of lines) {
      if (line.includes('##') || line.includes('###')) {
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('проблем') || lowerLine.includes('problem')) {
          currentSection = 'problems';
        } else if (lowerLine.includes('баг') || lowerLine.includes('bug')) {
          currentSection = 'bugs';
        } else if (lowerLine.includes('улучш') || lowerLine.includes('improvement') || lowerLine.includes('совет')) {
          currentSection = 'improvements';
        } else if (lowerLine.includes('положит') || lowerLine.includes('positive') || lowerLine.includes('✅')) {
          currentSection = 'positives';
        } else {
          currentSection = null;
        }
      } else if (currentSection && (line.startsWith('-') || line.startsWith('*') || line.match(/^\d+\./))) {
        const content = line.replace(/^[-*\d.\s]+/, '').trim();
        if (content) {
          sections[currentSection].push(content);
        }
      }
    }

    return sections;
  }
}


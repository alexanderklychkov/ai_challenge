/**
 * Рендерер markdown для консоли
 */

import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import chalk from 'chalk';

// Настраиваем marked для использования терминального рендерера
// Для marked v4 используем TerminalRenderer
marked.setOptions({
  renderer: new TerminalRenderer(),
  breaks: true,
  gfm: true,
});

/**
 * Очищает лишние пробелы и пустые строки из отрендеренного markdown
 * @param {string} text - Текст для очистки
 * @returns {string} Очищенный текст
 */
function cleanRenderedText(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Разбиваем на строки для обработки
  const lines = text.split('\n');
  const cleanedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Пропускаем полностью пустые строки, если предыдущая строка тоже пустая
    if (trimmedLine === '') {
      // Добавляем только одну пустую строку подряд
      if (cleanedLines.length === 0 || cleanedLines[cleanedLines.length - 1] !== '') {
        cleanedLines.push('');
      }
      continue;
    }
    
    // Убираем лишние пробелы в начале строк (кроме отступов для списков)
    // Проверяем, является ли строка элементом списка
    const isListItem = /^[\s]*[•\-\*]|^[\s]*\d+\./.test(line);
    
    if (isListItem) {
      // Для списков сохраняем минимальный отступ (2 пробела)
      cleanedLines.push(line.replace(/^[\s]+/, '  '));
    } else {
      // Для остальных строк убираем лишние пробелы в начале
      cleanedLines.push(trimmedLine);
    }
  }
  
  // Убираем пустые строки в начале и конце
  while (cleanedLines.length > 0 && cleanedLines[0] === '') {
    cleanedLines.shift();
  }
  while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] === '') {
    cleanedLines.pop();
  }
  
  return cleanedLines.join('\n');
}

/**
 * Рендерит markdown текст в форматированный вывод для консоли
 * @param {string} markdown - Markdown текст
 * @returns {string} Отформатированный текст для консоли
 */
export function renderMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return markdown;
  }

  try {
    // Рендерим markdown в терминальный формат
    // Для marked v4 используем синхронный вызов
    const rendered = marked.parse(markdown, {
      breaks: true,
      gfm: true,
    });
    
    // Очищаем лишние пробелы
    return cleanRenderedText(rendered);
  } catch (error) {
    // В случае ошибки используем упрощенный рендерер
    return renderMarkdownSimple(markdown);
  }
}

/**
 * Упрощенный рендерер markdown без внешних зависимостей (fallback)
 * @param {string} markdown - Markdown текст
 * @returns {string} Отформатированный текст для консоли
 */
export function renderMarkdownSimple(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return markdown;
  }

  let result = markdown;

  // Заголовки
  result = result.replace(/^### (.*$)/gim, (match, text) => {
    return chalk.bold.cyan(`\n${text}\n${'─'.repeat(text.length)}\n`);
  });
  result = result.replace(/^## (.*$)/gim, (match, text) => {
    return chalk.bold.cyan(`\n${text}\n${'═'.repeat(text.length)}\n`);
  });
  result = result.replace(/^# (.*$)/gim, (match, text) => {
    return chalk.bold.cyan(`\n${'═'.repeat(text.length)}\n${text}\n${'═'.repeat(text.length)}\n`);
  });

  // Жирный текст
  result = result.replace(/\*\*(.*?)\*\*/g, chalk.bold.white('$1'));
  result = result.replace(/__(.*?)__/g, chalk.bold.white('$1'));

  // Курсив
  result = result.replace(/\*(.*?)\*/g, chalk.italic('$1'));
  result = result.replace(/_(.*?)_/g, chalk.italic('$1'));

  // Код в строке
  result = result.replace(/`([^`]+)`/g, chalk.cyan('$1'));

  // Блоки кода
  result = result.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'text';
    const codeLines = code.trim().split('\n');
    const border = '─'.repeat(50);
    return chalk.bgBlackBright(
      `\n${chalk.gray('┌─ ' + language + ' ' + border)}\n` +
      chalk.white(codeLines.join('\n')) +
      `\n${chalk.gray('└' + '─'.repeat(52))}\n`
    );
  });

  // Списки
  result = result.replace(/^\- (.*$)/gim, (match, text) => {
    return chalk.white(`  • ${text}`);
  });
  result = result.replace(/^\d+\. (.*$)/gim, (match, num, text) => {
    return chalk.white(`  ${num}. ${text}`);
  });

  // Ссылки
  result = result.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, chalk.blue.underline('$1'));

  // Цитаты
  result = result.replace(/^> (.*$)/gim, (match, text) => {
    return chalk.gray(`  │ ${text}`);
  });

  return result;
}


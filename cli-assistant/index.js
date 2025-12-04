#!/usr/bin/env node

/**
 * CLI AI Assistant для разработчиков
 * Поддерживает RAG для документации и MCP для работы с git-репозиторием
 */

import { createInterface } from 'readline';
import chalk from 'chalk';
import { Command } from 'commander';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Assistant } from './src/assistant.js';
import { PRReviewer } from './src/reviewer.js';
import { renderMarkdown, renderMarkdownSimple } from './src/utils/markdownRenderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env из корня проекта
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const program = new Command();

program
  .name('dev-assistant')
  .description('CLI AI Assistant для разработчиков')
  .version('1.0.0');

program
  .command('start')
  .description('Запустить интерактивный режим')
  .action(async () => {
    await startInteractiveMode();
  });

program
  .command('help')
  .description('Задать вопрос о проекте')
  .argument('<question>', 'Ваш вопрос о проекте')
  .action(async (question) => {
    await askQuestion(question);
  });

program
  .command('index')
  .description('Проиндексировать документацию проекта')
  .option('-d, --dir <path>', 'Путь к директории с документацией', './docs')
  .action(async (options) => {
    await indexDocumentation(options.dir);
  });

program
  .command('review')
  .description('Провести ревью Pull Request')
  .argument('<prNumber>', 'Номер PR для ревью')
  .option('-o, --output <format>', 'Формат вывода (text|json)', 'text')
  .action(async (prNumber, options) => {
    await reviewPR(parseInt(prNumber), options.output);
  });

async function startInteractiveMode() {
  console.log(chalk.blue.bold('\n🤖 Dev Assistant CLI\n'));
  console.log(chalk.gray('Введите /help <вопрос> для получения помощи по проекту'));
  console.log(chalk.gray('Можете задавать вопросы о проекте или работать с задачами:'));
  console.log(chalk.gray('  - "Покажи задачи с приоритетом high"'));
  console.log(chalk.gray('  - "Создай задачу..."'));
  console.log(chalk.gray('  - "Что делать первым?"'));
  console.log(chalk.gray('Введите /exit для выхода\n'));

  const assistant = new Assistant();
  await assistant.initialize();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('> '),
  });

  rl.prompt();

  rl.on('line', async (input) => {
    const trimmed = input.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed === '/exit' || trimmed === '/quit') {
      console.log(chalk.yellow('\nДо свидания! 👋\n'));
      rl.close();
      process.exit(0);
    }

    if (trimmed.startsWith('/help')) {
      const question = trimmed.substring(5).trim();
      if (!question) {
        console.log(chalk.red('Использование: /help <ваш вопрос>'));
        rl.prompt();
        return;
      }
      await handleQuestion(assistant, question, rl);
    } else if (trimmed.startsWith('/')) {
      console.log(chalk.red(`Неизвестная команда: ${trimmed}`));
      console.log(chalk.gray('Доступные команды: /help <вопрос>, /exit'));
      rl.prompt();
    } else {
      // Обычный вопрос без префикса /help
      await handleQuestion(assistant, trimmed, rl);
    }
  });

  rl.on('close', () => {
    console.log(chalk.yellow('\nДо свидания! 👋\n'));
    process.exit(0);
  });
}

async function askQuestion(question) {
  const assistant = new Assistant();
  await assistant.initialize();
  await handleQuestion(assistant, question);
  process.exit(0);
}

async function handleQuestion(assistant, question, rl = null) {
  try {
    console.log(chalk.gray('\n🤔 Думаю...\n'));
    const response = await assistant.ask(question);
    console.log(chalk.green('\n💡 Ответ:\n'));
    
    // Рендерим markdown в консоли
    try {
      const rendered = renderMarkdown(response);
      console.log(rendered);
    } catch (error) {
      // Fallback на простой рендерер если основная библиотека не работает
      console.log(renderMarkdownSimple(response));
    }
    
    console.log('\n');
  } catch (error) {
    console.error(chalk.red('\n❌ Ошибка:'), error.message);
  }
  if (rl) {
    rl.prompt();
  }
}

async function indexDocumentation(dirPath) {
  console.log(chalk.blue(`\n📚 Индексация документации из ${dirPath}...\n`));
  const assistant = new Assistant();
  await assistant.initialize();
  await assistant.indexDocumentation(dirPath);
  console.log(chalk.green('\n✅ Документация проиндексирована!\n'));
  process.exit(0);
}

async function reviewPR(prNumber, outputFormat = 'text') {
  // Выводим сообщения в stderr, чтобы они не попадали в JSON файл
  if (outputFormat !== 'json') {
    console.error(chalk.blue(`\n🔍 Провожу ревью PR #${prNumber}...\n`));
  }
  
  try {
    const reviewer = new PRReviewer();
    await reviewer.initialize();
    
    const result = await reviewer.reviewPR(prNumber);
    
    if (outputFormat === 'json') {
      // Выводим только чистый JSON в stdout, без дополнительных сообщений
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Выводим структурированное ревью
      console.log(chalk.bold.cyan(`\n📋 Ревью PR #${result.prNumber}: ${result.prTitle}\n`));
      console.log(chalk.gray(`Файлов проверено: ${result.metadata.filesReviewed}`));
      console.log(chalk.gray(`Использовано чанков: ${result.metadata.chunksUsed}\n`));
      
      if (result.review.problems.length > 0) {
        console.log(chalk.bold.red('🔍 Найденные проблемы:'));
        result.review.problems.forEach((problem, i) => {
          console.log(chalk.red(`  ${i + 1}. ${problem}`));
        });
        console.log('');
      }
      
      if (result.review.bugs.length > 0) {
        console.log(chalk.bold.yellow('🐛 Потенциальные баги:'));
        result.review.bugs.forEach((bug, i) => {
          console.log(chalk.yellow(`  ${i + 1}. ${bug}`));
        });
        console.log('');
      }
      
      if (result.review.improvements.length > 0) {
        console.log(chalk.bold.blue('💡 Советы по улучшению:'));
        result.review.improvements.forEach((improvement, i) => {
          console.log(chalk.blue(`  ${i + 1}. ${improvement}`));
        });
        console.log('');
      }
      
      if (result.review.positives.length > 0) {
        console.log(chalk.bold.green('✅ Положительные моменты:'));
        result.review.positives.forEach((positive, i) => {
          console.log(chalk.green(`  ${i + 1}. ${positive}`));
        });
        console.log('');
      }
      
      // Если парсинг не сработал, выводим raw ответ
      if (result.review.problems.length === 0 && 
          result.review.bugs.length === 0 && 
          result.review.improvements.length === 0) {
        console.log(chalk.bold('\n📝 Полный текст ревью:\n'));
        try {
          const rendered = renderMarkdown(result.review.raw);
          console.log(rendered);
        } catch (error) {
          console.log(renderMarkdownSimple(result.review.raw));
        }
      }
    }
  } catch (error) {
    // Всегда выводим ошибки в stderr
    console.error(chalk.red('\n❌ Ошибка при ревью PR:'), error.message);
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
    // Если формат json, выводим ошибку в JSON формате в stdout
    if (outputFormat === 'json') {
      console.log(JSON.stringify({
        error: true,
        message: error.message,
        stack: error.stack
      }, null, 2));
    }
    process.exit(1);
  }
  
  process.exit(0);
}

// Парсим аргументы командной строки
program.parse();

// Если команда не указана, запускаем интерактивный режим
if (!process.argv.slice(2).length) {
  startInteractiveMode();
}


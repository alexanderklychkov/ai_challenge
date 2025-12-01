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

async function startInteractiveMode() {
  console.log(chalk.blue.bold('\n🤖 Dev Assistant CLI\n'));
  console.log(chalk.gray('Введите /help <вопрос> для получения помощи по проекту'));
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

// Парсим аргументы командной строки
program.parse();

// Если команда не указана, запускаем интерактивный режим
if (!process.argv.slice(2).length) {
  startInteractiveMode();
}


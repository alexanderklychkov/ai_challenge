#!/usr/bin/env node

/**
 * Скрипт для ревью PR в CI окружении
 * Используется в GitHub Actions
 */

import { PRReviewer } from '../src/reviewer.js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env из корня проекта
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

const prNumber = process.argv[2];

if (!prNumber) {
  console.error('Использование: node review-pr.js <PR_NUMBER>');
  process.exit(1);
}

async function main() {
  try {
    const reviewer = new PRReviewer();
    await reviewer.initialize();
    
    const result = await reviewer.reviewPR(parseInt(prNumber));
    
    // Выводим результат в JSON формате для CI
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Ошибка при ревью PR:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();


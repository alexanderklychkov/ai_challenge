#!/usr/bin/env node

/**
 * Скрипт для индексации документов
 * 
 * Использование:
 *   node server/rag/scripts/indexDocuments.js --file path/to/file.md
 *   node server/rag/scripts/indexDocuments.js --dir path/to/directory
 *   node server/rag/scripts/indexDocuments.js --text "Текст для индексации"
 */

import { DocumentIndexer } from '../indexer.js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env
dotenv.config({ path: resolve(__dirname, '../../../', '.env') });

async function main() {
  const args = process.argv.slice(2);
  
  // Парсим аргументы
  const fileIndex = args.indexOf('--file');
  const dirIndex = args.indexOf('--dir');
  const textIndex = args.indexOf('--text');
  
  // Создаем индексатор
  const indexer = new DocumentIndexer({
    embeddingConfig: {
      apiUrl: process.env.LM_STUDIO_URL || 'http://localhost:1234/v1/embeddings',
      apiKey: process.env.LM_STUDIO_API_KEY || 'lm-studio',
        model: process.env.LM_STUDIO_EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5',
    },
    chunkOptions: {
      chunkSize: parseInt(process.env.DOCUMENT_CHUNK_SIZE) || 1000,
      chunkOverlap: parseInt(process.env.DOCUMENT_CHUNK_OVERLAP) || 200,
    },
  });

  await indexer.initialize();

  // Проверяем доступность API эмбеддингов
  console.log('Проверка доступности API эмбеддингов...');
  const isAvailable = await indexer.checkEmbeddingAvailability();
  if (!isAvailable) {
    console.error('❌ API эмбеддингов недоступно!');
    console.error('Убедитесь, что LM Studio запущен и доступен по адресу:', 
      process.env.LM_STUDIO_URL || 'http://localhost:1234');
    process.exit(1);
  }
  console.log('✅ API эмбеддингов доступно\n');

  try {
    if (fileIndex !== -1 && args[fileIndex + 1]) {
      // Индексация файла
      const filePath = args[fileIndex + 1];
      console.log(`Индексация файла: ${filePath}`);
      
      const result = await indexer.indexFile(filePath, (progress) => {
        if (progress.stage === 'embedding' && progress.progress !== undefined) {
          process.stdout.write(`\r${progress.message}... `);
        } else {
          console.log(progress.message);
        }
      });
      
      console.log(`\n✅ Файл проиндексирован: ${result.chunksCount} чанков`);
      console.log(`   Document ID: ${result.documentId}`);
      
    } else if (dirIndex !== -1 && args[dirIndex + 1]) {
      // Индексация директории
      const dirPath = args[dirIndex + 1];
      console.log(`Индексация директории: ${dirPath}`);
      
      const result = await indexer.indexDirectory(dirPath, undefined, (progress) => {
        if (progress.stage === 'embedding' && progress.progress !== undefined) {
          process.stdout.write(`\r${progress.message}... `);
        } else {
          console.log(progress.message);
        }
      });
      
      console.log(`\n✅ Директория проиндексирована:`);
      console.log(`   Документов: ${result.totalDocuments}`);
      console.log(`   Чанков: ${result.totalChunks}`);
      
    } else if (textIndex !== -1 && args[textIndex + 1]) {
      // Индексация текста
      const text = args[textIndex + 1];
      console.log(`Индексация текста (${text.length} символов)...`);
      
      const result = await indexer.indexText(text, {}, (progress) => {
        if (progress.stage === 'embedding' && progress.progress !== undefined) {
          process.stdout.write(`\r${progress.message}... `);
        } else {
          console.log(progress.message);
        }
      });
      
      console.log(`\n✅ Текст проиндексирован: ${result.chunksCount} чанков`);
      console.log(`   Document ID: ${result.documentId}`);
      
    } else {
      console.log('Использование:');
      console.log('  --file <path>     Индексировать файл');
      console.log('  --dir <path>       Индексировать директорию');
      console.log('  --text "<text>"    Индексировать текст');
      console.log('\nПримеры:');
      console.log('  node server/rag/scripts/indexDocuments.js --file README.md');
      console.log('  node server/rag/scripts/indexDocuments.js --dir ./docs');
      console.log('  node server/rag/scripts/indexDocuments.js --text "Текст для индексации"');
      process.exit(1);
    }

    // Показываем статистику
    const stats = indexer.getStats();
    console.log('\n📊 Статистика индекса:');
    console.log(`   Всего документов: ${stats.totalDocuments}`);
    console.log(`   Всего чанков: ${stats.totalChunks}`);
    console.log(`   Модель эмбеддингов: ${stats.embeddingModel || 'не указана'}`);
    console.log(`   Размерность: ${stats.embeddingDimension || 'не указана'}`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Критическая ошибка:', error);
  process.exit(1);
});



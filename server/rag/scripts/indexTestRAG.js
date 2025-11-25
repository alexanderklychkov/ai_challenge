/**
 * Скрипт для индексации тестового RAG документа
 */

import { DocumentIndexer } from '../indexer.js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function indexTestRAG() {
  try {
    console.log('🚀 Начинаем индексацию тестового RAG документа...\n');

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

    const testFilePath = resolve(__dirname, '../../data/documents/test-rag.md');
    
    console.log(`📄 Индексируем файл: ${testFilePath}\n`);

    const result = await indexer.indexFile(testFilePath, (progress) => {
      if (progress.stage === 'processing') {
        console.log(`📝 ${progress.message}`);
      } else if (progress.stage === 'chunking') {
        console.log(`✂️  ${progress.message}`);
      } else if (progress.stage === 'embedding') {
        if (progress.progress !== undefined && progress.total !== undefined) {
          const percent = Math.round((progress.progress / progress.total) * 100);
          process.stdout.write(`\r🔢 ${progress.message} (${percent}%)`);
          if (progress.progress === progress.total) {
            console.log(''); // Новая строка после завершения
          }
        } else {
          console.log(`🔢 ${progress.message}`);
        }
      } else if (progress.stage === 'saving') {
        console.log(`💾 ${progress.message}`);
      }
    });

    console.log('\n✅ Индексация завершена успешно!');
    console.log(`📊 Результаты:`);
    console.log(`   - ID документа: ${result.documentId}`);
    console.log(`   - Количество чанков: ${result.chunksCount}`);
    console.log(`   - Файл: ${result.fileName}`);

    const stats = indexer.getStats();
    console.log(`\n📈 Статистика индекса:`);
    console.log(`   - Всего документов: ${stats.totalDocuments}`);
    console.log(`   - Всего чанков: ${stats.totalChunks}`);
    console.log(`   - Модель эмбеддингов: ${stats.embeddingModel || 'не указана'}`);

    console.log('\n🎉 Готово! Теперь можно тестировать RAG сравнение.');
  } catch (error) {
    console.error('\n❌ Ошибка при индексации:', error.message);
    if (error.message.includes('LM Studio') || error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Убедитесь, что LM Studio запущен и доступен по адресу:');
      console.error(`   ${process.env.LM_STUDIO_URL || 'http://localhost:1234/v1/embeddings'}`);
    }
    process.exit(1);
  }
}

indexTestRAG();


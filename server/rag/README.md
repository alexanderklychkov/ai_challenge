# Система индексации документов с эмбеддингами (RAG)

Система для индексации документов (PDF, Markdown, код, текст) с генерацией эмбеддингов через LM Studio и сохранением индекса в JSON формате.

## Возможности

- ✅ Поддержка различных форматов документов: PDF, Markdown, текстовые файлы, файлы с кодом
- ✅ Умная разбивка текста на чанки с перекрытием
- ✅ Генерация эмбеддингов через LM Studio (OpenAI-совместимый API)
- ✅ Сохранение индекса в JSON формате
- ✅ Поиск похожих документов по семантическому сходству
- ✅ REST API для работы с индексатором
- ✅ Скрипт командной строки для индексации

## Установка зависимостей

```bash
npm install
```

Это установит необходимые зависимости, включая `pdf-parse` для работы с PDF файлами.

## Настройка LM Studio

1. Установите и запустите [LM Studio](https://lmstudio.ai/)
2. Загрузите модель для эмбеддингов (например, `text-embedding-nomic-embed-text-v1.5` или другую)
3. Запустите сервер в LM Studio (обычно на порту 1234)
4. Убедитесь, что модель поддерживает эндпоинт `/v1/embeddings`

### Переменные окружения (опционально)

Создайте или обновите файл `.env`:

```env
# LM Studio настройки
LM_STUDIO_URL=http://localhost:1234/v1/embeddings
LM_STUDIO_API_KEY=lm-studio
LM_STUDIO_EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5

# Настройки разбивки на чанки
DOCUMENT_CHUNK_SIZE=1000
DOCUMENT_CHUNK_OVERLAP=200
```

## Использование

### 1. Через скрипт командной строки

#### Индексация файла:
```bash
node server/rag/scripts/indexDocuments.js --file README.md
```

#### Индексация директории:
```bash
node server/rag/scripts/indexDocuments.js --dir ./docs
```

#### Индексация текста:
```bash
node server/rag/scripts/indexDocuments.js --text "Ваш текст для индексации"
```

### 2. Через REST API

#### Проверка доступности API эмбеддингов:
```bash
curl http://localhost:3001/api/documents/embedding/check
```

#### Индексация файла:
```bash
curl -X POST http://localhost:3001/api/documents/index/file \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./README.md"}'
```

#### Индексация директории:
```bash
curl -X POST http://localhost:3001/api/documents/index/directory \
  -H "Content-Type: application/json" \
  -d '{"dirPath": "./docs", "ignorePatterns": [".git", "node_modules"]}'
```

#### Индексация текста:
```bash
curl -X POST http://localhost:3001/api/documents/index/text \
  -H "Content-Type: application/json" \
  -d '{"text": "Ваш текст для индексации", "metadata": {"source": "manual"}}'
```

#### Поиск по индексу:
```bash
curl -X POST http://localhost:3001/api/documents/search \
  -H "Content-Type: application/json" \
  -d '{"query": "как использовать API", "topK": 5, "minScore": 0.5}'
```

#### Получение статистики:
```bash
curl http://localhost:3001/api/documents/stats
```

#### Получение всех документов:
```bash
curl http://localhost:3001/api/documents
```

#### Получение чанков документа:
```bash
curl http://localhost:3001/api/documents/{documentId}/chunks
```

#### Удаление документа:
```bash
curl -X DELETE http://localhost:3001/api/documents/{documentId}
```

### 3. Программное использование

```javascript
import { DocumentIndexer } from './rag/indexer.js';

// Создаем индексатор
const indexer = new DocumentIndexer({
  embeddingConfig: {
    apiUrl: 'http://localhost:1234/v1/embeddings',
    model: 'text-embedding-nomic-embed-text-v1.5',
  },
  chunkOptions: {
    chunkSize: 1000,
    chunkOverlap: 200,
  },
});

// Инициализируем (загружаем существующий индекс)
await indexer.initialize();

// Индексируем файл
const result = await indexer.indexFile('./README.md', (progress) => {
  console.log('Прогресс:', progress);
});

// Ищем похожие документы
const results = await indexer.search('как использовать API', 5, 0.5);

// Получаем статистику
const stats = indexer.getStats();
```

## Структура

```
server/rag/
├── processors/
│   └── documentProcessor.js    # Обработка различных типов документов
├── chunkers/
│   └── textChunker.js           # Разбивка текста на чанки
├── embeddings/
│   └── embeddingGenerator.js    # Генерация эмбеддингов
├── index/
│   └── documentIndex.js        # Управление индексом
├── scripts/
│   └── indexDocuments.js        # CLI скрипт для индексации
├── indexer.js                   # Основной пайплайн индексации
└── README.md                    # Документация
```

## Структура индекса

Индекс сохраняется в `server/data/document-index.json` и имеет следующую структуру:

```json
{
  "version": "1.0",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "documents": [
    {
      "id": "document-id",
      "filePath": "./README.md",
      "fileName": "README.md",
      "type": "markdown",
      "addedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "chunks": [
    {
      "id": "chunk-id",
      "documentId": "document-id",
      "text": "Текст чанка...",
      "embedding": [0.1, 0.2, ...],
      "metadata": {
        "chunkIndex": 0,
        "totalChunks": 5,
        "startIndex": 0,
        "endIndex": 1000
      },
      "addedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "metadata": {
    "totalDocuments": 1,
    "totalChunks": 5,
        "embeddingModel": "text-embedding-nomic-embed-text-v1.5",
    "embeddingDimension": 384
  }
}
```

## Архитектура

Система состоит из следующих модулей:

1. **DocumentProcessor** (`processors/documentProcessor.js`) - Обработка различных типов документов
2. **TextChunker** (`chunkers/textChunker.js`) - Разбивка текста на чанки с перекрытием
3. **EmbeddingGenerator** (`embeddings/embeddingGenerator.js`) - Генерация эмбеддингов через LM Studio
4. **DocumentIndex** (`index/documentIndex.js`) - Управление сохранением и загрузкой индекса
5. **DocumentIndexer** (`indexer.js`) - Основной пайплайн индексации

## Поддерживаемые форматы

- **Markdown**: `.md`, `.markdown`
- **Текст**: `.txt`
- **PDF**: `.pdf` (требует `pdf-parse`)
- **Код**: `.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.java`, `.cpp`, `.c`, `.cs`, `.go`, `.rs`, `.rb`, `.php`, `.swift`, `.kt`, `.scala`, `.html`, `.css`, `.json`, `.xml`, `.yaml`, `.yml`
- Любые другие текстовые файлы обрабатываются как обычный текст

## Настройка разбивки на чанки

Параметры разбивки можно настроить через переменные окружения или при создании индексатора:

- `chunkSize` - Размер чанка в символах (по умолчанию: 1000)
- `chunkOverlap` - Перекрытие между чанками в символах (по умолчанию: 200)
- `separator` - Разделитель для разбивки (по умолчанию: `\n\n`)

## Поиск

Поиск использует косинусное сходство между эмбеддингами запроса и чанков. Результаты сортируются по убыванию сходства.

Параметры поиска:
- `query` - Текстовый запрос
- `topK` - Количество результатов (по умолчанию: 5)
- `minScore` - Минимальный score для включения (по умолчанию: 0.5)

## Расширение функциональности

### Использование других моделей эмбеддингов

Система поддерживает любой OpenAI-совместимый API. Просто укажите другой URL:

```javascript
const indexer = new DocumentIndexer({
  embeddingConfig: {
    apiUrl: 'https://api.openai.com/v1/embeddings',
    apiKey: 'your-api-key',
    model: 'text-embedding-ada-002',
  },
});
```

### Использование FAISS вместо JSON

Можно расширить `DocumentIndex` для использования FAISS или других векторных баз данных. Текущая реализация использует JSON для простоты и портативности.

## Устранение неполадок

### Ошибка подключения к LM Studio

Убедитесь, что:
1. LM Studio запущен
2. Сервер запущен в LM Studio
3. Модель загружена и поддерживает эндпоинт `/v1/embeddings`
4. URL в настройках правильный (по умолчанию: `http://localhost:1234`)

### Ошибка при обработке PDF

Убедитесь, что установлен `pdf-parse`:
```bash
npm install pdf-parse
```

### Большой размер индекса

Если индекс становится слишком большим, рассмотрите:
- Увеличение размера чанков
- Использование более эффективного формата хранения (FAISS, SQLite с векторами)
- Удаление старых документов

## Лицензия

Часть проекта AIMentor.



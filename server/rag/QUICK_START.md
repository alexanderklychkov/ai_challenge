# Быстрый старт: Индексация документов

## 1. Установка зависимостей

```bash
npm install
```

## 2. Настройка LM Studio

1. Установите [LM Studio](https://lmstudio.ai/)
2. Загрузите модель для эмбеддингов (например, `text-embedding-nomic-embed-text-v1.5`)
3. Запустите сервер в LM Studio (порт 1234 по умолчанию)

## 3. Индексация документов

### Через скрипт:

```bash
# Индексация файла
node server/rag/scripts/indexDocuments.js --file README.md

# Индексация директории
node server/rag/scripts/indexDocuments.js --dir ./docs

# Индексация текста
node server/rag/scripts/indexDocuments.js --text "Ваш текст"
```

### Через API (после запуска сервера):

```bash
# Запустите сервер
npm run dev:server

# В другом терминале - индексируйте файл
curl -X POST http://localhost:3001/api/documents/index/file \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./README.md"}'

# Поиск по индексу
curl -X POST http://localhost:3001/api/documents/search \
  -H "Content-Type: application/json" \
  -d '{"query": "как использовать", "topK": 5}'
```

## 4. Проверка

```bash
# Проверка доступности API
curl http://localhost:3001/api/documents/embedding/check

# Статистика индекса
curl http://localhost:3001/api/documents/stats
```

## Где хранится индекс?

Индекс сохраняется в: `server/data/document-index.json`

## Подробная документация

См. [README.md](./README.md)



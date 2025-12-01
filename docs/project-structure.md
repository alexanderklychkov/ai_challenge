# Структура проекта AIMentor

## Обзор

AIMentor - это React + TypeScript приложение с интеграцией различных AI моделей и системой RAG (Retrieval-Augmented Generation) для работы с документацией.

## Основные директории

### `src/` - Frontend код
- `components/` - React компоненты
  - `ChatArea.tsx` - Область чата
  - `ChatList.tsx` - Список чатов
  - `ChatSettings.tsx` - Настройки чата
  - `ContextPanel.tsx` - Панель контекста
  - `LearningPage.tsx` - Страница обучения
  - `RAGComparison.tsx` - Сравнение RAG результатов
- `pages/` - Страницы приложения
  - `ChatPage.tsx` - Главная страница чата
  - `DocumentViewerPage.tsx` - Просмотр документов
- `services/` - Сервисы для работы с API
  - `aiModel.ts` - Базовый класс для AI моделей
  - `chatGPT.ts` - Интеграция с ChatGPT
  - `deepSeek.ts` - Интеграция с DeepSeek
  - `yandexGPT.ts` - Интеграция с Yandex GPT
  - `huggingFace.ts` - Интеграция с HuggingFace
  - `rag.ts` - Сервис для работы с RAG
  - `learning.ts` - Сервис для обучения
- `utils/` - Утилиты
  - `commands.ts` - Обработка команд (/help, /analyze)
  - `prompts.ts` - Промпты для AI
  - `summarizer.ts` - Сжатие истории сообщений

### `server/` - Backend код
- `api/` - API эндпоинты
- `handlers/` - Обработчики запросов к AI моделям
  - `chatGPT.js` - Обработчик ChatGPT
  - `deepSeek.js` - Обработчик DeepSeek
  - `yandexGPT.js` - Обработчик Yandex GPT
  - `huggingFace.js` - Обработчик HuggingFace
- `mcp/` - MCP (Model Context Protocol) серверы
  - `orchestrator.js` - Оркестратор для управления MCP серверами
  - `servers/` - Реализации MCP серверов
    - `todoistMCP.js` - Интеграция с Todoist
    - `articleMCP.js` - Обработка статей
    - `learningMCP.js` - Обучение
    - `githubMCP.js` - Работа с GitHub репозиторием
  - `tools/` - Инструменты для MCP серверов
- `rag/` - Система RAG
  - `indexer.js` - Индексатор документов
  - `ragService.js` - Основной сервис RAG
  - `chunkers/` - Разбивка документов на чанки
  - `embeddings/` - Генерация эмбеддингов
  - `index/` - Индекс документов
  - `reranker/` - Переранжирование результатов
- `data/` - Данные
  - `documents/` - Документы для RAG
  - `chats/` - Сохраненные чаты
  - `learning/` - Данные обучения

## Архитектура

### RAG система
1. **Индексация**: Документы разбиваются на чанки и индексируются с эмбеддингами
2. **Поиск**: По запросу пользователя находятся релевантные чанки
3. **Reranking**: Опциональное переранжирование результатов
4. **Генерация**: LLM генерирует ответ на основе найденных чанков

### MCP система
- Оркестратор управляет несколькими MCP серверами
- Каждый сервер предоставляет набор инструментов
- Инструменты могут вызываться через единый API

### Команды
- `/help` - Справка по проекту (использует RAG)
- `/analyze` - Анализ ответов моделей

## Технологии

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express
- **AI модели**: Yandex GPT, DeepSeek, ChatGPT, HuggingFace
- **RAG**: Векторный поиск с эмбеддингами

## API эндпоинты

### AI модели
- `POST /api/yandex-gpt` - Запрос к Yandex GPT
- `POST /api/deepseek` - Запрос к DeepSeek
- `POST /api/chatgpt` - Запрос к ChatGPT
- `POST /api/huggingface` - Запрос к HuggingFace

### RAG
- `POST /api/rag/query` - Запрос с RAG
- `POST /api/rag/compare` - Сравнение с RAG и без
- `POST /api/documents/search` - Поиск по документам
- `POST /api/documents/index/file` - Индексация файла
- `POST /api/documents/index/directory` - Индексация директории

### MCP
- `GET /api/mcp/servers` - Список MCP серверов
- `GET /api/mcp/tools` - Список инструментов
- `GET /api/mcp/history` - История выполнения

### Чаты
- `GET /api/chats` - Список чатов
- `POST /api/chats` - Создание чата
- `GET /api/chats/:chatId/messages` - Сообщения чата
- `POST /api/chats/:chatId/messages` - Сохранение сообщений


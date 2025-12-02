# Dev Assistant CLI

CLI AI ассистент для разработчиков с поддержкой RAG для документации проекта и MCP для работы с git-репозиторием.

## Возможности

- 📚 **RAG для документации**: Использует RAG (Retrieval-Augmented Generation) для подключения к документации проекта (README, API, схемы данных)
- 🔧 **Git MCP**: Подключается к текущему git-репозиторию через MCP для понимания текущей ветки и открытых файлов
- 💡 **Команда /help**: Отвечает на вопросы о проекте, подсказывая фрагменты кода или правила стиля
- 🎨 **Markdown в консоли**: Красивое форматирование markdown разметки в терминале с подсветкой синтаксиса кода, заголовков, списков и других элементов
- 🤖 **Автоматическое ревью PR**: Проводит автоматическое ревью Pull Request с использованием RAG и GitHub API (см. [PR_REVIEW_GUIDE.md](./PR_REVIEW_GUIDE.md))

## Установка

1. Установите зависимости:
```bash
cd cli-assistant
npm install
```

2. Настройте переменные окружения в `.env` файле в корне проекта:

```env
# Выберите один из провайдеров LLM
DEEPSEEK_API_KEY=your_deepseek_api_key
# или
OPENAI_API_KEY=your_openai_api_key
# или
YANDEX_API_KEY=your_yandex_api_key
YANDEX_FOLDER_ID=your_yandex_folder_id

# Для эмбеддингов (обязательно для работы RAG)
# Приоритет: CUSTOM_EMBEDDING_URL > HUGGINGFACE_API_KEY > LM_STUDIO_URL > DEEPSEEK_API_KEY > OPENAI_API_KEY

# Вариант 1: Кастомный OpenAI-совместимый API (наивысший приоритет)
CUSTOM_EMBEDDING_URL=https://your-api.com/v1/embeddings
CUSTOM_EMBEDDING_API_KEY=your_api_key  # опционально

# Вариант 2: Hugging Face Inference API (рекомендуется если OpenAI/DeepSeek недоступны)
HUGGINGFACE_API_KEY=your_huggingface_token
HUGGINGFACE_EMBEDDING_MODEL=nomic-ai/nomic-embed-text-v1.5  # опционально, по умолчанию nomic-ai/nomic-embed-text-v1.5

# Вариант 3: Локальный LM Studio (для локальной разработки)
LM_STUDIO_URL=http://localhost:1234/v1/embeddings
LM_STUDIO_API_KEY=lm-studio
LM_STUDIO_EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5

# Вариант 4: DeepSeek embeddings (может не работать)
DEEPSEEK_EMBEDDING_MODEL=deepseek-embedding  # опционально

# Вариант 5: OpenAI embeddings (может быть недоступен в некоторых странах)
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # опционально
```

## Использование

### Интерактивный режим

Запустите интерактивный режим:

```bash
node index.js start
# или просто
node index.js
```

В интерактивном режиме вы можете:
- Задать вопрос напрямую (без префикса `/help`)
- Использовать команду `/help <ваш вопрос>` для получения помощи по проекту
- Использовать команду `/exit` для выхода

### Команда help

Задайте вопрос о проекте напрямую:

```bash
node index.js help "Как работает аутентификация в этом проекте?"
```

### Индексация документации

Перед использованием ассистента необходимо проиндексировать документацию проекта:

```bash
node index.js index -d ./docs
```

Где `-d` или `--dir` - путь к директории с документацией (по умолчанию `./docs`).

Индекс сохраняется в `.dev-assistant/index.json` в корне проекта.

### Ревью Pull Request

Провести ревью PR:

```bash
node index.js review <PR_NUMBER>
```

Например:
```bash
node index.js review 42
```

Для автоматического ревью при создании PR настройте GitHub Actions workflow (см. [PR_REVIEW_GUIDE.md](./PR_REVIEW_GUIDE.md)).

## Структура проекта

```
cli-assistant/
├── index.js                 # Главный файл CLI
├── package.json            # Зависимости
├── README.md               # Документация
└── src/
    ├── assistant.js        # Основной класс ассистента
    ├── llm/
    │   └── client.js       # Клиент для работы с LLM API
    ├── mcp/
    │   └── gitMCP.js       # MCP сервер для работы с git
    └── rag/
        ├── indexer.js      # Индексатор документов
        ├── ragService.js   # RAG сервис
        ├── index/
        │   └── documentIndex.js
        ├── processors/
        │   └── documentProcessor.js
        ├── chunkers/
        │   └── textChunker.js
        └── embeddings/
            └── embeddingGenerator.js
```

## Как это работает

1. **RAG для документации**: 
   - Документация проекта индексируется с помощью эмбеддингов
   - При запросе пользователя система ищет релевантные фрагменты документации
   - Эти фрагменты используются как контекст для генерации ответа LLM

2. **Git MCP**:
   - Система автоматически определяет текущую ветку git
   - Отслеживает измененные файлы в рабочей директории
   - Эта информация используется как дополнительный контекст при ответах

3. **Команда /help**:
   - Анализирует вопрос пользователя
   - Ищет релевантную информацию в документации через RAG
   - Учитывает текущий контекст git-репозитория
   - Генерирует ответ с использованием LLM

## Требования

- Node.js 18+
- Git (для работы с git-репозиторием)
- LM Studio или другой OpenAI-совместимый API для эмбеддингов (опционально, можно использовать облачные сервисы)

## Поддерживаемые форматы документов

- Markdown (`.md`, `.markdown`)
- Текстовые файлы (`.txt`)
- PDF (`.pdf`) - требует установки `pdf-parse`
- Код (`.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.java`, `.cpp`, `.c`, `.cs`, `.go`, `.rs`, `.rb`, `.php`, `.swift`, `.kt`, `.scala`, `.html`, `.css`, `.json`, `.xml`, `.yaml`, `.yml`)

## Примеры использования

```bash
# Индексация документации
node index.js index -d ./docs

# Задать вопрос в интерактивном режиме
node index.js start
> /help Как работает система аутентификации?

# Задать вопрос напрямую
node index.js help "Где находится код для обработки API запросов?"

# Провести ревью PR
node index.js review 42
```

## Примечания

- Индекс документации сохраняется локально в `.dev-assistant/index.json`
- Система автоматически определяет git-репозиторий в текущей директории
- Если git-репозиторий не найден, некоторые функции могут быть недоступны


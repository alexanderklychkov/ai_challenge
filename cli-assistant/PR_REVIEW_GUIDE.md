# Руководство по настройке автоматического ревью PR

Это руководство описывает, как настроить автоматическое ревью Pull Request с использованием AI ассистента, RAG и MCP.

## Возможности

- 🤖 **Автоматическое ревью PR** - при создании или обновлении PR автоматически запускается ревью
- 📚 **RAG для контекста** - использует документацию проекта для более точного ревью
- 🔍 **Анализ diff** - получает и анализирует изменения через GitHub API
- 💡 **Структурированные замечания** - выдает проблемы, баги, советы и положительные моменты

## Настройка

### 1. Установка зависимостей

```bash
cd cli-assistant
npm install
```

### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта (не в `cli-assistant`) со следующими переменными:

```env
# Выберите один из провайдеров LLM
DEEPSEEK_API_KEY=your_deepseek_api_key
# или
OPENAI_API_KEY=your_openai_api_key
# или
YANDEX_API_KEY=your_yandex_api_key
YANDEX_FOLDER_ID=your_yandex_folder_id

# Для эмбеддингов (обязательно для работы RAG)
# Приоритет: CUSTOM_EMBEDDING_URL > OLLAMA_URL > HUGGINGFACE_API_KEY > LM_STUDIO_URL > DEEPSEEK_API_KEY > OPENAI_API_KEY

# Вариант 1: Кастомный OpenAI-совместимый API (наивысший приоритет)
CUSTOM_EMBEDDING_URL=https://your-api.com/v1/embeddings
CUSTOM_EMBEDDING_API_KEY=your_api_key  # опционально
CUSTOM_EMBEDDING_MODEL=text-embedding-ada-002  # опционально

# Вариант 2: Ollama (локальная модель, работает в GitHub Actions)
# Документация: https://habr.com/ru/articles/953598/
# В GitHub Actions уже настроено автоматически - Ollama запускается как сервис
OLLAMA_URL=http://localhost:11434  # опционально, по умолчанию http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text  # опционально, по умолчанию nomic-embed-text
# Популярные модели: nomic-embed-text, all-minilm

# Вариант 3: Hugging Face Inference Providers API (рекомендуется если OpenAI/DeepSeek недоступны)
# Документация: https://huggingface.co/docs/inference-providers/index
HUGGINGFACE_API_KEY=your_huggingface_token
# или используйте HF_TOKEN (эквивалентно)
HF_TOKEN=your_huggingface_token
HUGGINGFACE_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2  # опционально, по умолчанию sentence-transformers/all-MiniLM-L6-v2
HUGGINGFACE_PROVIDER=hf-inference  # опционально, по умолчанию hf-inference (можно использовать 'auto', 'nebius', 'sambanova' и т.д.)
# Популярные модели: sentence-transformers/all-MiniLM-L6-v2, intfloat/multilingual-e5-base, BAAI/bge-small-en-v1.5
# Получить токен: https://huggingface.co/settings/tokens

# Вариант 4: Локальный LM Studio (для локальной разработки)
LM_STUDIO_URL=http://localhost:1234/v1/embeddings
LM_STUDIO_API_KEY=lm-studio
LM_STUDIO_EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5

# Вариант 5: DeepSeek embeddings (может не работать)
DEEPSEEK_EMBEDDING_MODEL=deepseek-embedding  # опционально

# Вариант 6: OpenAI embeddings (может быть недоступен в некоторых странах)
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # опционально

# GitHub Token для доступа к PR (обязательно для CI)
GITHUB_TOKEN=your_github_token
```

### 3. Настройка GitHub Secrets

Для работы GitHub Actions workflow необходимо добавить следующие secrets в настройках репозитория (Settings → Secrets and variables → Actions):

- `GITHUB_TOKEN` - автоматически предоставляется GitHub Actions (можно использовать `secrets.GITHUB_TOKEN`)
- `DEEPSEEK_API_KEY` или `OPENAI_API_KEY` или `YANDEX_API_KEY` - ключ для LLM провайдера
- `YANDEX_FOLDER_ID` - если используете YandexGPT

**Для эмбеддингов (обязательно):**
- `OLLAMA_URL` - URL Ollama сервиса (по умолчанию `http://localhost:11434`, автоматически настроено в GitHub Actions)
- `OLLAMA_EMBEDDING_MODEL` - модель для эмбеддингов (по умолчанию `nomic-embed-text`)
- `CUSTOM_EMBEDDING_URL` - URL кастомного OpenAI-совместимого API (наивысший приоритет)
- `CUSTOM_EMBEDDING_API_KEY` - ключ для кастомного API (опционально)
- `HUGGINGFACE_API_KEY` - токен Hugging Face (рекомендуется если OpenAI/DeepSeek недоступны)
- `HUGGINGFACE_EMBEDDING_MODEL` - модель Hugging Face (по умолчанию `sentence-transformers/all-MiniLM-L6-v2`)
- `HUGGINGFACE_PROVIDER` - провайдер Inference Providers (по умолчанию `hf-inference`, можно использовать `auto`, `nebius`, `sambanova` и т.д.)
- `LM_STUDIO_URL`, `LM_STUDIO_API_KEY`, `LM_STUDIO_EMBEDDING_MODEL` - для локального LM Studio
- `DEEPSEEK_EMBEDDING_MODEL` - модель для DeepSeek embeddings (опционально)
- `OPENAI_EMBEDDING_MODEL` - модель для OpenAI embeddings (опционально)

**Важно:** 
- Приоритет выбора провайдера эмбеддингов: **CUSTOM > OLLAMA > HUGGINGFACE > LM_STUDIO > DEEPSEEK > OPENAI**
- **Рекомендация для GitHub Actions:** Используйте Ollama (уже настроено автоматически) - это локальная модель, не требует токенов и работает полностью изолированно
- **Рекомендация для локальной разработки:** Используйте `HUGGINGFACE_API_KEY` если OpenAI/DeepSeek недоступны в вашей стране
- Получить токен Hugging Face: https://huggingface.co/settings/tokens
- Популярные модели Ollama: `nomic-embed-text` (по умолчанию), `all-minilm`
- Популярные модели Hugging Face: `sentence-transformers/all-MiniLM-L6-v2` (по умолчанию), `intfloat/multilingual-e5-base`, `BAAI/bge-small-en-v1.5`
- **Важно:** Модель `nomic-ai/nomic-embed-text-v1.5` не доступна через Inference Providers, используйте `sentence-transformers/all-MiniLM-L6-v2` или Ollama с `nomic-embed-text`

### 4. Индексация документации

Перед использованием необходимо проиндексировать документацию проекта:

```bash
cd cli-assistant
node index.js index -d ../docs
```

Это создаст индекс в `.dev-assistant/index.json`, который будет использоваться для RAG.

## Использование

### Ручной запуск ревью

Вы можете запустить ревью PR вручную:

```bash
cd cli-assistant
node index.js review <PR_NUMBER>
```

Например:
```bash
node index.js review 42
```

Для вывода в JSON формате:
```bash
node index.js review 42 --output json
```

### Автоматическое ревью через GitHub Actions

При создании или обновлении PR автоматически запускается workflow `.github/workflows/pr-review.yml`, который:

1. Проверяет код
2. Устанавливает зависимости
3. Индексирует документацию (если она есть)
4. Запускает ревью PR
5. Публикует результат в виде комментария к PR

## Как это работает

1. **Триггер**: При создании или обновлении PR запускается GitHub Actions workflow
2. **Получение данных PR**: Через GitHub API получается информация о PR, список файлов и diff
3. **RAG поиск**: Система ищет релевантные фрагменты документации и кода через RAG
4. **Анализ**: LLM анализирует изменения с учетом контекста из документации
5. **Результат**: Структурированное ревью публикуется в виде комментария к PR

## Структура ревью

Ревью включает следующие секции:

- **🔍 Найденные проблемы** - конкретные проблемы в коде
- **🐛 Потенциальные баги** - возможные баги и edge cases
- **💡 Советы по улучшению** - предложения по рефакторингу и оптимизации
- **✅ Положительные моменты** - что сделано хорошо

## Требования

- Node.js 18+
- Git
- GitHub репозиторий с настроенными GitHub Actions
- API ключ для одного из LLM провайдеров (DeepSeek, OpenAI, YandexGPT)

## Troubleshooting

### Ошибка "GITHUB_TOKEN не установлен"

Убедитесь, что в GitHub Secrets добавлен `GITHUB_TOKEN` или используйте автоматически предоставляемый `secrets.GITHUB_TOKEN` в workflow.

### Ошибка "PR не найден"

Проверьте, что:
- PR существует и открыт
- Токен имеет права на чтение репозитория
- Номер PR указан правильно

### Ошибка при индексации документации

Если документация отсутствует, workflow продолжит работу, но RAG будет использовать только код из PR.

### Ошибка "Не удалось подключиться к [сервису эмбеддингов]"

Если эмбеддинги недоступны (например, DeepSeek/OpenAI API недоступны или заблокированы), система автоматически переключится на текстовый поиск. Это означает:

- ✅ Ревью будет работать, но с менее точным поиском релевантных фрагментов
- ✅ Текстовый поиск использует поиск по ключевым словам и фразам

**Решение:** 
1. Установите `USE_TEXT_SEARCH=true` в GitHub Secrets для принудительного использования текстового поиска
2. Или используйте локальный LM Studio, если он доступен
3. Система автоматически переключится на текстовый поиск при ошибках эмбеддингов

### Ревью не публикуется в комментариях

Проверьте права workflow:
- `pull-requests: write` - для создания комментариев
- `contents: read` - для чтения кода

## Примеры

### Пример успешного ревью

```markdown
## 🤖 Автоматическое ревью PR #42

**PR:** Добавлена функция аутентификации

📊 Проверено файлов: 3 | Использовано чанков: 5

### 🔍 Найденные проблемы

1. В файле `src/auth.js:45` отсутствует проверка на null перед использованием токена
2. В `src/middleware.js:12` используется устаревший метод `verifyToken`

### 🐛 Потенциальные баги

1. Возможна утечка токена в логи при ошибке аутентификации (строка 78)

### 💡 Советы по улучшению

1. Добавить unit-тесты для функции `validateToken`
2. Использовать константы для магических чисел

### ✅ Положительные моменты

1. Хорошая структура кода
2. Правильное использование async/await
```

## Дополнительная информация

- [README.md](./README.md) - основная документация CLI ассистента
- [GitHub Actions документация](https://docs.github.com/en/actions)


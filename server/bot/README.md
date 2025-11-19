# Telegram Bot для AI Mentor

Telegram бот

## Настройка

### 1. Создание бота в Telegram

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Сохраните полученный токен

### 2. Настройка переменных окружения

Добавьте в файл `.env` в корне проекта:

```env
# Обязательно: токен Telegram бота
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Опционально: настройки по умолчанию
TELEGRAM_DEFAULT_MODEL=deepseek  # Модель по умолчанию (deepseek, chatgpt, yandex, huggingface)
TELEGRAM_ENABLE_MCP=false        # Включить MCP инструменты по умолчанию
TELEGRAM_SYSTEM_PROMPT=Ты полезный AI-ассистент. Отвечай на русском языке.
TELEGRAM_REMINDER_INTERVAL=30    # Интервал напоминаний в секундах (по умолчанию 30)
TELEGRAM_REMINDER_AI_MODEL=deepseek  # Модель для обработки напоминаний (по умолчанию используется TELEGRAM_DEFAULT_MODEL)

# Обязательно для напоминаний: API ключ Todoist
TODOIST_API_KEY=your_todoist_api_key_here

# Настройки моделей (если нужно переопределить значения по умолчанию)
DEEPSEEK_MODEL=deepseek-chat
OPENAI_MODEL=gpt-3.5-turbo
YANDEX_MODEL=yandexgpt-lite
HUGGINGFACE_MODEL=deepseek-ai/DeepSeek-R1
```

### 3. API ключи для моделей

Убедитесь, что в `.env` установлены необходимые API ключи:

- Для DeepSeek: `DEEPSEEK_API_KEY`
- Для ChatGPT: `OPENAI_API_KEY`
- Для Yandex GPT: `YANDEX_GPT_API_KEY` и `YANDEX_GPT_FOLDER_ID`
- Для HuggingFace: `HF_TOKEN`

## Использование

### Команды бота

- `/start` - Начать работу с ботом
- `/help` - Показать справку
- `/model [название]` - Выбрать модель ИИ (deepseek, chatgpt, yandex, huggingface)
- `/remind` - Подписаться на напоминания о задачах (каждые 30 секунд)
- `/unremind` - Отписаться от напоминаний
- `/clear` - Очистить историю сообщений

### Примеры использования

1. Отправьте `/start` для начала работы
2. Выберите модель: `/model deepseek`
3. Отправьте сообщение боту, и он ответит используя выбранную модель
4. Подпишитесь на напоминания: `/remind` - бот будет отправлять сводку о задачах каждые 30 секунд

## Архитектура

Бот переиспользует существующие обработчики ИИ моделей:

- `server/handlers/deepSeek.js`
- `server/handlers/chatGPT.js`
- `server/handlers/yandexGPT.js`
- `server/handlers/huggingFace.js`

История сообщений хранится отдельно для каждого пользователя Telegram в файле `server/data/telegram-messages.json`.

Настройки пользователей (выбранная модель, включен ли MCP) хранятся в `server/data/telegram-user-settings.json`.

## Запуск

Бот автоматически запускается вместе с основным сервером при выполнении:

```bash
npm run dev:server
```

Или при запуске всех сервисов:

```bash
npm run dev:all
```

## Особенности

- ✅ Переиспользование существующих обработчиков ИИ без дублирования кода
- ✅ Отдельная история сообщений для каждого пользователя
- ✅ Сохранение выбранной модели для каждого пользователя
- ✅ Поддержка всех доступных ИИ моделей
- ✅ Поддержка MCP инструментов (если включено)
- ✅ Автоматическое разбиение длинных ответов на части (Telegram ограничение 4096 символов)
- ✅ **Периодические напоминания о задачах** - бот работает 24/7 и отправляет сводку о задачах из Todoist каждые 30 секунд подписанным пользователям
- ✅ MCP инструмент `reminder` для получения сводки задач с приоритетами и сроками выполнения


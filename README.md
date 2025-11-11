# Frontend Mentor AI

React + TypeScript приложение с использованием Tailwind CSS и интеграцией различных AI моделей (Yandex GPT, DeepSeek, ChatGPT, HuggingFace Inference Providers).

## Установка

```bash
npm install
```

## Настройка AI моделей

### Yandex GPT API

#### 1. Получение API ключа и Folder ID

1. Зарегистрируйтесь в [Yandex Cloud](https://cloud.yandex.ru/)
2. Создайте новый каталог (folder) и скопируйте его ID
3. Создайте сервисный аккаунт в этом каталоге
4. Назначьте роль `ai.languageModels.user` сервисному аккаунту
5. Создайте API ключ для сервисного аккаунта (область действия: выберите созданный каталог)
6. Скопируйте API ключ и Folder ID

#### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```env
# Yandex GPT
YANDEX_GPT_FOLDER_ID=your_folder_id_here
YANDEX_GPT_API_KEY=your_api_key_here

# DeepSeek (опционально)
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# OpenAI/ChatGPT (опционально)
OPENAI_API_KEY=your_openai_api_key_here

# HuggingFace Inference Providers (опционально)
HF_TOKEN=your_huggingface_token_here
```

#### 3. Область действия API ключа

При создании API ключа выберите **область действия: ваш каталог (folder)**, в котором создан сервисный аккаунт. Это обеспечивает правильные права доступа.

### HuggingFace Inference Providers

#### 1. Получение токена

1. Зарегистрируйтесь на [Hugging Face](https://huggingface.co/)
2. Перейдите в [настройки токенов](https://huggingface.co/settings/tokens)
3. Создайте новый токен с типом `fine-grained` и разрешением `Make calls to Inference Providers`
4. Скопируйте токен

#### 2. Настройка переменных окружения

Добавьте в файл `.env`:

```env
HF_TOKEN=your_huggingface_token_here
```

#### 3. Использование

HuggingFace Inference Providers предоставляет доступ к множеству моделей через единый API. Вы можете:

- Использовать различные модели: `deepseek-ai/DeepSeek-R1`, `openai/gpt-oss-120b`, и другие
- Выбирать провайдера автоматически (`auto`), по скорости (`fastest`), по цене (`cheapest`) или конкретного провайдера (`sambanova`, `together`, и т.д.)

Пример использования в коде:

```typescript
import { createHuggingFaceModel } from './services/huggingFace';

// Модель с автоматическим выбором провайдера
const model1 = createHuggingFaceModel({
  model: 'deepseek-ai/DeepSeek-R1',
  provider: 'auto'
});

// Модель с выбором самого быстрого провайдера
const model2 = createHuggingFaceModel({
  model: 'openai/gpt-oss-120b',
  provider: 'fastest'
});

// Модель с конкретным провайдером
const model3 = createHuggingFaceModel({
  model: 'deepseek-ai/DeepSeek-R1',
  provider: 'sambanova'
});
```

Подробнее о доступных моделях и провайдерах: [HuggingFace Inference Providers Documentation](https://huggingface.co/docs/inference-providers/index)

## Запуск

### Вариант 1: Запуск фронтенда и сервера отдельно

В первом терминале:
```bash
npm run dev:server
```

Во втором терминале:
```bash
npm run dev
```

### Вариант 2: Запуск всего вместе (рекомендуется)

```bash
npm run dev:all
```

Это запустит и прокси-сервер (порт 3001), и фронтенд (порт 5173) одновременно.

## Сборка

```bash
npm run build
```

## Технологии

- React 18
- TypeScript
- Tailwind CSS 4.1
- Vite 7
- AI модели:
  - Yandex GPT API
  - DeepSeek API
  - OpenAI/ChatGPT API
  - HuggingFace Inference Providers

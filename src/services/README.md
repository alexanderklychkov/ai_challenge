# AI Models Architecture

Эта директория содержит реализацию абстрактного класса для AI моделей и конкретные реализации для различных провайдеров.

## Архитектура

### Абстрактный класс `AIModel`

Все AI модели наследуются от абстрактного класса `AIModel`, который определяет общий интерфейс:

```typescript
abstract class AIModel {
  protected config: AIModelConfig;
  
  abstract sendMessage(messages: AIMessage[]): Promise<AIResponse>;
  convertMessages(messages): AIMessage[];
  updateConfig(config: Partial<AIModelConfig>): void;
  getConfig(): AIModelConfig;
}
```

### Доступные модели

1. **YandexGPTModel** - реализация для Yandex GPT
2. **ChatGPTModel** - шаблон для ChatGPT (требует настройки API)
3. **DeepSeekModel** - шаблон для DeepSeek (требует настройки API)
4. **HuggingFaceModel** - реализация для HuggingFace Inference Providers (требует настройки HF_TOKEN)

## Использование

### Базовое использование

```typescript
import { createYandexGPTModel } from './services/yandexGPT';
import { useChat } from './hooks/useChat';

// Создание модели с дефолтными настройками
const model = createYandexGPTModel();

// Использование в компоненте
const chat = useChat({ model });
```

### Создание нескольких экземпляров с разными параметрами

```typescript
import { createYandexGPTModel } from './services/yandexGPT';
import prompts from './utils/prompts';

// Модель для начинающих
const beginnerModel = createYandexGPTModel({
  systemPrompt: prompts.day3.system_prompt + '\nОбъясняй просто.',
  temperature: 0.3,
});

// Модель для продвинутых
const advancedModel = createYandexGPTModel({
  systemPrompt: prompts.day3.system_prompt + '\nИспользуй продвинутые концепции.',
  temperature: 0.7,
  maxTokens: 4000,
});

// Модель с другим прокси URL
const customModel = new YandexGPTModel({
  apiProxyUrl: 'http://localhost:3002/api/yandex-gpt',
  systemPrompt: 'Ты - эксперт по TypeScript',
});
```

### Использование в компоненте

```typescript
import { useChat } from './hooks/useChat';
import { createYandexGPTModel } from './services/yandexGPT';

function MyComponent() {
  // Создаем модель с кастомными параметрами
  const model = useMemo(() => createYandexGPTModel({
    systemPrompt: 'Твой кастомный промпт',
    temperature: 0.5,
  }), []);

  // Используем модель в хуке
  const { messages, isLoading, sendMessage } = useChat({ model });

  return <ChatArea messages={messages} isLoading={isLoading} onSendMessage={sendMessage} />;
}
```

### Динамическое переключение моделей

```typescript
import { useState, useMemo } from 'react';
import { useChat } from './hooks/useChat';
import { createYandexGPTModel } from './services/yandexGPT';
import { createChatGPTModel } from './services/chatGPT';
import { createHuggingFaceModel } from './services/huggingFace';

function MyComponent() {
  const [modelType, setModelType] = useState<'yandex' | 'chatgpt' | 'huggingface'>('yandex');

  const model = useMemo(() => {
    if (modelType === 'yandex') {
      return createYandexGPTModel();
    } else if (modelType === 'chatgpt') {
      return createChatGPTModel();
    } else {
      return createHuggingFaceModel({
        model: 'deepseek-ai/DeepSeek-R1',
        provider: 'fastest'
      });
    }
  }, [modelType]);

  const chat = useChat({ model });

  return (
    <div>
      <button onClick={() => setModelType('yandex')}>Yandex GPT</button>
      <button onClick={() => setModelType('chatgpt')}>ChatGPT</button>
      <button onClick={() => setModelType('huggingface')}>HuggingFace</button>
      {/* ... */}
    </div>
  );
}
```

### Использование HuggingFace Inference Providers

HuggingFace Inference Providers предоставляет доступ к множеству моделей через единый API:

```typescript
import { createHuggingFaceModel } from './services/huggingFace';

// Автоматический выбор провайдера
const model1 = createHuggingFaceModel({
  model: 'deepseek-ai/DeepSeek-R1',
  provider: 'auto'
});

// Выбор самого быстрого провайдера
const model2 = createHuggingFaceModel({
  model: 'openai/gpt-oss-120b',
  provider: 'fastest'
});

// Выбор самого дешевого провайдера
const model3 = createHuggingFaceModel({
  model: 'deepseek-ai/DeepSeek-R1',
  provider: 'cheapest'
});

// Конкретный провайдер
const model4 = createHuggingFaceModel({
  model: 'deepseek-ai/DeepSeek-R1',
  provider: 'sambanova'
});
```

## Создание новой модели

Для создания новой модели необходимо:

1. Наследоваться от класса `AIModel`
2. Реализовать метод `sendMessage`
3. Опционально переопределить методы `convertMessages` и `parseResponse`

Пример:

```typescript
import { AIModel, AIMessage, AIModelConfig } from './aiModel';
import { AIResponse } from '../types/message';

export interface MyModelConfig extends AIModelConfig {
  apiKey?: string;
  apiUrl?: string;
}

export class MyModel extends AIModel {
  private apiKey?: string;
  private apiUrl: string;

  constructor(config: MyModelConfig = {}) {
    super(config);
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'https://api.example.com';
  }

  async sendMessage(messages: AIMessage[]): Promise<AIResponse> {
    // Ваша реализация
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify({
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.text || msg.content,
        })),
        systemPrompt: this.config.systemPrompt,
      }),
    });

    const data = await response.json();
    return this.parseResponse(data.text);
  }
}

export const createMyModel = (config?: MyModelConfig): MyModel => {
  return new MyModel(config);
};
```

## Конфигурация

Все модели поддерживают базовую конфигурацию через `AIModelConfig`:

```typescript
interface AIModelConfig {
  systemPrompt?: string;      // Системный промпт
  temperature?: number;        // Температура (0-1)
  maxTokens?: number;          // Максимальное количество токенов
  [key: string]: any;          // Дополнительные параметры
}
```

Каждая конкретная модель может расширять эту конфигурацию своими параметрами.


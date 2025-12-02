/**
 * Клиент для работы с LLM API
 * Поддерживает различные провайдеры (DeepSeek, OpenAI, YandexGPT и т.д.)
 */

export class LLMClient {
  constructor() {
    this.apiKey = null;
    this.apiUrl = null;
    this.model = null;
    this.provider = null;
    
    this.initialize();
  }

  initialize() {
    // Определяем провайдера по переменным окружения
    if (process.env.DEEPSEEK_API_KEY) {
      this.provider = 'deepseek';
      this.apiKey = process.env.DEEPSEEK_API_KEY;
      this.apiUrl = 'https://api.deepseek.com/v1/chat/completions';
      this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    } else if (process.env.OPENAI_API_KEY) {
      this.provider = 'openai';
      this.apiKey = process.env.OPENAI_API_KEY;
      this.apiUrl = 'https://api.openai.com/v1/chat/completions';
      this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    } else if (process.env.YANDEX_API_KEY) {
      this.provider = 'yandex';
      this.apiKey = process.env.YANDEX_API_KEY;
      this.apiUrl = process.env.YANDEX_API_URL || 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
      this.model = process.env.YANDEX_MODEL || 'yandexgpt-lite';
    } else {
      throw new Error('Не найден API ключ. Установите DEEPSEEK_API_KEY, OPENAI_API_KEY или YANDEX_API_KEY');
    }
  }

  async chat(prompt, messages = [], systemPrompt = '') {
    const requestMessages = messages.length > 0 
      ? [...messages]
      : [{ role: 'user', content: prompt }];

    // Добавляем системный промпт если он есть
    if (systemPrompt && requestMessages[0]?.role !== 'system') {
      requestMessages.unshift({ role: 'system', content: systemPrompt });
    }

    if (this.provider === 'yandex') {
      return await this.chatYandex(requestMessages);
    } else {
      return await this.chatOpenAI(requestMessages);
    }
  }

  async chatOpenAI(messages) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка API: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';

    return {
      text,
      tokens: data.usage?.total_tokens || 0,
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    };
  }

  async chatYandex(messages) {
    // Конвертируем сообщения в формат YandexGPT
    const lastMessage = messages[messages.length - 1];
    const systemMessage = messages.find(m => m.role === 'system');
    
    const requestBody = {
      modelUri: `gpt://${process.env.YANDEX_FOLDER_ID}/yandexgpt/latest`,
      completionOptions: {
        stream: false,
        temperature: 0.3,
        maxTokens: '2000',
      },
      messages: messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          text: m.content,
        })),
    };

    if (systemMessage) {
      requestBody.systemInstruction = {
        text: systemMessage.content,
      };
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка YandexGPT API: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    const text = data.result?.alternatives[0]?.message?.text || '';

    return {
      text,
      tokens: data.result?.usage?.totalTokens || 0,
      inputTokens: data.result?.usage?.inputTextTokens || 0,
      outputTokens: data.result?.usage?.completionTokens || 0,
    };
  }
}




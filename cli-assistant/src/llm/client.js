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

  async chat(prompt, messages = [], systemPrompt = '', tools = null) {
    const requestMessages = messages.length > 0 
      ? [...messages]
      : [{ role: 'user', content: prompt }];

    // Добавляем системный промпт если он есть
    if (systemPrompt && requestMessages[0]?.role !== 'system') {
      requestMessages.unshift({ role: 'system', content: systemPrompt });
    }

    if (this.provider === 'yandex') {
      return await this.chatYandex(requestMessages, tools);
    } else {
      return await this.chatOpenAI(requestMessages, tools);
    }
  }

  async chatOpenAI(messages, tools = null) {
    const body = {
      model: this.model,
      messages: messages,
      temperature: 0.3,
      max_tokens: 2000,
    };

    // Добавляем функции, если они есть
    if (tools && tools.length > 0) {
      body.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));
      body.tool_choice = 'auto';
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ошибка API: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    const message = data.choices[0]?.message || {};
    let text = message.content || '';
    let toolCalls = message.tool_calls || [];

    // Если это DeepSeek и нет tool_calls, но есть DSML в тексте, парсим его
    if (this.provider === 'deepseek' && toolCalls.length === 0 && text.includes('<｜DSML｜')) {
      const parsed = this.parseDSML(text);
      if (parsed.toolCalls.length > 0) {
        toolCalls = parsed.toolCalls;
        text = parsed.cleanedText; // Удаляем DSML из текста
      }
    }

    return {
      text,
      toolCalls,
      tokens: data.usage?.total_tokens || 0,
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    };
  }

  /**
   * Парсит DSML (DeepSeek Markup Language) формат из текста
   * Формат: <｜DSML｜function_calls>...<｜DSML｜invoke name="...">...</｜DSML｜invoke>...</｜DSML｜function_calls>
   */
  parseDSML(text) {
    const toolCalls = [];
    let cleanedText = text;

    // Ищем блок function_calls
    const functionCallsMatch = text.match(/<｜DSML｜function_calls>([\s\S]*?)<\/｜DSML｜function_calls>/);
    if (!functionCallsMatch) {
      return { toolCalls: [], cleanedText: text };
    }

    const functionCallsBlock = functionCallsMatch[1];
    
    // Удаляем блок function_calls из текста
    cleanedText = text.replace(/<｜DSML｜function_calls>[\s\S]*?<\/｜DSML｜function_calls>/g, '').trim();

    // Парсим каждый invoke блок
    const invokeRegex = /<｜DSML｜invoke\s+name="([^"]+)">([\s\S]*?)<\/｜DSML｜invoke>/g;
    let invokeMatch;
    let callId = 0;

    while ((invokeMatch = invokeRegex.exec(functionCallsBlock)) !== null) {
      const toolName = invokeMatch[1];
      const invokeContent = invokeMatch[2];
      const parameters = {};

      // Парсим параметры
      const paramRegex = /<｜DSML｜parameter\s+name="([^"]+)"(?:\s+string="([^"]+)")?>([\s\S]*?)<\/｜DSML｜parameter>/g;
      let paramMatch;

      while ((paramMatch = paramRegex.exec(invokeContent)) !== null) {
        let paramName = paramMatch[1];
        const paramType = paramMatch[2] || 'string';
        let paramValue = paramMatch[3].trim();

        // Специальная обработка для параметра "filter" - преобразуем в "query" только для searchTasks
        // Для getTasks оставляем filter как есть, нормализация обработает его позже
        if (paramName === 'filter' && toolName === 'searchTasks') {
          paramName = 'query';
        }

        // Пытаемся распарсить значение в зависимости от типа
        if (paramType === 'true' || paramValue === 'true' || paramValue === 'false') {
          parameters[paramName] = paramValue === 'true';
        } else if (!isNaN(paramValue) && paramValue !== '' && paramValue.trim() !== '') {
          // Проверяем, что это действительно число, а не строка с цифрами
          const numValue = Number(paramValue);
          if (!isNaN(numValue) && isFinite(numValue)) {
            parameters[paramName] = numValue;
          } else {
            parameters[paramName] = paramValue;
          }
        } else if (paramValue.startsWith('{') || paramValue.startsWith('[')) {
          try {
            parameters[paramName] = JSON.parse(paramValue);
          } catch {
            parameters[paramName] = paramValue;
          }
        } else {
          parameters[paramName] = paramValue;
        }
      }

      // Создаем tool call в формате OpenAI
      toolCalls.push({
        id: `call_${callId++}_${Date.now()}`,
        type: 'function',
        function: {
          name: toolName,
          arguments: JSON.stringify(parameters),
        },
      });
    }

    return { toolCalls, cleanedText };
  }

  async chatYandex(messages, tools = null) {
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

    // YandexGPT не поддерживает function calling напрямую, но мы можем добавить информацию о функциях в системный промпт
    if (tools && tools.length > 0) {
      const toolsDescription = tools.map(tool => 
        `- ${tool.name}: ${tool.description}`
      ).join('\n');
      
      if (requestBody.systemInstruction) {
        requestBody.systemInstruction.text += `\n\nДоступные инструменты:\n${toolsDescription}`;
      } else {
        requestBody.systemInstruction = {
          text: `Доступные инструменты:\n${toolsDescription}`,
        };
      }
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
      toolCalls: [], // YandexGPT не поддерживает function calling
      tokens: data.result?.usage?.totalTokens || 0,
      inputTokens: data.result?.usage?.inputTextTokens || 0,
      outputTokens: data.result?.usage?.completionTokens || 0,
    };
  }
}







import { AIResponse } from '../types/message';
import prompts from '../utils/prompts';

/**
 * Формат сообщения для AI модели
 */
export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  text?: string;
  content?: string;
}

/**
 * Параметры конфигурации для AI модели
 */
export interface AIModelConfig {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  apiProxyUrl?: string;
  model?: string;
  [key: string]: any; // Для дополнительных параметров конкретных моделей
}

/**
 * Базовый класс для AI моделей, работающих через прокси-сервер
 * Все конкретные реализации (YandexGPT, ChatGPT, DeepSeek и т.д.) наследуются от этого класса
 */
export abstract class AIModel {
  protected config: AIModelConfig;
  protected apiProxyUrl: string;
  protected model: string;

  constructor(config: AIModelConfig = {}, defaultProxyUrl: string, defaultModel: string) {
    this.config = {
      systemPrompt: prompts.default.system_prompt,
      temperature: 0.3,
      maxTokens: 2000,
      ...config,
    };
    this.apiProxyUrl = config.apiProxyUrl || defaultProxyUrl;
    this.model = config.model || defaultModel;
  }

  /**
   * Обновляет конфигурацию модели
   */
  updateConfig(config: Partial<AIModelConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.apiProxyUrl !== undefined) {
      this.apiProxyUrl = config.apiProxyUrl;
    }
    if (config.model !== undefined) {
      this.model = config.model;
    }
  }

  /**
   * Получает текущую конфигурацию модели
   */
  getConfig(): AIModelConfig {
    return { ...this.config };
  }

  /**
   * Валидирует и фильтрует сообщения
   */
  protected validateMessages(messages: AIMessage[]): Array<{ role: 'user' | 'assistant' | 'system'; text: string }> {
    const validMessages = messages
      .map((msg) => {
        const text = (msg.text || msg.content || '').trim();
        return text ? { role: msg.role, text } : null;
      })
      .filter((msg): msg is { role: 'user' | 'assistant' | 'system'; text: string } => msg !== null);

    if (validMessages.length === 0) {
      throw new Error('No valid messages to send');
    }

    return validMessages;
  }

  /**
   * Формирует базовое тело запроса
   */
  protected buildRequestBody(validMessages: Array<{ role: 'user' | 'assistant' | 'system'; text: string }>, additionalData?: Record<string, any>): Record<string, any> {
    return {
      system_prompt: this.config.systemPrompt || '',
      messages: validMessages,
      model: this.model,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      ...additionalData,
    };
  }

  /**
   * Выполняет запрос к прокси-серверу
   */
  protected async fetchFromProxy(body: Record<string, any>): Promise<{ 
    text: string;
    tokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
  }> {
    const response = await fetch(this.apiProxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.text) {
      throw new Error(`Invalid response format from ${this.constructor.name}`);
    }

    return {
      text: data.text,
      tokens: data.tokens,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      cost: data.cost,
    };
  }

  /**
   * Переопределяется в дочерних классах для добавления специфичных данных в запрос
   */
  protected getAdditionalRequestData(): Record<string, any> {
    return {};
  }

  /**
   * Отправляет запрос к AI модели через прокси-сервер
   */
  async sendMessage(messages: AIMessage[]): Promise<AIResponse> {
    try {
      const validMessages = this.validateMessages(messages);
      const requestBody = this.buildRequestBody(validMessages, this.getAdditionalRequestData());
      const data = await this.fetchFromProxy(requestBody);
      return this.parseResponse(data.text, data);
    } catch (error) {
      console.error(`${this.constructor.name} API error:`, error);
      throw error;
    }
  }

  /**
   * Конвертирует сообщения чата в формат, понятный для AI модели
   * Может быть переопределен в конкретных реализациях
   */
  convertMessages(
    messages: Array<{ type: 'user' | 'assistant'; content: string }>
  ): AIMessage[] {
    return messages
      .filter((msg) => msg.type === 'user' || msg.type === 'assistant')
      .map((msg) => ({
        role: msg.type,
        text: msg.content,
      }));
  }

  /**
   * Удаляет markdown блоки кода (```) в начале и конце текста
   * Может быть переопределен в конкретных реализациях
   */
  protected removeMarkdownCodeBlocks(text: string): string {
    let cleaned = text.trim();
    
    // Удаляем ```\n в начале
    if (cleaned.startsWith('```\n')) {
      cleaned = cleaned.substring(4);
    }
    
    // Удаляем \n``` в конце
    if (cleaned.endsWith('\n```')) {
      cleaned = cleaned.substring(0, cleaned.length - 4);
    }
    
    return cleaned.trim();
  }

  /**
   * Парсит ответ AI модели в формат AIResponse
   * Может быть переопределен в конкретных реализациях
   */
  protected parseResponse(
    text: string,
    metadata?: { tokens?: number; inputTokens?: number; outputTokens?: number; cost?: number }
  ): AIResponse {
    const cleanedText = this.removeMarkdownCodeBlocks(text);
    const trimmedText = cleanedText.trim();
    const isJsonResponse = trimmedText.startsWith('{') && trimmedText.endsWith('}');

    if (isJsonResponse) {
      try {
        const aiResponse: AIResponse = JSON.parse(cleanedText);
        
        // Валидация структуры ответа
        if (!aiResponse.content) {
          throw new Error('Missing content field in AI response');
        }

        // Устанавливаем значения по умолчанию, если они отсутствуют
        return {
          content: aiResponse.content,
          references: Array.isArray(aiResponse.references) ? aiResponse.references : [],
          difficulty: aiResponse.difficulty || 'intermediate',
          tokens: aiResponse.tokens ?? metadata?.tokens,
          inputTokens: aiResponse.inputTokens ?? metadata?.inputTokens,
          outputTokens: aiResponse.outputTokens ?? metadata?.outputTokens,
          cost: aiResponse.cost ?? metadata?.cost,
        };
      } catch (parseError) {
        // Если не удалось распарсить JSON, возвращаем как обычный текст
        console.warn('Failed to parse AI response as JSON, using as plain text:', parseError);
        return {
          content: cleanedText,
          references: [],
          tokens: metadata?.tokens,
          inputTokens: metadata?.inputTokens,
          outputTokens: metadata?.outputTokens,
          cost: metadata?.cost,
        };
      }
    } else {
      // Это обычный текст (вопросы от AI), возвращаем как есть без difficulty
      return {
        content: cleanedText,
        references: [],
        tokens: metadata?.tokens,
        inputTokens: metadata?.inputTokens,
        outputTokens: metadata?.outputTokens,
        cost: metadata?.cost,
      };
    }
  }
}


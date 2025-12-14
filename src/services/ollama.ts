/**
 * Реализация Ollama модели (локальная модель)
 */

import { AIModel, AIModelConfig } from './aiModel';
import { getOllamaPrompt } from '../utils/ollamaPrompts';

/**
 * Конфигурация для Ollama модели
 */
export interface OllamaConfig extends AIModelConfig {
  model?: string; // Название модели в Ollama (например, 'qwen2.5:0.5b')
  directUrl?: string; // Прямой URL к Ollama для офлайн работы (например, 'http://localhost:11434')
  enableOffline?: boolean; // Включить офлайн режим (прямое подключение к Ollama)
  // Дополнительные параметры Ollama
  numCtx?: number; // Размер контекстного окна
  topP?: number; // Top-p sampling (0.0-1.0)
  topK?: number; // Top-k sampling
  repeatPenalty?: number; // Штраф за повторения (обычно 1.0-1.5)
}

/**
 * Реализация Ollama модели с поддержкой офлайн режима
 * 
 * @example
 * const ollama = new OllamaModel({
 *   systemPrompt: 'Ты - помощник по программированию',
 *   model: 'qwen2.5:0.5b',
 *   enableOffline: false, // Работать через сервер
 * });
 */
export class OllamaModel extends AIModel {
  private directUrl: string;
  private enableOffline: boolean;

  constructor(config: OllamaConfig = {}) {
    // Применяем промпт по умолчанию для фронтенд разработки, если systemPrompt не указан
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9d8a48f6-a7a7-457d-8f84-950ddc4da809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ollama.ts:36',message:'OllamaModel constructor entry',data:{hasConfigSystemPrompt:!!config.systemPrompt,configSystemPromptLength:config.systemPrompt?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const defaultSystemPrompt = getOllamaPrompt();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9d8a48f6-a7a7-457d-8f84-950ddc4da809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ollama.ts:39',message:'After getOllamaPrompt call',data:{defaultSystemPromptLength:defaultSystemPrompt.length,willUseDefault:!config.systemPrompt},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const finalConfig = {
      ...config,
      systemPrompt: config.systemPrompt || defaultSystemPrompt,
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9d8a48f6-a7a7-457d-8f84-950ddc4da809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ollama.ts:42',message:'Final config systemPrompt',data:{finalSystemPromptLength:finalConfig.systemPrompt.length,finalSystemPromptPreview:finalConfig.systemPrompt.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    super(
      finalConfig,
      import.meta.env.VITE_OLLAMA_PROXY_URL || 'http://localhost:3001/api/ollama',
      config.model || import.meta.env.VITE_OLLAMA_DEFAULT_MODEL || 'qwen2.5:0.5b'
    );
    
    // URL для прямого подключения к Ollama (для офлайн режима)
    const envDirectUrl = import.meta.env.VITE_OLLAMA_DIRECT_URL;
    this.directUrl = config.directUrl || 
                     (envDirectUrl ? String(envDirectUrl) : undefined) || 
                     'http://localhost:11434';
    
    // Включить офлайн режим по умолчанию для локальной модели
    const envOfflineMode = import.meta.env.VITE_OLLAMA_OFFLINE_MODE;
    const isOfflineModeEnabled = envOfflineMode === 'true' || envOfflineMode === true;
    
    this.enableOffline = config.enableOffline !== undefined 
      ? config.enableOffline 
      : isOfflineModeEnabled;
    
    // Отладочная информация
    console.log('[OllamaModel] Конфигурация:', {
      directUrl: this.directUrl,
      enableOffline: this.enableOffline,
      envDirectUrl,
      envOfflineMode,
      configDirectUrl: config.directUrl,
      configEnableOffline: config.enableOffline,
    });
  }

  /**
   * Переопределяем buildRequestBody для передачи дополнительных параметров Ollama
   */
  protected buildRequestBody(validMessages: Array<{ role: 'user' | 'assistant' | 'system'; text: string }>, additionalData?: Record<string, any>): Record<string, any> {
    const baseBody = super.buildRequestBody(validMessages, additionalData);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9d8a48f6-a7a7-457d-8f84-950ddc4da809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ollama.ts:88',message:'buildRequestBody called',data:{hasSystemPrompt:!!baseBody.system_prompt,systemPromptLength:baseBody.system_prompt?.length||0,configSystemPromptLength:this.config.systemPrompt?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    // Добавляем Ollama-специфичные параметры
    return {
      ...baseBody,
      ...(this.config.numCtx !== undefined && { num_ctx: this.config.numCtx }),
      ...(this.config.topP !== undefined && { top_p: this.config.topP }),
      ...(this.config.topK !== undefined && { top_k: this.config.topK }),
      ...(this.config.repeatPenalty !== undefined && { repeat_penalty: this.config.repeatPenalty }),
    };
  }

  /**
   * Переопределяем fetchFromProxy для поддержки офлайн режима
   * Если сервер недоступен, обращаемся напрямую к Ollama
   */
  protected async fetchFromProxy(body: Record<string, any>): Promise<{ 
    text: string;
    tokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    usedTools?: Array<{ name: string; args?: any; timestamp?: string; error?: string }>;
  }> {
    console.log('[OllamaModel] fetchFromProxy вызван, enableOffline:', this.enableOffline);
    
    // Если включен офлайн режим или сервер недоступен, используем прямое подключение
    if (this.enableOffline) {
      console.log('[OllamaModel] Офлайн режим включен, используем прямое подключение к', this.directUrl);
      try {
        const result = await this.fetchDirectly(body);
        console.log('[OllamaModel] Прямое подключение успешно');
        return result;
      } catch (error) {
        // Если прямое подключение не удалось, пробуем через сервер как fallback
        console.warn('[OllamaModel] Прямое подключение к Ollama не удалось, пробуем через сервер:', error);
        try {
          const result = await super.fetchFromProxy(body);
          console.log('[OllamaModel] Подключение через сервер успешно');
          return result;
        } catch (serverError) {
          console.error('[OllamaModel] Оба способа подключения не удались');
          throw new Error(`Не удалось подключиться к Ollama. Убедитесь, что Ollama запущен и доступен по адресу ${this.directUrl}. Ошибка: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Обычный режим: сначала пробуем через сервер
    try {
      return await super.fetchFromProxy(body);
    } catch (error: any) {
      // Если сервер недоступен (сетевая ошибка или offline режим), пробуем прямое подключение как fallback
      const isNetworkError = error?.isNetworkError || 
                            error instanceof TypeError || 
                            (error.message && (
                              error.message.includes('Failed to fetch') || 
                              error.message.includes('NetworkError') ||
                              error.message.includes('Network request failed') ||
                              error.message.includes('Сервер недоступен')
                            ));
      
      if (isNetworkError) {
        console.warn('Сервер недоступен, пробуем прямое подключение к Ollama');
        try {
          return await this.fetchDirectly(body);
        } catch (directError) {
          throw new Error(`Не удалось подключиться ни к серверу, ни к Ollama напрямую. Убедитесь, что Ollama запущен и доступен по адресу ${this.directUrl}. Ошибка: ${directError instanceof Error ? directError.message : String(directError)}`);
        }
      }
      throw error;
    }
  }

  /**
   * Прямое подключение к Ollama (для офлайн режима)
   */
  private async fetchDirectly(body: Record<string, any>): Promise<{ 
    text: string;
    tokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    usedTools?: Array<{ name: string; args?: any; timestamp?: string; error?: string }>;
  }> {
    // Получаем список доступных моделей, если модель не указана или '__auto__'
    let modelName = body.model || this.model;
    if (!modelName || modelName === '__auto__') {
      try {
        const baseUrl = this.directUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
        const modelsUrl = `${baseUrl}/api/tags`;
        const modelsResponse = await fetch(modelsUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          const availableModels = modelsData.models || [];
          if (availableModels.length > 0) {
            // Берем первую модель
            modelName = availableModels[0].name;
          }
        }
      } catch (error) {
        console.warn('Не удалось получить список моделей, используем дефолтную:', error);
      }
      
      if (!modelName || modelName === '__auto__') {
        modelName = 'qwen2.5:0.5b';
      }
    }

    // Формируем сообщения в формате Ollama
    const messages = (body.messages || []).map((msg: any) => ({
      role: msg.role || 'user',
      content: msg.text || msg.content || '',
    }));

    // Добавляем system prompt как отдельное сообщение, если есть
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9d8a48f6-a7a7-457d-8f84-950ddc4da809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ollama.ts:200',message:'Before adding system prompt to messages',data:{hasSystemPrompt:!!body.system_prompt,systemPromptLength:body.system_prompt?.length||0,systemPromptPreview:body.system_prompt?.substring(0,50)||'none'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (body.system_prompt) {
      messages.unshift({
        role: 'system',
        content: body.system_prompt,
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9d8a48f6-a7a7-457d-8f84-950ddc4da809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ollama.ts:205',message:'System prompt added to messages',data:{messagesCount:messages.length,firstMessageRole:messages[0].role,firstMessageContentLength:messages[0].content.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9d8a48f6-a7a7-457d-8f84-950ddc4da809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ollama.ts:207',message:'No system prompt in body',data:{bodyKeys:Object.keys(body)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
    }

    const baseUrl = this.directUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
    const apiUrl = `${baseUrl}/api/chat`;
    
    // Формируем options с поддержкой всех параметров
    const options: Record<string, any> = {
      temperature: body.temperature !== undefined ? body.temperature : (this.config.temperature || 0.7),
      num_predict: body.max_tokens || this.config.maxTokens || 2000,
    };

    // Добавляем дополнительные параметры Ollama, если они указаны
    if (body.num_ctx !== undefined || body.context_window !== undefined || this.config.numCtx !== undefined) {
      options.num_ctx = body.num_ctx || body.context_window || this.config.numCtx || 2048;
    }
    if (body.top_p !== undefined || this.config.topP !== undefined) {
      options.top_p = body.top_p !== undefined ? body.top_p : this.config.topP;
    }
    if (body.top_k !== undefined || this.config.topK !== undefined) {
      options.top_k = body.top_k !== undefined ? body.top_k : this.config.topK;
    }
    if (body.repeat_penalty !== undefined || this.config.repeatPenalty !== undefined) {
      options.repeat_penalty = body.repeat_penalty !== undefined ? body.repeat_penalty : this.config.repeatPenalty;
    }

    const requestBody = {
      model: modelName,
      messages: messages,
      options,
      stream: false,
    };
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9d8a48f6-a7a7-457d-8f84-950ddc4da809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ollama.ts:251',message:'Before sending request to Ollama API',data:{messagesCount:messages.length,firstMessageRole:messages[0]?.role,firstMessageContentLength:messages[0]?.content?.length||0,hasSystemMessage:messages[0]?.role==='system',requestBodyPreview:JSON.stringify(requestBody).substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.error || errorText;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}`;
      }
      
      throw new Error(`Ollama API error: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();
    
    // Ollama возвращает ответ в формате { message: { content: "...", role: "..." }, ... }
    if (!data.message?.content) {
      throw new Error('Invalid response format from Ollama API');
    }

    const text = data.message.content;
    const usage = {
      prompt_tokens: data.prompt_eval_count || 0,
      completion_tokens: data.eval_count || 0,
      total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
    };

    return {
      text,
      tokens: usage.total_tokens,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      // Ollama не предоставляет информацию о стоимости
    };
  }
}

/**
 * Создает экземпляр Ollama модели
 */
export const createOllamaModel = (config?: OllamaConfig): OllamaModel => {
  return new OllamaModel(config);
};


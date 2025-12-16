import { handleApiError, sendErrorResponse } from '../utils/errorHandler.js';
import { formatOpenAIMessages, enrichSystemPromptWithPersonalization } from '../utils/messageFormatter.js';
import fs from 'fs';
import path from 'path';

/**
 * Нормализует базовый URL для Ollama
 */
function normalizeOllamaUrl(url) {
  if (!url) return 'http://localhost:11434';
  
  let normalized = url.trim();
  
  // Убираем пути к конкретным эндпоинтам
  normalized = normalized.replace(/\/api\/chat.*$/, '');
  normalized = normalized.replace(/\/api\/tags.*$/, '');
  normalized = normalized.replace(/\/v1\/?$/, '');
  
  // Убираем завершающий слэш
  normalized = normalized.replace(/\/$/, '');
  
  return normalized;
}

/**
 * Обработчик для Ollama (локальная модель через OpenAI-совместимый API)
 * Ollama работает на http://host:11434/api/chat
 */
export async function handleOllama(req, res) {
  try {
    const { 
      messages, 
      system_prompt, 
      model, 
      temperature, 
      max_tokens,
      userId,
      // Дополнительные параметры Ollama
      num_ctx,
      context_window,
      top_p,
      top_k,
      repeat_penalty,
    } = req.body;
    
    // #region agent log
    const logPath = path.join(process.cwd(), '.cursor', 'debug.log');
    const logEntry = JSON.stringify({location:'ollama.js:29',message:'handleOllama received request',data:{hasSystemPrompt:!!system_prompt,systemPromptLength:system_prompt?.length||0,systemPromptPreview:system_prompt?.substring(0,50)||'none'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n';
    fs.appendFileSync(logPath, logEntry, 'utf8');
    // #endregion
    
    // Получаем userId из body или из req (если есть middleware авторизации)
    const finalUserId = userId || req.userId || null;
    
    // Обогащаем системный промпт персонализацией
    const personalizedSystemPrompt = await enrichSystemPromptWithPersonalization(
      system_prompt || '', 
      finalUserId
    );
    
    // Базовый URL для Ollama
    const ollamaUrl = process.env.OLLAMA_URL || process.env.LM_STUDIO_URL || 'http://localhost:11434';
    const normalizedBaseUrl = normalizeOllamaUrl(ollamaUrl);
    const apiUrl = `${normalizedBaseUrl}/api/chat`;
    
    // Формируем сообщения для API
    const formattedMessages = formatOpenAIMessages(messages, personalizedSystemPrompt);
    
    // #region agent log
    const logEntry2 = JSON.stringify({location:'ollama.js:49',message:'After formatOpenAIMessages',data:{formattedMessagesCount:formattedMessages.length,firstMessageRole:formattedMessages[0]?.role,firstMessageContentLength:formattedMessages[0]?.content?.length||0,hasSystemMessage:formattedMessages[0]?.role==='system'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})+'\n';
    fs.appendFileSync(logPath, logEntry2, 'utf8');
    // #endregion
    
    // Модель по умолчанию
    const modelName = model || process.env.OLLAMA_MODEL || process.env.LM_STUDIO_MODEL || 'qwen2.5:0.5b';

    // Формируем options объект с поддержкой всех параметров Ollama
    const options = {
      temperature: temperature !== undefined ? temperature : 0.7,
      num_predict: max_tokens || 2000,
    };

    // Добавляем дополнительные параметры, если они указаны
    if (num_ctx !== undefined || context_window !== undefined) {
      options.num_ctx = num_ctx || context_window || 2048;
    }
    if (top_p !== undefined) {
      options.top_p = top_p;
    }
    if (top_k !== undefined) {
      options.top_k = top_k;
    }
    if (repeat_penalty !== undefined) {
      options.repeat_penalty = repeat_penalty;
    }

    const requestBody = {
      model: modelName,
      messages: formattedMessages,
      options,
      stream: false, // Отключаем streaming для простоты
    };

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
      
      // Если ошибка связана с моделью, пытаемся получить список доступных моделей
      if (errorMessage.includes('model') || errorMessage.includes('Model')) {
        try {
          const availableModels = await getAvailableModels(normalizedBaseUrl);
          if (availableModels.length > 0) {
            const modelList = availableModels.map(m => m.name).join(', ');
            errorMessage += `\n\nДоступные модели в Ollama: ${modelList}\n\nУбедитесь, что модель загружена в Ollama и используйте точное имя модели из списка выше.`;
          } else {
            errorMessage += '\n\nУбедитесь, что:\n1. Ollama запущен\n2. Модель загружена в Ollama (например: ollama pull qwen2.5:0.5b)';
          }
        } catch (e) {
          // Игнорируем ошибку получения списка моделей
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    // Ollama возвращает ответ в формате { message: { content: "...", role: "..." }, ... }
    const text = data.message?.content || '';
    const usage = {
      prompt_tokens: data.prompt_eval_count || 0,
      completion_tokens: data.eval_count || 0,
      total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
    };

    res.json({
      text,
      tokens: usage.total_tokens,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
    });
  } catch (error) {
    sendErrorResponse(res, error, 'Произошла ошибка при обращении к Ollama. Убедитесь, что Ollama запущен и модель загружена.');
  }
}

/**
 * Получает список доступных моделей из Ollama
 */
async function getAvailableModels(baseUrl) {
  try {
    const apiUrl = `${baseUrl}/api/tags`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.models || [];
    }
    return [];
  } catch (error) {
    console.warn('Не удалось получить список моделей из Ollama:', error.message);
    return [];
  }
}

/**
 * Эндпоинт для получения списка доступных моделей в Ollama
 */
export async function getOllamaModels(req, res) {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || process.env.LM_STUDIO_URL || 'http://localhost:11434';
    const normalizedBaseUrl = normalizeOllamaUrl(ollamaUrl);
    const models = await getAvailableModels(normalizedBaseUrl);
    
    res.json({ 
      models: models.map(m => ({ 
        id: m.name, 
        name: m.name,
        size: m.size,
        modified_at: m.modified_at,
      })) 
    });
  } catch (error) {
    sendErrorResponse(res, error, 'Не удалось получить список моделей из Ollama');
  }
}


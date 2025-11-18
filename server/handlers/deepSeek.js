import { convertLocalMCPToolsToOpenAI, callLocalMCPTool } from '../utils/localMCP.js';
import { formatOpenAIMessages } from '../utils/messageFormatter.js';

/**
 * Обработчик для DeepSeek с поддержкой MCP
 */
export async function handleDeepSeek(req, res) {
  try {
    const { messages, system_prompt, model, temperature, max_tokens, enableMCP } = req.body;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    
    // Валидация API ключа
    if (!apiKey) {
      return res.status(400).json({
        error: 'DEEPSEEK_API_KEY не установлен в переменных окружения',
      });
    }

    // Формируем сообщения для API используя существующую утилиту
    const formattedMessages = formatOpenAIMessages(messages, system_prompt);

    const requestBody = {
      model: model || 'deepseek-chat',
      messages: formattedMessages,
      temperature: temperature || 0.3,
      max_tokens: max_tokens || 2000,
    };

    // Добавляем MCP tools если включено
    if (enableMCP) {
      const openAITools = await convertLocalMCPToolsToOpenAI();
      requestBody.tools = openAITools;
      requestBody.tool_choice = 'auto';
    }

    // Выполняем запрос с поддержкой tool_calls
    let responseData = await processChatCompletion(apiKey, requestBody, enableMCP);

    res.json(responseData);
  } catch (error) {
    console.error('DeepSeek API error:', error);
    res.status(500).json({
      error: `Произошла ошибка при обращении к DeepSeek: ${error.message}`,
    });
  }
}

/**
 * Обрабатывает chat completion с поддержкой tool_calls
 */
async function processChatCompletion(apiKey, requestBody, enableMCP, maxIterations = 5) {
  let iteration = 0;
  let allMessages = [...requestBody.messages];
  let finalText = '';
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  while (iteration < maxIterations) {
    const currentRequestBody = {
      ...requestBody,
      messages: allMessages,
    };

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(currentRequestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    // Обновляем счетчики токенов
    if (data.usage) {
      totalInputTokens += data.usage.prompt_tokens || 0;
      totalOutputTokens += data.usage.completion_tokens || 0;
    }

    // Добавляем ответ модели в историю
    allMessages.push(message);

    // Проверяем, есть ли tool_calls
    if (message.tool_calls && message.tool_calls.length > 0 && enableMCP) {
      // Выполняем вызовы инструментов
      const toolResults = [];
      
      for (const toolCall of message.tool_calls) {
        try {
          const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          console.log(`[DeepSeek] Вызов локального MCP tool: ${toolCall.function.name} с аргументами:`, JSON.stringify(toolArgs, null, 2));
          
          const toolResult = await callLocalMCPTool(toolCall.function.name, toolArgs);
          
          console.log(`[DeepSeek] Результат локального MCP tool ${toolCall.function.name}:`, JSON.stringify(toolResult, null, 2));
          
          // Форматируем результат
          let content;
          if (typeof toolResult === 'string') {
            content = toolResult;
          } else if (toolResult && typeof toolResult === 'object') {
            try {
              // Для createTask проверяем наличие ID
              if (toolCall.function.name === 'createTask' && toolResult.id) {
                content = `Задача успешно создана!\n\nID задачи: ${toolResult.id}\nНазвание: ${toolResult.content || toolResult.title || 'N/A'}\n\nПолная информация:\n${JSON.stringify(toolResult, null, 2)}`;
              } else {
                content = JSON.stringify(toolResult, null, 2);
              }
            } catch {
              content = String(toolResult);
            }
          } else {
            content = String(toolResult);
          }
          
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content,
          });
        } catch (error) {
          // Формируем информативное сообщение об ошибке
          const errorMessage = error.message || 'Неизвестная ошибка';
          console.error(`[DeepSeek] Ошибка при вызове локального MCP tool ${toolCall.function.name}:`, errorMessage);
          
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: `Ошибка при вызове инструмента ${toolCall.function.name}: ${errorMessage}`,
          });
        }
      }

      // Добавляем результаты инструментов в историю
      allMessages.push(...toolResults);
      
      // Продолжаем итерацию для получения финального ответа
      iteration++;
      continue;
    } else {
      // Нет tool_calls, возвращаем финальный ответ
      finalText = message.content || '';
      break;
    }
  }

  return {
    text: finalText,
    tokens: totalInputTokens + totalOutputTokens,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}



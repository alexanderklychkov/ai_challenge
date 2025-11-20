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

    // Убеждаемся, что responseData содержит поле text
    if (!responseData || typeof responseData.text === 'undefined') {
      console.error('[DeepSeek] Response data missing text field:', JSON.stringify(responseData, null, 2));
      return res.status(500).json({
        error: 'Ошибка: сервер вернул неожиданный формат ответа',
        text: 'Произошла ошибка при обработке запроса. Попробуйте еще раз.',
      });
    }

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
async function processChatCompletion(apiKey, requestBody, enableMCP, maxIterations = 10) {
  let iteration = 0;
  let allMessages = [...requestBody.messages];
  let finalText = '';
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const usedTools = []; // Отслеживаем использованные инструменты
  let consecutiveToolCalls = 0; // Счетчик последовательных вызовов инструментов

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
    
    // Проверяем наличие choices
    if (!data.choices || !data.choices[0]) {
      throw new Error('DeepSeek API вернул неожиданный формат ответа: отсутствуют choices');
    }
    
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
      consecutiveToolCalls++;
      
      // Выполняем вызовы инструментов
      const toolResults = [];
      
      for (const toolCall of message.tool_calls) {
        try {
          const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          console.log(`[DeepSeek] Вызов локального MCP tool: ${toolCall.function.name} с аргументами:`, JSON.stringify(toolArgs, null, 2));
          
          // Отслеживаем использование инструмента
          usedTools.push({
            name: toolCall.function.name,
            args: toolArgs,
            timestamp: new Date().toISOString(),
          });
          
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
          
          // Отслеживаем использование инструмента даже при ошибке
          usedTools.push({
            name: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments || '{}'),
            timestamp: new Date().toISOString(),
            error: errorMessage,
          });
          
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: `Ошибка при вызове инструмента ${toolCall.function.name}: ${errorMessage}`,
          });
        }
      }

      // Добавляем результаты инструментов в историю
      // ВАЖНО: tool responses должны идти сразу после assistant message с tool_calls
      allMessages.push(...toolResults);
      
      // Если приближаемся к максимальному количеству итераций или модель слишком много раз вызывает инструменты,
      // добавляем системное сообщение ПЕРЕД следующим запросом (не между tool_calls и tool responses)
      if ((iteration >= maxIterations - 2 || consecutiveToolCalls >= 3) && iteration < maxIterations - 1) {
        // Добавляем сообщение только после всех tool responses
        allMessages.push({
          role: 'user',
          content: 'Ты уже выполнил несколько инструментов. Пожалуйста, дай финальный ответ пользователю на основе результатов. Не вызывай больше инструментов, просто дай текстовый ответ.',
        });
        consecutiveToolCalls = 0; // Сбрасываем счетчик
      }
      
      // Продолжаем итерацию для получения финального ответа
      iteration++;
      continue;
    } else {
      // Нет tool_calls, возвращаем финальный ответ
      consecutiveToolCalls = 0; // Сбрасываем счетчик при получении текстового ответа
      finalText = message.content || '';
      break;
    }
  }

  // Если достигли максимального количества итераций без финального ответа
  if (!finalText && iteration >= maxIterations) {
    // Делаем последнюю попытку получить финальный ответ без инструментов
    try {
      allMessages.push({
        role: 'user',
        content: 'Пожалуйста, дай финальный ответ на основе всех выполненных инструментов. Не вызывай больше инструментов.',
      });
      
      const finalRequestBody = {
        ...requestBody,
        messages: allMessages,
        tools: undefined, // Убираем инструменты для финального запроса
        tool_choice: undefined,
      };
      
      const finalResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(finalRequestBody),
      });
      
      if (finalResponse.ok) {
        const finalData = await finalResponse.json();
        if (finalData.choices && finalData.choices[0] && finalData.choices[0].message) {
          finalText = finalData.choices[0].message.content || '';
          if (finalData.usage) {
            totalInputTokens += finalData.usage.prompt_tokens || 0;
            totalOutputTokens += finalData.usage.completion_tokens || 0;
          }
        }
      }
    } catch (error) {
      console.error('[DeepSeek] Ошибка при финальном запросе:', error);
    }
    
    // Если все еще нет ответа, формируем сводку
    if (!finalText) {
      const toolsSummary = usedTools.length > 0 
        ? `\n\nИспользованные инструменты:\n${usedTools.map(t => `- ${t.name}${t.error ? ' (ошибка: ' + t.error + ')' : ''}`).join('\n')}`
        : '';
      
      // Если были выполнены инструменты, формируем ответ на основе их результатов
      if (usedTools.length > 0) {
        // Берем последние результаты инструментов из истории
        const lastToolResults = allMessages
          .filter(m => m.role === 'tool')
          .slice(-usedTools.length)
          .map(m => `${m.name}: ${typeof m.content === 'string' ? m.content.substring(0, 300) : JSON.stringify(m.content).substring(0, 300)}`)
          .join('\n\n');
        
        finalText = `Выполнены следующие действия:${toolsSummary}\n\nРезультаты выполнения инструментов:\n${lastToolResults}`;
      } else {
        finalText = `Достигнуто максимальное количество итераций (${maxIterations}). Возможно, требуется больше времени для обработки.${toolsSummary}`;
      }
    }
  }

  // Убеждаемся, что finalText не пустой
  if (!finalText) {
    finalText = 'Получен пустой ответ от модели.';
  }

  return {
    text: finalText,
    tokens: totalInputTokens + totalOutputTokens,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    usedTools: usedTools.length > 0 ? usedTools : undefined, // Добавляем информацию об использованных инструментах
  };
}



import { AIModel, AIMessage } from '../services/aiModel';
import { Message } from '../types/message';
import { AIResponse } from '../types/message';
import { queryWithRAG } from '../services/rag';
import { callMCPTool } from '../services/mcp';

/**
 * Тип команды
 */
export type CommandType = 'analyze' | 'help';

/**
 * Результат обработки команды
 */
export interface CommandResult {
  isCommand: boolean;
  commandType?: CommandType;
  args?: string[];
}

/**
 * Проверяет, является ли текст командой
 */
export function parseCommand(text: string): CommandResult {
  const trimmed = text.trim();
  
  if (!trimmed.startsWith('/')) {
    return { isCommand: false };
  }

  const parts = trimmed.split(/\s+/);
  const commandName = parts[0].substring(1).toLowerCase();
  const args = parts.slice(1);

  // Определяем тип команды
  if (commandName === 'analyze' || commandName === 'анализ') {
    return { isCommand: true, commandType: 'analyze', args };
  }
  
  if (commandName === 'help' || commandName === 'помощь') {
    return { isCommand: true, commandType: 'help', args };
  }

  return { isCommand: true, commandType: undefined, args };
}

/**
 * Выполняет команду /analyze
 * Анализирует последние ответы моделей и создает сводный анализ
 */
export async function executeAnalyzeCommand(
  analyzerModel: AIModel,
  messages: Message[],
  modelName: string = 'Анализатор'
): Promise<AIResponse> {
  // Находим последние ответы от моделей (не команды и не системные сообщения)
  const recentAssistantMessages = messages
    .filter(msg => msg.type === 'assistant' && msg.modelName)
    .slice(-10); // Берем последние 10 ответов

  if (recentAssistantMessages.length === 0) {
    return {
      content: 'Нет ответов для анализа. Сначала задайте вопрос моделям.',
      references: [],
    };
  }

  // Формируем промпт для анализа
  const analysisPrompt = `Проанализируй и сравни качество ответов различных AI моделей на вопросы пользователя.

Вот последние ответы моделей:

${recentAssistantMessages.map((msg, index) => `
${index + 1}. Модель: ${msg.modelName}
   Время ответа: ${msg.aiResponse?.responseTime ? (msg.aiResponse.responseTime / 1000).toFixed(2) + 'с' : 'неизвестно'}
   Токенов: ${msg.aiResponse?.tokens || 'неизвестно'}
   Стоимость: ${msg.aiResponse?.cost ? '$' + msg.aiResponse.cost.toFixed(6) : 'неизвестно'}
   Ответ:
   ${msg.content}
`).join('\n---\n')}

Проведи детальный анализ:
1. Сравни качество ответов по точности, полноте и релевантности
2. Оцени скорость работы каждой модели
3. Сравни стоимость использования (если доступна)
4. Выдели сильные и слабые стороны каждого ответа
5. Дай рекомендации: какая модель лучше подходит для каких типов вопросов
6. Укажи, есть ли существенные различия в ответах

Представь анализ в структурированном виде с четкими выводами.`;

  const aiMessages: AIMessage[] = [
    {
      role: 'user',
      text: analysisPrompt,
    },
  ];

  const startTime = performance.now();
  const response = await analyzerModel.sendMessage(aiMessages);
  const endTime = performance.now();
  const responseTime = endTime - startTime;

  return {
    ...response,
    responseTime: response.responseTime ?? responseTime,
  };
}

/**
 * Выполняет команду /help
 * Использует RAG для ответов на вопросы о проекте
 * Если вопрос не задан, показывает список команд
 */
export async function executeHelpCommand(
  args: string[] = [],
  modelType: 'deepseek' | 'yandex' | 'chatgpt' | 'huggingface' = 'deepseek',
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    system_prompt?: string;
  }
): Promise<AIResponse> {
  // Если вопрос не задан, показываем список команд
  if (args.length === 0) {
    return {
      content: `# Доступные команды

## /analyze (или /анализ)
Анализирует и сравнивает качество последних ответов моделей.
- Сравнивает точность, полноту и релевантность ответов
- Оценивает скорость работы моделей
- Сравнивает стоимость использования
- Дает рекомендации по выбору модели

## /help (или /помощь)
Показывает этот список команд или отвечает на вопросы о проекте.

**Использование:**
- \`/help\` - показать список команд
- \`/help <вопрос>\` - получить ответ на вопрос о структуре проекта, API, архитектуре и т.д.

**Примеры:**
- \`/help Как работает RAG система?\`
- \`/help Какие API эндпоинты доступны?\`
- \`/help Расскажи о структуре проекта\`

---
*Команды начинаются с символа "/"*`,
      references: [],
    };
  }

  // Если задан вопрос, используем RAG для поиска ответа
  const question = args.join(' ');
  
  // Определяем, нужно ли вызывать MCP инструменты
  const questionLower = question.toLowerCase();
  const needsGitBranch = 
    questionLower.includes('ветк') || 
    questionLower.includes('branch') || 
    (questionLower.includes('git') && (questionLower.includes('текущ') || questionLower.includes('current'))) ||
    questionLower.includes('выведи текущую ветку') ||
    questionLower.includes('покажи текущую ветку') ||
    questionLower.includes('какая ветка');
  
  try {
    // Если нужна информация о git ветке, вызываем MCP инструмент
    let mcpResult = null;
    if (needsGitBranch) {
      try {
        const gitResult = await callMCPTool('getCurrentBranch', {}, 'github-mcp-server');
        if (gitResult.result && gitResult.result.success && gitResult.result.result) {
          mcpResult = {
            tool: 'getCurrentBranch',
            result: gitResult.result.result, // Это строка с названием ветки
            serverName: gitResult.serverName || 'GitHub MCP Server',
          };
        }
      } catch (error) {
        console.warn('Ошибка при вызове GitHub MCP инструмента:', error);
        // Продолжаем с RAG, даже если MCP не сработал
      }
    }
    
    // Всегда используем RAG/LLM для форматирования ответа, но передаем информацию от MCP в контекст
    let ragQuestion = question;
    let ragSystemPrompt = options?.system_prompt || 'Ты помощник по проекту AIMentor. Отвечай на вопросы о структуре проекта, API, архитектуре и использовании, основываясь на документации проекта.';
    
    // Если MCP вернул результат, добавляем его в контекст для LLM
    if (mcpResult && mcpResult.tool === 'getCurrentBranch') {
      ragSystemPrompt += `\n\nВАЖНО: Информация о текущей git ветке уже получена через MCP инструмент: "${mcpResult.result}". Используй эту информацию для ответа. Не пытайся найти эту информацию в документах - она уже известна. Просто используй эту информацию для ответа на вопрос пользователя.`;
      
      // Модифицируем вопрос, чтобы LLM понимал, что информация уже есть
      ragQuestion = `${question}\n\n[Контекст: Текущая git ветка = ${mcpResult.result}]`;
    }
    
    // Всегда вызываем RAG для форматирования ответа через LLM
    const ragResult = await queryWithRAG(
      ragQuestion,
      modelType,
      {
        topK: mcpResult ? 3 : 5, // Если есть MCP результат, берем меньше чанков
        minScore: 0.3,
        model: options?.model,
        temperature: options?.temperature || 0.3,
        max_tokens: options?.max_tokens || 2000,
        system_prompt: ragSystemPrompt,
      }
    );

    // Формируем ответ - LLM уже отформатировал его с учетом информации от MCP
    let content = ragResult.answer;

    // Удаляем секцию "Источники" из ответа, если она есть (добавлена LLM или RAG)
    content = content.replace(/\n\n---\n\n### 📚 Источники[\s\S]*?(?=\n\n|$)/gi, '');
    content = content.replace(/\n\n### 📚 Источники[\s\S]*?(?=\n\n|$)/gi, '');
    content = content.replace(/📚 Источники[\s\S]*?(?=\n\n|$)/gi, '');
    content = content.replace(/\n\n---\n\n###\s*[Ии]сточник[иы]?[\s\S]*?(?=\n\n|$)/gi, '');
    content = content.replace(/\n\n###\s*[Ии]сточник[иы]?[\s\S]*?(?=\n\n|$)/gi, '');

    // Добавляем информацию о том, что использовался MCP инструмент
    if (mcpResult) {
      content += `\n\n*Информация о git ветке получена через ${mcpResult.serverName || 'GitHub MCP Server'}*`;
    }

    // Добавляем предупреждение только если нет релевантных чанков И нет MCP результата
    if (ragResult.warning && !mcpResult) {
      content += `\n\n⚠️ ${ragResult.warning}`;
    }

    return {
      content,
      // Не возвращаем информацию о релевантных чанках, если использовался MCP сервер
      references: mcpResult ? [] : (ragResult.chunks?.map(chunk => ({
        text: chunk.text,
        source: chunk.source,
        score: chunk.score,
      })) || []),
    };
  } catch (error) {
    // В случае ошибки возвращаем базовую справку
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    return {
      content: `# Ошибка при выполнении команды /help

Не удалось получить ответ через RAG: ${errorMessage}

**Доступные команды:**

## /analyze (или /анализ)
Анализирует и сравнивает качество последних ответов моделей.

## /help (или /помощь)
Показывает этот список команд или отвечает на вопросы о проекте.

---
*Попробуйте запустить сервер и убедитесь, что RAG система настроена правильно.*`,
      references: [],
    };
  }
}


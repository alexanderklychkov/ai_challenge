/**
 * Парсит сообщение и извлекает информацию о созданных элементах обучения
 */

export interface LearningContent {
  testId?: string;
  flashcardSetId?: string;
  studyPlanId?: string;
}

/**
 * Парсит сообщение и ищет упоминания о созданных элементах обучения
 * Ищет паттерны типа: "test-123", "set-456", "plan-789" или JSON объекты
 */
export function parseLearningContent(content: string): LearningContent | null {
  const result: LearningContent = {};

  // Ищем test ID в различных форматах
  const testPatterns = [
    /(?:test-|ID теста[:\s]+|testId[:\s"]+|id[:\s"]+)([a-zA-Z0-9_-]{10,})/i,
    /тест[^\s]*\s+([a-zA-Z0-9_-]{10,})/i, // "тест test-1234567890-abc123"
    /test[_-](\d{13,}[a-zA-Z0-9_-]*)/i, // "test-1763653524691-4hx6zr0"
    /"id"\s*:\s*"([^"]+)"[^}]*"test"/i, // JSON с test
  ];
  
  for (const pattern of testPatterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[1].length > 5) {
      result.testId = match[1];
      break;
    }
  }

  // Ищем flashcard set ID
  const flashcardPatterns = [
    /(?:setId[:\s"]+|set-|ID набора карточек[:\s]+|id[:\s"]+)([a-zA-Z0-9_-]{10,})/i,
    /набор[^\s]*\s+([a-zA-Z0-9_-]{10,})/i,
    /set[_-](\d{13,}[a-zA-Z0-9_-]*)/i,
    /"setId"\s*:\s*"([^"]+)"/i, // JSON с setId
  ];
  
  for (const pattern of flashcardPatterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[1].length > 5) {
      result.flashcardSetId = match[1];
      break;
    }
  }

  // Ищем study plan ID
  const planPatterns = [
    /(?:planId[:\s"]+|plan-|ID плана[:\s]+|id[:\s"]+)([a-zA-Z0-9_-]{10,})/i,
    /план[^\s]*\s+([a-zA-Z0-9_-]{10,})/i,
    /plan[_-](\d{13,}[a-zA-Z0-9_-]*)/i,
    /"planId"\s*:\s*"([^"]+)"/i, // JSON с planId
    /"id"\s*:\s*"([^"]+)"[^}]*"plan"/i, // JSON с plan
  ];
  
  for (const pattern of planPatterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[1].length > 5) {
      result.studyPlanId = match[1];
      break;
    }
  }

  // Пытаемся распарсить JSON в сообщении
  try {
    // Ищем JSON блоки в сообщении (более гибкий паттерн)
    const jsonMatches = content.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
    if (jsonMatches) {
      for (const jsonStr of jsonMatches) {
        try {
          const parsed = JSON.parse(jsonStr);
          
          // Проверяем различные варианты структуры
          if (parsed.test?.id) {
            result.testId = parsed.test.id;
          } else if (parsed.testId) {
            result.testId = parsed.testId;
          } else if (parsed.id && (jsonStr.includes('test') || jsonStr.includes('Test'))) {
            result.testId = parsed.id;
          }
          
          if (parsed.setId) {
            result.flashcardSetId = parsed.setId;
          } else if (parsed.flashcardSetId) {
            result.flashcardSetId = parsed.flashcardSetId;
          } else if (parsed.flashcard?.setId) {
            result.flashcardSetId = parsed.flashcard.setId;
          }
          
          if (parsed.plan?.id) {
            result.studyPlanId = parsed.plan.id;
          } else if (parsed.planId) {
            result.studyPlanId = parsed.planId;
          } else if (parsed.studyPlan?.id) {
            result.studyPlanId = parsed.studyPlan.id;
          } else if (parsed.id && (jsonStr.includes('plan') || jsonStr.includes('Plan'))) {
            result.studyPlanId = parsed.id;
          }
        } catch (e) {
          // Игнорируем ошибки парсинга JSON
        }
      }
    }
  } catch (e) {
    // Игнорируем ошибки
  }

  // Проверяем, есть ли хотя бы один ID
  if (result.testId || result.flashcardSetId || result.studyPlanId) {
    return result;
  }

  return null;
}

/**
 * Извлекает ID из результата MCP инструмента
 * Ищет в ответах инструментов createTest, createFlashcards, createStudyPlan
 */
export function extractLearningIdsFromTools(usedTools?: Array<{ name: string; result?: any; args?: any }>): LearningContent | null {
  if (!usedTools) return null;

  const result: LearningContent = {};

  for (const tool of usedTools) {
    try {
      // Пытаемся извлечь из результата инструмента
      let toolResult = tool.result;
      
      // Если результат - строка, пытаемся распарсить
      if (typeof toolResult === 'string') {
        try {
          toolResult = JSON.parse(toolResult);
        } catch (e) {
          // Если не JSON, ищем ID в тексте
          const testIdMatch = toolResult.match(/test[_-]?([a-zA-Z0-9_-]+)/i);
          const setIdMatch = toolResult.match(/set[_-]?([a-zA-Z0-9_-]+)/i);
          const planIdMatch = toolResult.match(/plan[_-]?([a-zA-Z0-9_-]+)/i);
          
          if (testIdMatch && tool.name === 'createTest') {
            result.testId = testIdMatch[1];
          }
          if (setIdMatch && tool.name === 'createFlashcards') {
            result.flashcardSetId = setIdMatch[1];
          }
          if (planIdMatch && tool.name === 'createStudyPlan') {
            result.studyPlanId = planIdMatch[1];
          }
          continue;
        }
      }

      // Обрабатываем JSON результат
      if (tool.name === 'createTest' && toolResult) {
        if (toolResult.test?.id) {
          result.testId = toolResult.test.id;
        } else if (toolResult.id) {
          result.testId = toolResult.id;
        } else if (toolResult.testId) {
          result.testId = toolResult.testId;
        }
      }
      if (tool.name === 'createFlashcards' && toolResult) {
        if (toolResult.setId) {
          result.flashcardSetId = toolResult.setId;
        } else if (toolResult.flashcardSetId) {
          result.flashcardSetId = toolResult.flashcardSetId;
        }
      }
      if (tool.name === 'createStudyPlan' && toolResult) {
        if (toolResult.plan?.id) {
          result.studyPlanId = toolResult.plan.id;
        } else if (toolResult.id) {
          result.studyPlanId = toolResult.id;
        } else if (toolResult.planId) {
          result.studyPlanId = toolResult.planId;
        }
      }
    } catch (e) {
      // Игнорируем ошибки парсинга
    }
  }

  if (result.testId || result.flashcardSetId || result.studyPlanId) {
    return result;
  }

  return null;
}


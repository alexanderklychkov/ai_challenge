/**
 * Регистрирует инструменты для обучения и изучения материалов
 * @param {McpServer} server - Экземпляр MCP сервера
 */

import {
  saveTest,
  getTest,
  loadTests,
  saveAnkiCards,
  loadAnkiCards,
  saveStudyPlan,
  loadStudyPlans,
  saveFlashcards,
  loadFlashcards,
} from '../../utils/learningStorage.js';

/**
 * Регистрирует все инструменты для обучения
 */
export function registerLearningTools(server) {
  /**
   * Создает тест на основе материала
   */
  server.registerTool('createTest', {
    description: 'Создает тест с вопросами и ответами на основе изученного материала. Тест можно будет проходить в интерфейсе. Поддерживает различные типы вопросов: множественный выбор, правда/ложь, открытые вопросы.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Название теста',
        },
        material: {
          type: 'string',
          description: 'Материал, на основе которого создается тест (текст статьи, конспект и т.д.)',
        },
        questions: {
          type: 'array',
          description: 'Массив вопросов для теста. Если не указан, будет создан автоматически на основе материала.',
          items: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'Текст вопроса',
              },
              type: {
                type: 'string',
                enum: ['multiple-choice', 'true-false', 'open-ended'],
                description: 'Тип вопроса: multiple-choice (множественный выбор), true-false (правда/ложь), open-ended (открытый вопрос)',
              },
              options: {
                type: 'array',
                description: 'Варианты ответов (только для multiple-choice)',
                items: {
                  type: 'string',
                },
              },
              correctAnswer: {
                type: 'string',
                description: 'Правильный ответ (индекс для multiple-choice, "true"/"false" для true-false, текст для open-ended)',
              },
              explanation: {
                type: 'string',
                description: 'Объяснение правильного ответа',
              },
            },
            required: ['question', 'type', 'correctAnswer'],
          },
        },
        difficulty: {
          type: 'string',
          enum: ['easy', 'medium', 'hard'],
          description: 'Уровень сложности теста',
          default: 'medium',
        },
        topic: {
          type: 'string',
          description: 'Тема теста',
        },
        chatId: {
          type: 'string',
          description: 'ID чата, из которого был создан тест (опционально)',
        },
      },
      required: ['title', 'material'],
    },
  }, async (args) => {
    try {
      const { title, material, questions, difficulty = 'medium', topic, chatId } = args;

      if (!title || !material) {
        throw new Error('Название и материал обязательны');
      }

      // Если вопросы не предоставлены, создаем структуру для автоматической генерации
      let testQuestions = questions || [];
      
      // Если вопросы не предоставлены, возвращаем структуру для AI, чтобы он мог их создать
      if (testQuestions.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Вопросы не предоставлены. Используйте AI для создания вопросов на основе материала, затем вызовите createTest снова с заполненным массивом questions.',
                materialPreview: material.substring(0, 200) + '...',
                suggestedStructure: {
                  type: 'multiple-choice',
                  example: {
                    question: 'Пример вопроса',
                    type: 'multiple-choice',
                    options: ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4'],
                    correctAnswer: '0',
                    explanation: 'Объяснение правильного ответа',
                  },
                },
              }, null, 2),
            },
          ],
        };
      }

      // Валидация вопросов
      for (const q of testQuestions) {
        if (!q.question || !q.type || q.correctAnswer === undefined) {
          throw new Error('Каждый вопрос должен содержать question, type и correctAnswer');
        }
        
        if (q.type === 'multiple-choice' && (!q.options || q.options.length < 2)) {
          throw new Error('Вопросы типа multiple-choice должны содержать минимум 2 варианта ответа');
        }
      }

      const test = {
        title,
        material: material.substring(0, 10000), // Ограничиваем размер материала
        questions: testQuestions,
        difficulty,
        topic: topic || 'Общее',
        attempts: [],
        createdAt: new Date().toISOString(),
        ...(chatId && { chatId }),
      };

      const savedTest = await saveTest(test);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              test: savedTest,
              message: `Тест "${title}" успешно создан. ID теста: ${savedTest.id}. Тест можно пройти в интерфейсе.`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  /**
   * Получает тест по ID
   */
  server.registerTool('getTest', {
    description: 'Получает тест по ID для прохождения или просмотра',
    inputSchema: {
      type: 'object',
      properties: {
        testId: {
          type: 'string',
          description: 'ID теста',
        },
      },
      required: ['testId'],
    },
  }, async ({ testId }) => {
    try {
      const test = await getTest(testId);
      
      if (!test) {
        throw new Error(`Тест с ID ${testId} не найден`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              test,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  /**
   * Создает карточки Anki на основе материала
   */
  server.registerTool('createAnkiCards', {
    description: 'Создает карточки Anki в формате, который можно импортировать в Anki. Карточки создаются на основе материала для изучения.',
    inputSchema: {
      type: 'object',
      properties: {
        material: {
          type: 'string',
          description: 'Материал для создания карточек',
        },
        deckName: {
          type: 'string',
          description: 'Название колоды Anki',
        },
        cards: {
          type: 'array',
          description: 'Массив карточек. Если не указан, будет создан автоматически на основе материала.',
          items: {
            type: 'object',
            properties: {
              front: {
                type: 'string',
                description: 'Лицевая сторона карточки (вопрос)',
              },
              back: {
                type: 'string',
                description: 'Обратная сторона карточки (ответ)',
              },
              tags: {
                type: 'array',
                description: 'Теги для карточки',
                items: {
                  type: 'string',
                },
              },
            },
            required: ['front', 'back'],
          },
        },
        cardType: {
          type: 'string',
          enum: ['basic', 'cloze'],
          description: 'Тип карточек: basic (базовые вопрос-ответ) или cloze (заполнение пропусков)',
          default: 'basic',
        },
        topic: {
          type: 'string',
          description: 'Тема карточек',
        },
      },
      required: ['material', 'deckName'],
    },
  }, async (args) => {
    try {
      const { material, deckName, cards, cardType = 'basic', topic } = args;

      if (!material || !deckName) {
        throw new Error('Материал и название колоды обязательны');
      }

      let ankiCards = cards || [];

      // Если карточки не предоставлены, возвращаем структуру для AI
      if (ankiCards.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Карточки не предоставлены. Используйте AI для создания карточек на основе материала, затем вызовите createAnkiCards снова с заполненным массивом cards.',
                materialPreview: material.substring(0, 200) + '...',
                suggestedStructure: {
                  type: cardType,
                  example: {
                    front: 'Вопрос или термин',
                    back: 'Ответ или определение',
                    tags: ['тег1', 'тег2'],
                  },
                },
              }, null, 2),
            },
          ],
        };
      }

      // Валидация карточек
      for (const card of ankiCards) {
        if (!card.front || !card.back) {
          throw new Error('Каждая карточка должна содержать front и back');
        }
      }

      const savedCards = await saveAnkiCards(ankiCards, deckName);

      // Формируем текст для импорта в Anki (формат TSV)
      const ankiImportText = ankiCards.map(card => {
        const front = card.front.replace(/\t/g, ' ').replace(/\n/g, '<br>');
        const back = card.back.replace(/\t/g, ' ').replace(/\n/g, '<br>');
        const tags = (card.tags || []).join(' ');
        return `${front}\t${back}\t${tags}`;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              deckId: savedCards.deckId,
              deckName: savedCards.deckName,
              cardsCount: savedCards.cardsCount,
              cards: savedCards.cards,
              ankiImportText: ankiImportText,
              message: `Создано ${savedCards.cardsCount} карточек Anki в колоде "${deckName}". Используйте ankiImportText для импорта в Anki.`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  /**
   * Создает план изучения материала
   */
  server.registerTool('createStudyPlan', {
    description: 'Создает структурированный план изучения материала с разбивкой по дням/темам и рекомендациями по изучению',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Название плана изучения',
        },
        material: {
          type: 'string',
          description: 'Материал для изучения',
        },
        duration: {
          type: 'number',
          description: 'Продолжительность изучения в днях',
          default: 7,
        },
        steps: {
          type: 'array',
          description: 'Шаги плана изучения. Если не указан, будет создан автоматически.',
          items: {
            type: 'object',
            properties: {
              day: {
                type: 'number',
                description: 'День изучения',
              },
              title: {
                type: 'string',
                description: 'Название шага',
              },
              description: {
                type: 'string',
                description: 'Описание шага',
              },
              tasks: {
                type: 'array',
                description: 'Задачи для выполнения',
                items: {
                  type: 'string',
                },
              },
              estimatedTime: {
                type: 'string',
                description: 'Оценка времени на выполнение (например, "30 минут")',
              },
            },
            required: ['day', 'title', 'description'],
          },
        },
        topic: {
          type: 'string',
          description: 'Тема изучения',
        },
        chatId: {
          type: 'string',
          description: 'ID чата, из которого был создан план (опционально)',
        },
      },
      required: ['title', 'material'],
    },
  }, async (args) => {
    try {
      const { title, material, duration = 7, steps, topic, chatId } = args;

      if (!title || !material) {
        throw new Error('Название и материал обязательны');
      }

      let planSteps = steps || [];

      // Если шаги не предоставлены, возвращаем структуру для AI
      if (planSteps.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Шаги плана не предоставлены. Используйте AI для создания плана изучения на основе материала, затем вызовите createStudyPlan снова с заполненным массивом steps.',
                materialPreview: material.substring(0, 200) + '...',
                suggestedStructure: {
                  example: {
                    day: 1,
                    title: 'Название шага',
                    description: 'Описание того, что нужно изучить',
                    tasks: ['Задача 1', 'Задача 2'],
                    estimatedTime: '30 минут',
                  },
                },
              }, null, 2),
            },
          ],
        };
      }

      const plan = {
        title,
        material: material.substring(0, 10000),
        duration,
        steps: planSteps,
        topic: topic || 'Общее',
        completed: false,
        progress: 0,
        createdAt: new Date().toISOString(),
        ...(chatId && { chatId }),
      };

      const savedPlan = await saveStudyPlan(plan);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              plan: savedPlan,
              planId: savedPlan.id,
              message: `План изучения "${title}" успешно создан. ID плана: ${savedPlan.id}. План рассчитан на ${duration} дней.`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  /**
   * Создает флеш-карточки для изучения
   */
  server.registerTool('createFlashcards', {
    description: 'Создает флеш-карточки для изучения материала. Карточки можно использовать для повторения и запоминания.',
    inputSchema: {
      type: 'object',
      properties: {
        material: {
          type: 'string',
          description: 'Материал для создания карточек',
        },
        topic: {
          type: 'string',
          description: 'Тема карточек',
        },
        cards: {
          type: 'array',
          description: 'Массив карточек. Если не указан, будет создан автоматически на основе материала.',
          items: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'Вопрос или термин',
              },
              answer: {
                type: 'string',
                description: 'Ответ или определение',
              },
              hint: {
                type: 'string',
                description: 'Подсказка (опционально)',
              },
            },
            required: ['question', 'answer'],
          },
        },
        chatId: {
          type: 'string',
          description: 'ID чата, из которого были созданы карточки (опционально)',
        },
      },
      required: ['material', 'topic'],
    },
  }, async (args) => {
    try {
      const { material, topic, cards, chatId } = args;

      if (!material || !topic) {
        throw new Error('Материал и тема обязательны');
      }

      let flashCards = cards || [];

      // Если карточки не предоставлены, возвращаем структуру для AI
      if (flashCards.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Карточки не предоставлены. Используйте AI для создания флеш-карточек на основе материала, затем вызовите createFlashcards снова с заполненным массивом cards.',
                materialPreview: material.substring(0, 200) + '...',
                suggestedStructure: {
                  example: {
                    question: 'Вопрос или термин',
                    answer: 'Ответ или определение',
                    hint: 'Подсказка (опционально)',
                  },
                },
              }, null, 2),
            },
          ],
        };
      }

      // Валидация карточек
      for (const card of flashCards) {
        if (!card.question || !card.answer) {
          throw new Error('Каждая карточка должна содержать question и answer');
        }
      }

      const savedCards = await saveFlashcards(flashCards, topic, chatId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              setId: savedCards.setId,
              flashcardSetId: savedCards.setId,
              topic: savedCards.topic,
              cardsCount: savedCards.cardsCount,
              cards: savedCards.cards,
              message: `Создано ${savedCards.cardsCount} флеш-карточек по теме "${topic}". ID набора карточек: ${savedCards.setId}. Карточки можно использовать для изучения в интерфейсе.`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  /**
   * Создает конспект материала
   */
  server.registerTool('createSummary', {
    description: 'Создает структурированный конспект материала с основными пунктами, ключевыми идеями и выводами',
    inputSchema: {
      type: 'object',
      properties: {
        material: {
          type: 'string',
          description: 'Материал для создания конспекта',
        },
        title: {
          type: 'string',
          description: 'Название конспекта',
        },
        summary: {
          type: 'object',
          description: 'Структурированный конспект. Если не указан, будет создан автоматически на основе материала.',
          properties: {
            mainPoints: {
              type: 'array',
              description: 'Основные пункты',
              items: {
                type: 'string',
              },
            },
            keyIdeas: {
              type: 'array',
              description: 'Ключевые идеи',
              items: {
                type: 'string',
              },
            },
            conclusions: {
              type: 'array',
              description: 'Выводы',
              items: {
                type: 'string',
              },
            },
            importantTerms: {
              type: 'array',
              description: 'Важные термины и определения',
              items: {
                type: 'object',
                properties: {
                  term: {
                    type: 'string',
                  },
                  definition: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
        topic: {
          type: 'string',
          description: 'Тема конспекта',
        },
      },
      required: ['material'],
    },
  }, async (args) => {
    try {
      const { material, title, summary, topic } = args;

      if (!material) {
        throw new Error('Материал обязателен');
      }

      // Если конспект не предоставлен, возвращаем структуру для AI
      if (!summary) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Конспект не предоставлен. Используйте AI для создания структурированного конспекта на основе материала, затем вызовите createSummary снова с заполненным объектом summary.',
                materialPreview: material.substring(0, 200) + '...',
                suggestedStructure: {
                  mainPoints: ['Основной пункт 1', 'Основной пункт 2'],
                  keyIdeas: ['Ключевая идея 1', 'Ключевая идея 2'],
                  conclusions: ['Вывод 1', 'Вывод 2'],
                  importantTerms: [
                    { term: 'Термин 1', definition: 'Определение термина 1' },
                  ],
                },
              }, null, 2),
            },
          ],
        };
      }

      const summaryData = {
        title: title || 'Конспект',
        material: material.substring(0, 10000),
        summary,
        topic: topic || 'Общее',
        createdAt: new Date().toISOString(),
      };

      // Сохраняем конспект как план изучения с одним шагом
      const plan = {
        title: summaryData.title,
        material: summaryData.material,
        duration: 1,
        steps: [
          {
            day: 1,
            title: 'Изучение конспекта',
            description: 'Повторение и закрепление материала',
            tasks: [
              ...(summary.mainPoints || []).map((point, i) => `Изучить пункт ${i + 1}: ${point}`),
              ...(summary.keyIdeas || []).map((idea, i) => `Понять идею ${i + 1}: ${idea}`),
            ],
            estimatedTime: '30-60 минут',
          },
        ],
        topic: summaryData.topic,
        summary: summaryData.summary,
      };

      const savedPlan = await saveStudyPlan(plan);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              summary: summaryData,
              planId: savedPlan.id,
              message: `Конспект "${summaryData.title}" успешно создан. Конспект сохранен и доступен для изучения.`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  /**
   * Получает список всех тестов
   */
  server.registerTool('listTests', {
    description: 'Получает список всех созданных тестов',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Фильтр по теме (опционально)',
        },
      },
    },
  }, async (args) => {
    try {
      const { topic } = args;
      const tests = await loadTests();
      
      const filteredTests = topic 
        ? tests.filter(t => t.topic === topic)
        : tests;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              tests: filteredTests.map(t => ({
                id: t.id,
                title: t.title,
                topic: t.topic,
                difficulty: t.difficulty,
                questionsCount: t.questions?.length || 0,
                createdAt: t.createdAt,
              })),
              count: filteredTests.length,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });
}


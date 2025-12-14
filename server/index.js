import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import { handleYandexGPT } from './handlers/yandexGPT.js';
import { handleDeepSeek } from './handlers/deepSeek.js';
import { handleChatGPT } from './handlers/chatGPT.js';
import { handleHuggingFace } from './handlers/huggingFace.js';
import { handleLMStudio, getLMStudioModels } from './handlers/lmStudio.js';
import { handleOllama, getOllamaModels } from './handlers/ollama.js';
import { loadMessages, saveMessages, clearMessages } from './utils/storage.js';
import { 
  loadChats, 
  createChat, 
  deleteChat, 
  updateChatTitle,
  updateChatSettings,
  loadChatMessages,
  saveChatMessages,
  clearChatMessages
} from './utils/chatStorage.js';
import { startTelegramBot } from './bot/telegramBot.js';
import { initializeAllMCPServers } from './mcp/init.js';
import { 
  getRegisteredServers, 
  getAllToolsAsOpenAI,
  getExecutionHistory 
} from './mcp/orchestrator.js';
import { 
  createFlow, 
  executeFlow, 
  getFlowState, 
  getAllFlows,
  createArticleProcessingFlow,
  createTaskSearchFlow 
} from './mcp/flow.js';
import {
  loadTests,
  getTest,
  deleteTest,
  loadAnkiCards,
  loadStudyPlans,
  deleteStudyPlan,
  loadFlashcards,
  deleteFlashcardSet,
  loadCourses,
  getCourse,
  saveCourse,
  deleteCourse,
} from './utils/learningStorage.js';
import { registerConnection } from './utils/statusEmitter.js';
import { DocumentIndexer } from './rag/indexer.js';
import { RAGService } from './rag/ragService.js';
import { SupportService } from './support/supportService.js';
import { register, login, getCurrentUser } from './auth/authController.js';
import { authenticateToken } from './auth/middleware.js';
import { findUserById } from './utils/userStorage.js';
import { DataParser } from './analytics/dataParser.js';
import { AnalyticsService } from './analytics/analyticsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env из корня проекта
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Эндпоинты для авторизации
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.get('/api/auth/me', authenticateToken, getCurrentUser);

// Эндпоинты для различных AI моделей
app.post('/api/yandex-gpt', handleYandexGPT);
app.post('/api/deepseek', handleDeepSeek);
app.post('/api/chatgpt', handleChatGPT);
app.post('/api/huggingface', handleHuggingFace);
app.post('/api/lmstudio', handleLMStudio);
app.get('/api/lmstudio/models', getLMStudioModels);
app.post('/api/ollama', handleOllama);
app.get('/api/ollama/models', getOllamaModels);

// Эндпоинты для работы с чатами (требуют авторизации)
app.get('/api/chats', authenticateToken, async (req, res) => {
  try {
    const chats = await loadChats(req.userId);
    res.json(chats);
  } catch (error) {
    console.error('Ошибка при загрузке чатов:', error);
    res.status(500).json({ error: 'Не удалось загрузить чаты' });
  }
});

app.post('/api/chats', authenticateToken, async (req, res) => {
  try {
    const { title } = req.body;
    const chat = await createChat(title, req.userId);
    res.json(chat);
  } catch (error) {
    console.error('Ошибка при создании чата:', error);
    res.status(500).json({ error: 'Не удалось создать чат' });
  }
});

app.patch('/api/chats/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { title } = req.body;
    
    // Проверяем, что чат принадлежит пользователю
    const chats = await loadChats(req.userId);
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }
    
    const success = await updateChatTitle(chatId, title);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Чат не найден' });
    }
  } catch (error) {
    console.error('Ошибка при обновлении чата:', error);
    res.status(500).json({ error: 'Не удалось обновить чат' });
  }
});

app.put('/api/chats/:chatId/settings', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { settings } = req.body;
    
    // Проверяем, что чат принадлежит пользователю
    const chats = await loadChats(req.userId);
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }
    
    const success = await updateChatSettings(chatId, settings);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Чат не найден' });
    }
  } catch (error) {
    console.error('Ошибка при обновлении настроек чата:', error);
    res.status(500).json({ error: 'Не удалось обновить настройки чата' });
  }
});

app.delete('/api/chats/:chatId', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    
    // Проверяем, что чат принадлежит пользователю
    const chats = await loadChats(req.userId);
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }
    
    const success = await deleteChat(chatId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Чат не найден' });
    }
  } catch (error) {
    console.error('Ошибка при удалении чата:', error);
    res.status(500).json({ error: 'Не удалось удалить чат' });
  }
});

// Эндпоинты для работы с сообщениями конкретного чата
app.get('/api/chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    
    // Проверяем, что чат принадлежит пользователю
    const chats = await loadChats(req.userId);
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }
    
    const messages = await loadChatMessages(chatId);
    res.json(messages);
  } catch (error) {
    console.error('Ошибка при загрузке сообщений:', error);
    res.status(500).json({ error: 'Не удалось загрузить сообщения' });
  }
});

app.post('/api/chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { messages } = req.body;
    
    // Проверяем, что чат принадлежит пользователю
    const chats = await loadChats(req.userId);
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }
    
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages должен быть массивом' });
    }
    await saveChatMessages(chatId, messages);
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при сохранении сообщений:', error);
    res.status(500).json({ error: 'Не удалось сохранить сообщения' });
  }
});

app.delete('/api/chats/:chatId/messages', authenticateToken, async (req, res) => {
  try {
    const { chatId } = req.params;
    
    // Проверяем, что чат принадлежит пользователю
    const chats = await loadChats(req.userId);
    const chat = chats.find(c => c.id === chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }
    
    await clearChatMessages(chatId);
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при очистке сообщений:', error);
    res.status(500).json({ error: 'Не удалось очистить сообщения' });
  }
});

// Старые эндпоинты для обратной совместимости (используют первый чат или создают его)
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    const chats = await loadChats(req.userId);
    if (chats.length === 0) {
      const newChat = await createChat('Новый чат', req.userId);
      const messages = await loadChatMessages(newChat.id);
      return res.json(messages);
    }
    const messages = await loadChatMessages(chats[0].id);
    res.json(messages);
  } catch (error) {
    console.error('Ошибка при загрузке сообщений:', error);
    res.status(500).json({ error: 'Не удалось загрузить сообщения' });
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages должен быть массивом' });
    }
    const chats = await loadChats(req.userId);
    let chatId;
    if (chats.length === 0) {
      const newChat = await createChat('Новый чат', req.userId);
      chatId = newChat.id;
    } else {
      chatId = chats[0].id;
    }
    await saveChatMessages(chatId, messages);
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при сохранении сообщений:', error);
    res.status(500).json({ error: 'Не удалось сохранить сообщения' });
  }
});

app.delete('/api/messages', authenticateToken, async (req, res) => {
  try {
    const chats = await loadChats(req.userId);
    if (chats.length > 0) {
      await clearChatMessages(chats[0].id);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при очистке сообщений:', error);
    res.status(500).json({ error: 'Не удалось очистить сообщения' });
  }
});

// Эндпоинты для работы с MCP оркестратором
app.get('/api/mcp/servers', async (req, res) => {
  try {
    const servers = getRegisteredServers();
    res.json(servers);
  } catch (error) {
    console.error('Ошибка при получении списка серверов:', error);
    res.status(500).json({ error: 'Не удалось получить список серверов' });
  }
});

app.get('/api/mcp/tools', async (req, res) => {
  try {
    const { category, minPriority } = req.query;
    const options = {};
    if (category) options.category = category;
    if (minPriority) options.minPriority = parseInt(minPriority);
    
    const tools = await getAllToolsAsOpenAI(options);
    res.json(tools);
  } catch (error) {
    console.error('Ошибка при получении инструментов:', error);
    res.status(500).json({ error: 'Не удалось получить инструменты' });
  }
});

app.get('/api/mcp/history', async (req, res) => {
  try {
    const { serverId, toolName, limit } = req.query;
    const options = {};
    if (serverId) options.serverId = serverId;
    if (toolName) options.toolName = toolName;
    if (limit) options.limit = parseInt(limit);
    
    const history = getExecutionHistory(options);
    res.json(history);
  } catch (error) {
    console.error('Ошибка при получении истории:', error);
    res.status(500).json({ error: 'Не удалось получить историю' });
  }
});

app.post('/api/mcp/call', async (req, res) => {
  try {
    const { toolName, args, serverId } = req.body;
    
    if (!toolName) {
      return res.status(400).json({ error: 'toolName обязателен' });
    }
    
    const { callTool } = await import('./mcp/orchestrator.js');
    const result = await callTool(toolName, args || {}, serverId || null, true);
    
    res.json(result);
  } catch (error) {
    console.error('Ошибка при вызове MCP инструмента:', error);
    res.status(500).json({ error: error.message || 'Не удалось вызвать инструмент' });
  }
});

// Эндпоинты для работы с флоу
app.post('/api/mcp/flows', async (req, res) => {
  try {
    const { name, steps, context, type, params } = req.body;
    
    let flow;
    if (type === 'article') {
      // Создаем флоу для обработки статьи
      flow = createArticleProcessingFlow(params.url, params.options || {});
    } else if (type === 'taskSearch') {
      // Создаем флоу для поиска задач
      flow = createTaskSearchFlow(params.query, params.options || {});
    } else if (name && steps) {
      // Создаем кастомный флоу
      flow = createFlow(name, steps, context || {});
    } else {
      return res.status(400).json({ error: 'Необходимы поля: name и steps, или type и params' });
    }
    
    res.json(flow);
  } catch (error) {
    console.error('Ошибка при создании флоу:', error);
    res.status(500).json({ error: 'Не удалось создать флоу' });
  }
});

app.get('/api/mcp/flows/:flowId', async (req, res) => {
  try {
    const { flowId } = req.params;
    const flow = getFlowState(flowId);
    
    if (!flow) {
      return res.status(404).json({ error: 'Флоу не найден' });
    }
    
    res.json(flow);
  } catch (error) {
    console.error('Ошибка при получении флоу:', error);
    res.status(500).json({ error: 'Не удалось получить флоу' });
  }
});

app.post('/api/mcp/flows/:flowId/execute', async (req, res) => {
  try {
    const { flowId } = req.params;
    const { maxSteps } = req.body;
    
    const result = await executeFlow(flowId, { maxSteps });
    res.json(result);
  } catch (error) {
    console.error('Ошибка при выполнении флоу:', error);
    res.status(500).json({ error: `Не удалось выполнить флоу: ${error.message}` });
  }
});

app.get('/api/mcp/flows', async (req, res) => {
  try {
    const flows = getAllFlows();
    res.json(flows);
  } catch (error) {
    console.error('Ошибка при получении списка флоу:', error);
    res.status(500).json({ error: 'Не удалось получить список флоу' });
  }
});

// Эндпоинты для обучения
app.get('/api/learning/tests', async (req, res) => {
  try {
    const { topic } = req.query;
    const tests = await loadTests();
    const filteredTests = topic 
      ? tests.filter(t => t.topic === topic)
      : tests;
    res.json(filteredTests.map(t => ({
      id: t.id,
      title: t.title,
      topic: t.topic,
      difficulty: t.difficulty,
      questionsCount: t.questions?.length || 0,
      createdAt: t.createdAt,
      chatId: t.chatId,
    })));
  } catch (error) {
    console.error('Ошибка при загрузке тестов:', error);
    res.status(500).json({ error: 'Не удалось загрузить тесты' });
  }
});

app.get('/api/learning/tests/:testId', async (req, res) => {
  try {
    const { testId } = req.params;
    const test = await getTest(testId);
    if (!test) {
      return res.status(404).json({ error: 'Тест не найден' });
    }
    res.json(test);
  } catch (error) {
    console.error('Ошибка при загрузке теста:', error);
    res.status(500).json({ error: 'Не удалось загрузить тест' });
  }
});

app.post('/api/learning/tests/:testId/attempt', async (req, res) => {
  try {
    const { testId } = req.params;
    const { answers } = req.body;
    const test = await getTest(testId);
    if (!test) {
      return res.status(404).json({ error: 'Тест не найден' });
    }

    // Проверяем ответы
    let correctCount = 0;
    const results = test.questions.map((question, index) => {
      const userAnswer = answers[index];
      let isCorrect = false;

      if (question.type === 'multiple-choice') {
        isCorrect = userAnswer === question.correctAnswer;
      } else if (question.type === 'true-false') {
        isCorrect = userAnswer === question.correctAnswer;
      } else if (question.type === 'open-ended') {
        // Для открытых вопросов просто сохраняем ответ
        isCorrect = null; // Не проверяем автоматически
      }

      if (isCorrect) correctCount++;

      return {
        questionIndex: index,
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation,
      };
    });

    const score = Math.round((correctCount / test.questions.length) * 100);

    // Сохраняем попытку
    if (!test.attempts) {
      test.attempts = [];
    }
    test.attempts.push({
      answers,
      results,
      score,
      completedAt: new Date().toISOString(),
    });

    // Сохраняем обновленный тест
    const { saveTest } = await import('./utils/learningStorage.js');
    await saveTest(test);

    res.json({
      score,
      correctCount,
      totalQuestions: test.questions.length,
      results,
    });
  } catch (error) {
    console.error('Ошибка при проверке теста:', error);
    res.status(500).json({ error: 'Не удалось проверить тест' });
  }
});

app.get('/api/learning/flashcards', async (req, res) => {
  try {
    const { topic } = req.query;
    const flashcards = await loadFlashcards();
    const filtered = topic 
      ? flashcards.filter(f => f.topic === topic)
      : flashcards;
    
    // Группируем по setId
    const grouped = filtered.reduce((acc, card) => {
      if (!acc[card.setId]) {
        acc[card.setId] = {
          setId: card.setId,
          topic: card.topic,
          cards: [],
          chatId: card.chatId,
        };
      }
      acc[card.setId].cards.push(card);
      return acc;
    }, {});

    res.json(Object.values(grouped));
  } catch (error) {
    console.error('Ошибка при загрузке флеш-карточек:', error);
    res.status(500).json({ error: 'Не удалось загрузить флеш-карточки' });
  }
});

app.get('/api/learning/study-plans', async (req, res) => {
  try {
    const { topic } = req.query;
    const plans = await loadStudyPlans();
    const filtered = topic 
      ? plans.filter(p => p.topic === topic)
      : plans;
    res.json(filtered.map(p => ({
      id: p.id,
      title: p.title,
      topic: p.topic,
      duration: p.duration,
      stepsCount: p.steps?.length || 0,
      progress: p.progress || 0,
      completed: p.completed || false,
      createdAt: p.createdAt,
      chatId: p.chatId,
    })));
  } catch (error) {
    console.error('Ошибка при загрузке планов изучения:', error);
    res.status(500).json({ error: 'Не удалось загрузить планы изучения' });
  }
});

app.get('/api/learning/study-plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const plans = await loadStudyPlans();
    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      return res.status(404).json({ error: 'План изучения не найден' });
    }
    res.json(plan);
  } catch (error) {
    console.error('Ошибка при загрузке плана изучения:', error);
    res.status(500).json({ error: 'Не удалось загрузить план изучения' });
  }
});

app.patch('/api/learning/study-plans/:planId/progress', async (req, res) => {
  try {
    const { planId } = req.params;
    const { stepIndex, completed } = req.body;
    const plans = await loadStudyPlans();
    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      return res.status(404).json({ error: 'План изучения не найден' });
    }

    // Обновляем прогресс
    if (stepIndex !== undefined && completed !== undefined) {
      if (!plan.steps[stepIndex]) {
        return res.status(400).json({ error: 'Неверный индекс шага' });
      }
      plan.steps[stepIndex].completed = completed;
      
      // Пересчитываем общий прогресс
      const completedSteps = plan.steps.filter(s => s.completed).length;
      plan.progress = Math.round((completedSteps / plan.steps.length) * 100);
      plan.completed = plan.progress === 100;
    }

    // Сохраняем обновленный план
    const { saveStudyPlan } = await import('./utils/learningStorage.js');
    await saveStudyPlan(plan);

    res.json(plan);
  } catch (error) {
    console.error('Ошибка при обновлении прогресса:', error);
    res.status(500).json({ error: 'Не удалось обновить прогресс' });
  }
});

// Удаление элементов обучения
app.delete('/api/learning/tests/:testId', async (req, res) => {
  try {
    const { testId } = req.params;
    const success = await deleteTest(testId);
    if (!success) {
      return res.status(404).json({ error: 'Тест не найден' });
    }
    res.json({ success: true, message: 'Тест успешно удален' });
  } catch (error) {
    console.error('Ошибка при удалении теста:', error);
    res.status(500).json({ error: 'Не удалось удалить тест' });
  }
});

app.delete('/api/learning/flashcards/:setId', async (req, res) => {
  try {
    const { setId } = req.params;
    const success = await deleteFlashcardSet(setId);
    if (!success) {
      return res.status(404).json({ error: 'Набор карточек не найден' });
    }
    res.json({ success: true, message: 'Набор карточек успешно удален' });
  } catch (error) {
    console.error('Ошибка при удалении набора карточек:', error);
    res.status(500).json({ error: 'Не удалось удалить набор карточек' });
  }
});

app.delete('/api/learning/study-plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const success = await deleteStudyPlan(planId);
    if (!success) {
      return res.status(404).json({ error: 'План изучения не найден' });
    }
    res.json({ success: true, message: 'План изучения успешно удален' });
  } catch (error) {
    console.error('Ошибка при удалении плана изучения:', error);
    res.status(500).json({ error: 'Не удалось удалить план изучения' });
  }
});

// Эндпоинты для работы с курсами
app.get('/api/courses', async (req, res) => {
  try {
    const { topic } = req.query;
    const courses = await loadCourses();
    const filtered = topic 
      ? courses.filter(c => c.topic === topic)
      : courses;
    res.json(filtered.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      topic: c.topic,
      difficulty: c.difficulty,
      duration: c.duration,
      modulesCount: c.modules?.length || 0,
      progress: c.progress || 0,
      completed: c.completed || false,
      createdAt: c.createdAt,
      chatId: c.chatId,
    })));
  } catch (error) {
    console.error('Ошибка при загрузке курсов:', error);
    res.status(500).json({ error: 'Не удалось загрузить курсы' });
  }
});

app.get('/api/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await getCourse(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Курс не найден' });
    }
    res.json(course);
  } catch (error) {
    console.error('Ошибка при загрузке курса:', error);
    res.status(500).json({ error: 'Не удалось загрузить курс' });
  }
});

app.post('/api/courses/generate', authenticateToken, async (req, res) => {
  try {
    const { topic, difficulty, duration, description, generateTasks, generateContent } = req.body;
    
    if (!topic || !difficulty) {
      return res.status(400).json({ error: 'Поля topic и difficulty обязательны' });
    }

    console.log('[Courses] Генерация курса:', { topic, difficulty, duration, description });

    // Создаем базовую структуру курса с модулями-заглушками
    // MCP инструмент требует модули, поэтому создаем их здесь
    const modulesCount = Math.max(5, Math.ceil((duration || 7) / 1.5)); // Примерно модуль на каждые 1.5 дня
    const modules = [];
    
    for (let i = 0; i < modulesCount; i++) {
      const moduleTypes = ['theory', 'practice', 'test', 'project'];
      const moduleType = moduleTypes[i % moduleTypes.length];
      
      modules.push({
        id: `module-${i + 1}`,
        type: moduleType,
        title: `Модуль ${i + 1}: ${moduleType === 'theory' ? 'Теория' : moduleType === 'practice' ? 'Практика' : moduleType === 'test' ? 'Тест' : 'Проект'}`,
        order: i + 1,
        content: moduleType === 'theory' ? `Теоретический материал по теме "${topic}" для модуля ${i + 1}` : undefined,
        practiceTask: moduleType === 'practice' ? `Практическое задание по теме "${topic}" для модуля ${i + 1}` : undefined,
        projectDescription: moduleType === 'project' ? `Описание проекта по теме "${topic}" для модуля ${i + 1}` : undefined,
        estimatedTime: i < 3 ? '1 час' : i < 6 ? '2 часа' : '3 часа',
        completed: false,
      });
    }

    // Используем MCP для генерации курса с модулями
    const { callTool } = await import('./mcp/orchestrator.js');
    
    let courseData = null;
    
    try {
      // Генерируем курс через MCP инструмент
      const result = await callTool(
        'generateCourse',
        {
          topic,
          difficulty,
          duration: duration || 7,
          description: description || '',
          modules,
        },
        'learning-mcp-server',
        false
      );

      console.log('[Courses] MCP результат:', JSON.stringify(result, null, 2));

      // callLearningMCPTool возвращает распарсенный JSON напрямую
      // Проверяем структуру результата
      if (result && typeof result === 'object') {
        // Если результат содержит success: false, это ошибка
        if (result.success === false) {
          return res.status(500).json({ error: result.error || 'Ошибка при генерации курса' });
        }
        
        // Если результат содержит course, используем его
        if (result.course) {
          courseData = result.course;
        } 
        // Если результат сам является курсом (проверяем по наличию обязательных полей)
        else if (result.title && result.topic && result.modules) {
          courseData = result;
        }
        // Если результат содержит content массив (стандартный формат MCP)
        else if (result.content && Array.isArray(result.content)) {
          const textContent = result.content.find(c => c.type === 'text')?.text;
          if (textContent) {
            try {
              const parsed = JSON.parse(textContent);
              if (parsed.course) {
                courseData = parsed.course;
              } else if (parsed.success === false) {
                return res.status(500).json({ error: parsed.error || 'Ошибка при генерации курса' });
              } else if (parsed.title && parsed.topic) {
                courseData = parsed;
              }
            } catch (e) {
              console.error('[Courses] Ошибка парсинга результата MCP:', e);
              return res.status(500).json({ error: 'Не удалось обработать результат генерации курса' });
            }
          }
        }
      }
    } catch (error) {
      console.error('[Courses] Ошибка при вызове MCP инструмента:', error);
      return res.status(500).json({ error: 'Ошибка при генерации курса: ' + (error.message || 'Неизвестная ошибка') });
    }

    if (!courseData) {
      console.error('[Courses] Не удалось извлечь данные курса из результата');
      return res.status(500).json({ error: 'Не удалось получить данные курса из результата генерации' });
    }

    console.log('[Courses] Данные курса извлечены:', JSON.stringify(courseData, null, 2));

    const course = courseData;
    
    // Убеждаемся, что модули всегда массив
    if (!course.modules || !Array.isArray(course.modules)) {
      course.modules = [];
    }

    // Помечаем модули как генерирующиеся, если у них нет контента
    const modulesWithStatus = (course.modules || []).map(module => {
      const needsContent = 
        (module.type === 'theory' && (!module.content || module.content.length < 50)) ||
        (module.type === 'practice' && (!module.practiceTask || module.practiceTask.length < 50)) ||
        (module.type === 'project' && (!module.projectDescription || module.projectDescription.length < 50)) ||
        (module.type === 'test' && !module.testId);
      
      return {
        ...module,
        contentGenerating: needsContent,
        contentWaiting: false, // Будет установлено позже для модулей, которые ждут своей очереди
      };
    });

    // Сохраняем курс сразу, чтобы он был доступен пользователю
    let savedCourse = await saveCourse({
      ...course,
      modules: modulesWithStatus,
      chatId: req.user?.id ? `chat-${req.user.id}` : undefined,
    });

    console.log('[Courses] Курс сохранен (базовая структура):', savedCourse.id);

    // Генерируем контент для модулей через AI параллельно в фоне
    if (generateContent && modulesWithStatus.length > 0) {
      try {
        const { handleDeepSeek } = await import('./handlers/deepSeek.js');
        
        // Генерируем контент для модуля с учетом контекста уже созданных модулей
        const generateModuleContentWithContext = async (module, index, total, topic, difficulty, contextSummary, courseId) => {
          // Пропускаем модули, у которых уже есть контент
          if (module.type === 'theory' && module.content && module.content.length > 50) {
            console.log(`[Courses] Модуль ${module.id} уже имеет контент, пропускаем`);
            return;
          }
          if (module.type === 'practice' && module.practiceTask && module.practiceTask.length > 50) {
            console.log(`[Courses] Модуль ${module.id} уже имеет практическое задание, пропускаем`);
            return;
          }
          if (module.type === 'project' && module.projectDescription && module.projectDescription.length > 50) {
            console.log(`[Courses] Модуль ${module.id} уже имеет описание проекта, пропускаем`);
            return;
          }
          if (module.type === 'test' && module.testId) {
            console.log(`[Courses] Модуль ${module.id} уже имеет тест, пропускаем`);
            return;
          }
          
          // Специальная обработка для модулей типа "test"
          if (module.type === 'test') {
            try {
              console.log(`[Courses] Начинаем генерацию теста для модуля ${module.id} (${index + 1}/${modulesWithStatus.length})`);
              
              // Маппинг сложности курса на сложность теста
              const testDifficulty = difficulty === 'beginner' ? 'easy' : difficulty === 'intermediate' ? 'medium' : 'hard';
              
              // Создаем тест через AI с включенным MCP
              const createTestPrompt = `Создай тест для модуля "${module.title}" курса по теме "${topic}" для уровня ${difficulty}. 

Используй инструмент createTest для создания теста. Тест должен проверить понимание ключевых концепций по теме "${topic}". Включи 5-7 вопросов разных типов:
- Множественный выбор (multiple-choice) - 3-4 вопроса
- Правда/ложь (true-false) - 1-2 вопроса  
- Открытые вопросы (open-ended) - 1 вопрос

Название теста: "${module.title}"
Тема: "${topic}"
Уровень сложности: "${testDifficulty}"
${contextSummary}

Создай материал для теста на основе темы "${topic}" и уровня "${difficulty}", учитывая уже пройденные модули курса. Затем используй инструмент createTest для создания теста с вопросами.`;

              const testReq = {
                body: {
                  messages: [{ role: 'user', content: createTestPrompt }],
                  system_prompt: 'Ты опытный преподаватель программирования. Создавай качественные тесты для проверки знаний. Используй доступные инструменты для создания тестов.',
                  temperature: 0.7,
                  max_tokens: 4000,
                  enableMCP: true,
                }
              };
              
              let testResponseData = null;
              let testResponseError = null;
              
              const testMockRes = {
                json: (data) => {
                  testResponseData = data;
                  console.log(`[Courses] Получен ответ от AI для создания теста модуля ${module.id}`);
                },
                status: (code) => ({
                  json: (data) => {
                    testResponseError = new Error(data.error || `HTTP ${code}`);
                    console.error(`[Courses] Ошибка HTTP ${code} при создании теста для модуля ${module.id}:`, data);
                    throw testResponseError;
                  }
                })
              };
              
              await handleDeepSeek(testReq, testMockRes);
              
              if (testResponseError) {
                throw testResponseError;
              }
              
              // Парсим ответ, чтобы найти testId
              let testId = null;
              
              if (testResponseData && testResponseData.text) {
                const testResponseText = testResponseData.text;
                console.log(`[Courses] Ответ AI для теста модуля ${module.id}:`, testResponseText.substring(0, 500));
                
                // Ищем testId в разных форматах
                // Формат: "ID теста: test-1234567890-abc123"
                const testIdPatterns = [
                  /test[_-]?\d+[_-]?[\w-]+/gi,
                  /id[:\s]+(test[_-]?\d+[_-]?[\w-]+)/i,
                  /testId[:\s]+([a-z0-9_-]+)/i,
                ];
                
                for (const pattern of testIdPatterns) {
                  const match = testResponseText.match(pattern);
                  if (match) {
                    testId = match[1] || match[0];
                    break;
                  }
                }
                
                // Если не нашли в тексте, проверяем usedTools
                if (!testId && testResponseData.usedTools) {
                  const createTestTool = testResponseData.usedTools.find(t => t.name === 'createTest');
                  if (createTestTool && createTestTool.result) {
                    try {
                      const toolResult = typeof createTestTool.result === 'string' 
                        ? JSON.parse(createTestTool.result) 
                        : createTestTool.result;
                      if (toolResult.test && toolResult.test.id) {
                        testId = toolResult.test.id;
                      } else if (toolResult.id) {
                        testId = toolResult.id;
                      }
                    } catch (e) {
                      // Игнорируем ошибки парсинга
                    }
                  }
                }
              }
              
              if (testId) {
                module.testId = testId;
                module.contentGenerating = false;
                console.log(`[Courses] Тест создан для модуля ${module.id}, testId: ${testId}`);
                
                // Обновляем курс
                const { getCourse: getCourseById } = await import('./utils/learningStorage.js');
                const currentCourse = await getCourseById(courseId);
                
                if (!currentCourse) {
                  console.error(`[Courses] Курс ${courseId} не найден при обновлении модуля ${module.id}`);
                  return;
                }
                
                const updatedModules = currentCourse.modules.map(m => {
                  if (m.id === module.id) {
                    return {
                      ...module,
                      contentGenerating: false,
                      contentWaiting: false,
                    };
                  }
                  return m;
                });
                
                await saveCourse({
                  ...currentCourse,
                  modules: updatedModules,
                });
                
                console.log(`[Courses] Курс обновлен после создания теста для модуля ${module.id} (${index + 1}/${total})`);
              } else {
                console.warn(`[Courses] Не удалось извлечь testId из результата для модуля ${module.id}. Ответ:`, JSON.stringify(testResponseData, null, 2));
                module.contentGenerating = false;
              }
            } catch (testError) {
              console.error(`[Courses] Ошибка при создании теста для модуля ${module.id}:`, testError);
              module.contentGenerating = false;
            }
            return; // Выходим, так как тест обработан отдельно
          }
          
          let prompt = '';
          let fieldToUpdate = '';
          
          if (module.type === 'theory') {
            prompt = `Создай подробный теоретический материал для модуля "${module.title}" курса по теме "${topic}" для уровня ${difficulty}. Материал должен быть структурированным, понятным и содержать примеры кода где это уместно. Используй markdown форматирование.${contextSummary}`;
            fieldToUpdate = 'content';
          } else if (module.type === 'practice') {
            prompt = `Создай практическое задание для модуля "${module.title}" курса по теме "${topic}" для уровня ${difficulty}. Задание должно быть практичным, с четкими инструкциями и примерами. Используй markdown форматирование.${contextSummary}`;
            fieldToUpdate = 'practiceTask';
          } else if (module.type === 'project') {
            prompt = `Создай описание проекта для модуля "${module.title}" курса по теме "${topic}" для уровня ${difficulty}. Проект должен быть реалистичным и соответствовать уровню сложности. Включи требования к проекту. Используй markdown форматирование.${contextSummary}`;
            fieldToUpdate = 'projectDescription';
          }
          
          if (prompt && fieldToUpdate) {
            try {
              console.log(`[Courses] Начинаем генерацию контента для модуля ${module.id} (${index + 1}/${modulesWithStatus.length}), тип: ${module.type}`);
              
              const mockReq = {
                body: {
                  messages: [{ role: 'user', content: prompt }],
                  system_prompt: 'Ты опытный преподаватель программирования. Создавай качественный образовательный контент.',
                  temperature: 0.7,
                  max_tokens: 2000,
                }
              };
              
              // Создаем моковый res объект для handleDeepSeek
              let responseData = null;
              let responseError = null;
              
              const mockRes = {
                json: (data) => {
                  responseData = data;
                  console.log(`[Courses] Получен ответ от AI для модуля ${module.id}, длина текста: ${data?.text?.length || 0}`);
                },
                status: (code) => ({
                  json: (data) => {
                    responseError = new Error(data.error || `HTTP ${code}`);
                    console.error(`[Courses] Ошибка HTTP ${code} для модуля ${module.id}:`, data);
                    throw responseError;
                  }
                })
              };
              
              // Вызываем handleDeepSeek и получаем результат
              try {
                await handleDeepSeek(mockReq, mockRes);
                
                // Проверяем, была ли ошибка
                if (responseError) {
                  throw responseError;
                }
                
                // Обрабатываем результат
                if (responseData && responseData.text && responseData.text.trim()) {
                  const generatedContent = responseData.text.trim();
                  module[fieldToUpdate] = generatedContent;
                  module.contentGenerating = false; // Убираем флаг генерации
                  console.log(`[Courses] Контент сгенерирован для модуля ${module.id} (${index + 1}/${modulesWithStatus.length}), поле ${fieldToUpdate}, длина: ${generatedContent.length}`);
                  
                  // Загружаем актуальную версию курса перед обновлением
                  const { getCourse: getCourseById } = await import('./utils/learningStorage.js');
                  const currentCourse = await getCourseById(courseId);
                  
                  if (!currentCourse) {
                    console.error(`[Courses] Курс ${courseId} не найден при обновлении модуля ${module.id}`);
                    return;
                  }
                  
                  // Обновляем только нужный модуль и убираем флаги генерации/ожидания
                  const updatedModules = currentCourse.modules.map(m => {
                    if (m.id === module.id) {
                      return {
                        ...module,
                        contentGenerating: false,
                        contentWaiting: false,
                      };
                    }
                    return m;
                  });
                  
                  await saveCourse({
                    ...currentCourse,
                    modules: updatedModules,
                  });
                  
                  console.log(`[Courses] Курс обновлен после генерации модуля ${module.id} (${index + 1}/${total})`);
                } else {
                  console.warn(`[Courses] Пустой ответ от AI для модуля ${module.id}, responseData:`, JSON.stringify(responseData));
                }
              } catch (handleError) {
                console.error(`[Courses] Ошибка при вызове handleDeepSeek для модуля ${module.id}:`, handleError);
                throw handleError;
              }
            } catch (genError) {
              console.error(`[Courses] Ошибка при генерации контента для модуля ${module.id}:`, genError);
              // Помечаем модуль как завершивший генерацию с ошибкой
              module.contentGenerating = false;
              // Продолжаем выполнение даже если не удалось сгенерировать контент для одного модуля
            }
          }
        };
        
        // Запускаем генерацию модулей последовательно
        // Каждый следующий модуль создается на основе уже созданных
        (async () => {
          try {
            const { getCourse: getCourseById } = await import('./utils/learningStorage.js');
            let currentCourse = await getCourseById(savedCourse.id);
            
            if (!currentCourse) {
              console.error(`[Courses] Курс ${savedCourse.id} не найден при начале генерации модулей`);
              return;
            }
            
            // Сортируем модули по порядку
            const sortedModules = [...modulesWithStatus].sort((a, b) => a.order - b.order);
            
            // Помечаем модули как ожидающие перед началом генерации
            const updateWaitingStatus = async (currentGeneratingOrder = null) => {
              const { getCourse: getCourseById } = await import('./utils/learningStorage.js');
              const courseToUpdate = await getCourseById(savedCourse.id);
              if (!courseToUpdate) return;
              
              // Если порядок не указан, находим текущий генерируемый модуль (первый без контента)
              if (currentGeneratingOrder === null) {
                const sortedCourseModules = [...courseToUpdate.modules].sort((a, b) => a.order - b.order);
                for (const m of sortedCourseModules) {
                  const needsContent = 
                    (m.type === 'theory' && (!m.content || m.content.length < 50)) ||
                    (m.type === 'practice' && (!m.practiceTask || m.practiceTask.length < 50)) ||
                    (m.type === 'project' && (!m.projectDescription || m.projectDescription.length < 50)) ||
                    (m.type === 'test' && !m.testId);
                  
                  if (needsContent) {
                    currentGeneratingOrder = m.order;
                    break;
                  }
                }
              }
              
              // Обновляем статусы модулей
              const updatedModules = courseToUpdate.modules.map(m => {
                const needsContent = 
                  (m.type === 'theory' && (!m.content || m.content.length < 50)) ||
                  (m.type === 'practice' && (!m.practiceTask || m.practiceTask.length < 50)) ||
                  (m.type === 'project' && (!m.projectDescription || m.projectDescription.length < 50)) ||
                  (m.type === 'test' && !m.testId);
                
                // Если модуль уже имеет контент, убираем все флаги
                if (!needsContent) {
                  return {
                    ...m,
                    contentGenerating: false,
                    contentWaiting: false,
                  };
                }
                
                // Определяем статус модуля
                const isGenerating = currentGeneratingOrder !== null && m.order === currentGeneratingOrder;
                const isWaiting = currentGeneratingOrder !== null && m.order > currentGeneratingOrder;
                
                return {
                  ...m,
                  contentGenerating: isGenerating,
                  contentWaiting: isWaiting,
                };
              });
              
              await saveCourse({
                ...courseToUpdate,
                modules: updatedModules,
              });
            };
            
            // Обновляем статусы перед началом генерации
            await updateWaitingStatus();
            
            // Обновляем статусы перед началом генерации
            await updateWaitingStatus();
            
            console.log(`[Courses] Начинаем последовательную генерацию контента для ${sortedModules.length} модулей`);
            
            for (let i = 0; i < sortedModules.length; i++) {
              const module = sortedModules[i];
              
              // Обновляем статусы перед генерацией каждого модуля
              await updateWaitingStatus(module.order);
              
              // Пропускаем модули, у которых уже есть контент
              if (module.type === 'theory' && module.content && module.content.length > 50) {
                console.log(`[Courses] Модуль ${module.id} (${i + 1}/${sortedModules.length}) уже имеет контент, пропускаем`);
                continue;
              }
              if (module.type === 'practice' && module.practiceTask && module.practiceTask.length > 50) {
                console.log(`[Courses] Модуль ${module.id} (${i + 1}/${sortedModules.length}) уже имеет практическое задание, пропускаем`);
                continue;
              }
              if (module.type === 'project' && module.projectDescription && module.projectDescription.length > 50) {
                console.log(`[Courses] Модуль ${module.id} (${i + 1}/${sortedModules.length}) уже имеет описание проекта, пропускаем`);
                continue;
              }
              if (module.type === 'test' && module.testId) {
                console.log(`[Courses] Модуль ${module.id} (${i + 1}/${sortedModules.length}) уже имеет тест, пропускаем`);
                continue;
              }
              
              // Загружаем актуальную версию курса перед генерацией каждого модуля
              currentCourse = await getCourseById(savedCourse.id);
              if (!currentCourse) {
                console.error(`[Courses] Курс ${savedCourse.id} не найден при генерации модуля ${module.id}`);
                break;
              }
              
              // Обновляем модуль из актуального курса
              const currentModule = currentCourse.modules.find(m => m.id === module.id) || module;
              
              // Генерируем название модуля, если оно еще не было сгенерировано (проверяем по шаблону)
              const isDefaultTitle = currentModule.title.match(/^Модуль \d+:/);
              if (isDefaultTitle) {
                console.log(`[Courses] Генерируем название для модуля ${i + 1}/${sortedModules.length} (${currentModule.type})`);
                
                // Получаем уже созданные модули (до текущего)
                const completedModules = currentCourse.modules
                  .filter(m => m.order < currentModule.order)
                  .sort((a, b) => a.order - b.order);
                
                // Создаем контекст для генерации названия
                let titleContext = '';
                if (completedModules.length > 0) {
                  titleContext = '\n\nУже созданные модули курса:\n';
                  completedModules.forEach((m, idx) => {
                    titleContext += `${idx + 1}. ${m.title}\n`;
                  });
                  titleContext += '\nНазвание должно логически продолжать последовательность модулей.\n';
                }
                
                const moduleTypeName = currentModule.type === 'theory' ? 'теоретический модуль' : 
                                     currentModule.type === 'practice' ? 'практический модуль' : 
                                     currentModule.type === 'test' ? 'тест' : 'проект';
                
                const titlePrompt = `Придумай краткое и информативное название для ${moduleTypeName} курса по теме "${topic}" для уровня ${difficulty}. 

Это модуль номер ${currentModule.order} из ${sortedModules.length} модулей курса.${titleContext}

Название должно быть:
- Кратким (до 5-7 слов)
- Информативным и отражающим содержание модуля
- Соответствующим уровню сложности "${difficulty}"
- Логически связанным с предыдущими модулями (если они есть)

Верни только название без дополнительных пояснений.`;

                try {
                  const titleReq = {
                    body: {
                      messages: [{ role: 'user', content: titlePrompt }],
                      system_prompt: 'Ты опытный преподаватель программирования. Создавай качественные и информативные названия для модулей курсов.',
                      temperature: 0.7,
                      max_tokens: 100,
                    }
                  };
                  
                  let titleResponseData = null;
                  let titleResponseError = null;
                  
                  const titleMockRes = {
                    json: (data) => {
                      titleResponseData = data;
                    },
                    status: (code) => ({
                      json: (data) => {
                        titleResponseError = new Error(data.error || `HTTP ${code}`);
                        throw titleResponseError;
                      }
                    })
                  };
                  
                  await handleDeepSeek(titleReq, titleMockRes);
                  
                  if (!titleResponseError && titleResponseData && titleResponseData.text) {
                    const generatedTitle = titleResponseData.text.trim().replace(/^["']|["']$/g, ''); // Убираем кавычки если есть
                    currentModule.title = generatedTitle;
                    console.log(`[Courses] Название модуля ${currentModule.id} сгенерировано: "${generatedTitle}"`);
                    
                    // Сохраняем обновленное название
                    const updatedModules = currentCourse.modules.map(m => 
                      m.id === currentModule.id ? currentModule : m
                    );
                    
                    await saveCourse({
                      ...currentCourse,
                      modules: updatedModules,
                    });
                    
                    // Обновляем currentCourse для дальнейшего использования
                    currentCourse = await getCourseById(savedCourse.id);
                    
                    // Обновляем статусы после сохранения названия
                    await updateWaitingStatus(currentModule.order);
                  }
                } catch (titleError) {
                  console.error(`[Courses] Ошибка при генерации названия для модуля ${currentModule.id}:`, titleError);
                  // Продолжаем с исходным названием
                }
              }
              
              console.log(`[Courses] Генерируем модуль ${i + 1}/${sortedModules.length}: ${currentModule.title} (${currentModule.type})`);
              
              // Получаем уже созданные модули (до текущего) для контекста контента
              const completedModules = currentCourse.modules
                .filter(m => m.order < currentModule.order)
                .sort((a, b) => a.order - b.order);
              
              // Создаем контекст из уже созданных модулей
              let contextSummary = '';
              if (completedModules.length > 0) {
                contextSummary = '\n\nУже созданные модули курса:\n';
                completedModules.forEach((m, idx) => {
                  contextSummary += `${idx + 1}. ${m.title} (${m.type === 'theory' ? 'Теория' : m.type === 'practice' ? 'Практика' : m.type === 'test' ? 'Тест' : 'Проект'})`;
                  if (m.type === 'theory' && m.content) {
                    contextSummary += `\n   Краткое содержание: ${m.content.substring(0, 200)}...`;
                  } else if (m.type === 'practice' && m.practiceTask) {
                    contextSummary += `\n   Задание: ${m.practiceTask.substring(0, 200)}...`;
                  } else if (m.type === 'project' && m.projectDescription) {
                    contextSummary += `\n   Описание: ${m.projectDescription.substring(0, 200)}...`;
                  }
                  contextSummary += '\n';
                });
                contextSummary += '\nТекущий модуль должен логически продолжать и развивать материал из предыдущих модулей.\n';
              }
              
              // Генерируем контент для текущего модуля с учетом контекста
              await generateModuleContentWithContext(currentModule, i, sortedModules.length, topic, difficulty, contextSummary, savedCourse.id);
              
              // Обновляем статусы после генерации модуля (следующий модуль станет генерирующимся)
              const nextModule = sortedModules[i + 1];
              if (nextModule) {
                await updateWaitingStatus(nextModule.order);
              } else {
                // Если это последний модуль, просто обновляем статусы
                await updateWaitingStatus();
              }
              
              // Небольшая задержка между модулями для стабильности
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Финальное обновление статусов после завершения всех модулей
            await updateWaitingStatus();
            
            console.log('[Courses] Последовательная генерация контента для всех модулей завершена');
          } catch (error) {
            console.error('[Courses] Ошибка при последовательной генерации контента модулей:', error);
          }
        })();
        
        // Не ждем завершения генерации - возвращаем курс сразу
        console.log(`[Courses] Генерация контента модулей запущена последовательно в фоне для ${modulesWithStatus.length} модулей`);
      } catch (aiError) {
        console.error('[Courses] Ошибка при запуске генерации контента модулей:', aiError);
        // Продолжаем выполнение даже если не удалось использовать AI
      }
    }

    // Если нужно создать задачи в Todoist
    if (generateTasks && savedCourse) {
      try {
        const { callTool: callMCPTool } = await import('./mcp/orchestrator.js');
        // Создаем проект в Todoist
        const projectResult = await callMCPTool(
          'createProject',
          {
            name: savedCourse.title,
            color: 47, // Синий цвет
          },
          'todoist-mcp-server',
          false
        );

        if (projectResult.success && projectResult.result) {
          const projectId = projectResult.result.id;
          savedCourse.todoistProjectId = projectId;

          // Создаем задачи для каждого модуля
          for (const module of savedCourse.modules || []) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + module.order);
            
            await callMCPTool(
              'createTask',
              {
                content: `${module.title} - ${savedCourse.title}`,
                description: module.type === 'theory' ? module.content?.substring(0, 500) : 
                            module.type === 'practice' ? module.practiceTask?.substring(0, 500) : 
                            module.type === 'project' ? module.projectDescription?.substring(0, 500) : '',
                projectId: projectId,
                priority: module.order <= 3 ? 4 : 3,
                dueDate: dueDate.toISOString().split('T')[0],
              },
              'todoist-mcp-server',
              false
            );
          }

          // Обновляем курс с projectId
          await saveCourse(savedCourse);
        }
      } catch (taskError) {
        console.error('Ошибка при создании задач в Todoist:', taskError);
        // Не прерываем выполнение, просто логируем ошибку
      }
    }

    res.json(savedCourse);
  } catch (error) {
    console.error('[Courses] Ошибка при генерации курса:', error);
    console.error('[Courses] Stack trace:', error.stack);
    res.status(500).json({ error: 'Не удалось сгенерировать курс: ' + (error.message || 'Неизвестная ошибка') });
  }
});

app.patch('/api/courses/:courseId/modules/:moduleId/progress', async (req, res) => {
  try {
    const { courseId, moduleId } = req.params;
    const { completed } = req.body;
    const course = await getCourse(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Курс не найден' });
    }

    // Обновляем прогресс модуля
    const module = course.modules.find(m => m.id === moduleId);
    if (!module) {
      return res.status(404).json({ error: 'Модуль не найден' });
    }

    module.completed = completed;
    
    // Пересчитываем общий прогресс
    const completedModules = course.modules.filter(m => m.completed).length;
    course.progress = Math.round((completedModules / course.modules.length) * 100);
    course.completed = course.progress === 100;

    // Сохраняем обновленный курс
    await saveCourse(course);

    res.json(course);
  } catch (error) {
    console.error('Ошибка при обновлении прогресса:', error);
    res.status(500).json({ error: 'Не удалось обновить прогресс' });
  }
});

app.post('/api/courses/:courseId/generate-tasks', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await getCourse(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Курс не найден' });
    }

    const { callTool: callMCPTool } = await import('./mcp/orchestrator.js');
    
    // Создаем проект в Todoist, если его еще нет
    let projectId = course.todoistProjectId;
    if (!projectId) {
      try {
        const projectResult = await callMCPTool(
          'createProject',
          {
            name: course.title,
            color: 47,
          },
          'todoist-mcp-server',
          false
        );

        console.log('[Courses] Результат создания проекта:', JSON.stringify(projectResult, null, 2));

        // callTodoistMCPTool возвращает либо распарсенный JSON, либо строку
        // Если это строка, пытаемся извлечь JSON из неё
        let projectData = null;
        if (typeof projectResult === 'string') {
          // Пытаемся найти JSON в строке
          const jsonMatch = projectResult.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              projectData = JSON.parse(jsonMatch[0]);
            } catch (e) {
              console.error('[Courses] Ошибка парсинга JSON из строки результата:', e);
            }
          }
        } else if (typeof projectResult === 'object' && projectResult !== null) {
          projectData = projectResult;
        }

        if (!projectData || !projectData.id) {
          console.error('[Courses] Не удалось извлечь ID проекта из результата:', projectResult);
          return res.status(500).json({ error: 'Не удалось создать проект в Todoist: не получен ID проекта' });
        }

        projectId = projectData.id;
        course.todoistProjectId = projectId;
        await saveCourse(course);
        console.log('[Courses] Проект создан в Todoist, ID:', projectId);
      } catch (projectError) {
        console.error('[Courses] Ошибка при создании проекта в Todoist:', projectError);
        return res.status(500).json({ error: 'Не удалось создать проект в Todoist: ' + (projectError.message || 'Неизвестная ошибка') });
      }
    }

    // Создаем задачи для каждого модуля
    let tasksCount = 0;
    const errors = [];
    
    for (const module of course.modules || []) {
      try {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + module.order);
        
        const taskResult = await callMCPTool(
          'createTask',
          {
            content: `${module.title} - ${course.title}`,
            description: module.type === 'theory' ? module.content?.substring(0, 500) : 
                        module.type === 'practice' ? module.practiceTask?.substring(0, 500) : 
                        module.type === 'project' ? module.projectDescription?.substring(0, 500) : '',
            projectId: projectId,
            priority: module.order <= 3 ? 4 : 3,
            dueDate: dueDate.toISOString().split('T')[0],
          },
          'todoist-mcp-server',
          false
        );

        console.log(`[Courses] Результат создания задачи для модуля ${module.id}:`, JSON.stringify(taskResult, null, 2));

        // Проверяем результат создания задачи
        // Если это строка с ошибкой, пропускаем
        if (typeof taskResult === 'string' && taskResult.includes('Ошибка')) {
          console.warn(`[Courses] Ошибка при создании задачи для модуля ${module.id}:`, taskResult);
          errors.push(`Модуль ${module.title}: ${taskResult}`);
          continue;
        }

        // Если это объект или строка с успешным результатом, считаем задачу созданной
        if (typeof taskResult === 'object' || (typeof taskResult === 'string' && !taskResult.includes('Ошибка'))) {
          tasksCount++;
        }
      } catch (taskError) {
        console.error(`[Courses] Ошибка при создании задачи для модуля ${module.id}:`, taskError);
        errors.push(`Модуль ${module.title}: ${taskError.message || 'Неизвестная ошибка'}`);
      }
    }

    if (tasksCount === 0 && errors.length > 0) {
      return res.status(500).json({ 
        error: 'Не удалось создать задачи в Todoist',
        details: errors 
      });
    }

    res.json({ 
      success: true, 
      projectId, 
      tasksCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('[Courses] Ошибка при генерации задач:', error);
    console.error('[Courses] Stack trace:', error.stack);
    res.status(500).json({ error: 'Не удалось сгенерировать задачи: ' + (error.message || 'Неизвестная ошибка') });
  }
});

app.delete('/api/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const success = await deleteCourse(courseId);
    if (!success) {
      return res.status(404).json({ error: 'Курс не найден' });
    }
    res.json({ success: true, message: 'Курс успешно удален' });
  } catch (error) {
    console.error('Ошибка при удалении курса:', error);
    res.status(500).json({ error: 'Не удалось удалить курс' });
  }
});

// SSE эндпоинт для получения статусов выполнения инструментов
app.get('/api/status/:requestId', (req, res) => {
  const { requestId } = req.params;
  
  if (!requestId) {
    return res.status(400).json({ error: 'requestId обязателен' });
  }

  // Регистрируем соединение для отправки статусов
  registerConnection(requestId, res);
});

// Эндпоинты для работы с индексацией документов
// Создаем глобальный экземпляр индексатора
let documentIndexer = null;
let ragService = null;

async function getDocumentIndexer() {
  if (!documentIndexer) {
    documentIndexer = new DocumentIndexer({
      embeddingConfig: {
        apiUrl: process.env.LM_STUDIO_URL || 'http://localhost:1234/v1/embeddings',
        apiKey: process.env.LM_STUDIO_API_KEY || 'lm-studio',
        model: process.env.LM_STUDIO_EMBEDDING_MODEL || 'text-embedding-nomic-embed-text-v1.5',
      },
      chunkOptions: {
        chunkSize: parseInt(process.env.DOCUMENT_CHUNK_SIZE) || 1000,
        chunkOverlap: parseInt(process.env.DOCUMENT_CHUNK_OVERLAP) || 200,
      },
    });
    await documentIndexer.initialize();
  }
  return documentIndexer;
}

async function getRAGService(rerankerConfig = null) {
  // Если нужна другая конфигурация reranker, создаем новый экземпляр
  if (!ragService || rerankerConfig) {
    const indexer = await getDocumentIndexer();
    ragService = new RAGService(indexer, rerankerConfig);
  }
  return ragService;
}

let supportService = null;

async function getSupportService() {
  if (!supportService) {
    const rag = await getRAGService();
    supportService = new SupportService(rag);
  }
  return supportService;
}

// Инициализация индексатора при запуске сервера
async function initializeDocumentIndex() {
  try {
    const indexer = await getDocumentIndexer();
    
    // Проверяем, нужно ли индексировать README и docs
    const stats = indexer.getStats();
    const documents = indexer.index.getAllDocuments();
    
    // Проверяем, есть ли уже README и docs в индексе
    const hasReadme = documents.some(doc => doc.fileName === 'README.md');
    const hasDocs = documents.some(doc => doc.filePath && doc.filePath.includes('docs/'));
    
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');
    const fs = await import('fs/promises');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = path.resolve(__dirname, '..');
    
    // Индексируем README.md, если его нет
    if (!hasReadme) {
      try {
        const readmePath = path.join(projectRoot, 'README.md');
        await fs.access(readmePath);
        console.log('[Document Index] Индексация README.md...');
        await indexer.indexFile(readmePath, (progress) => {
          if (progress.stage === 'embedding' && progress.progress !== undefined) {
            process.stdout.write(`\r${progress.message}... `);
          } else {
            console.log(progress.message);
          }
        });
        console.log('✅ README.md проиндексирован\n');
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn('[Document Index] Ошибка при индексации README.md:', error.message);
        }
      }
    }
    
    // Индексируем папку docs, если её нет
    if (!hasDocs) {
      try {
        const docsPath = path.join(projectRoot, 'docs');
        await fs.access(docsPath);
        const docsStats = await fs.stat(docsPath);
        if (docsStats.isDirectory()) {
          console.log('[Document Index] Индексация папки docs...');
          await indexer.indexDirectory(docsPath, ['.git', 'node_modules'], (progress) => {
            if (progress.stage === 'embedding' && progress.progress !== undefined) {
              process.stdout.write(`\r${progress.message}... `);
            } else {
              console.log(progress.message);
            }
          });
          console.log('✅ Папка docs проиндексирована\n');
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn('[Document Index] Ошибка при индексации папки docs:', error.message);
        }
      }
    }
  } catch (err) {
    console.warn('Не удалось инициализировать индексатор документов:', err.message);
  }
}

// Инициализируем индекс при запуске
initializeDocumentIndex().catch(err => {
  console.warn('Не удалось инициализировать индекс документов:', err.message);
});

// Проверка доступности API эмбеддингов
app.get('/api/documents/embedding/check', async (req, res) => {
  try {
    const indexer = await getDocumentIndexer();
    const isAvailable = await indexer.checkEmbeddingAvailability();
    res.json({ available: isAvailable });
  } catch (error) {
    console.error('Ошибка при проверке API эмбеддингов:', error);
    res.status(500).json({ error: error.message, available: false });
  }
});

// Статистика индекса
app.get('/api/documents/stats', async (req, res) => {
  try {
    const indexer = await getDocumentIndexer();
    const stats = indexer.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    res.status(500).json({ error: error.message });
  }
});

// Индексация файла
app.post('/api/documents/index/file', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'filePath обязателен' });
    }

    const indexer = await getDocumentIndexer();
    const result = await indexer.indexFile(filePath, (progress) => {
      // Можно использовать SSE для отправки прогресса
      console.log('Прогресс индексации:', progress);
    });

    res.json(result);
  } catch (error) {
    console.error('Ошибка при индексации файла:', error);
    res.status(500).json({ error: error.message });
  }
});

// Индексация директории
app.post('/api/documents/index/directory', async (req, res) => {
  try {
    const { dirPath, ignorePatterns } = req.body;
    if (!dirPath) {
      return res.status(400).json({ error: 'dirPath обязателен' });
    }

    const indexer = await getDocumentIndexer();
    const result = await indexer.indexDirectory(
      dirPath,
      ignorePatterns || ['.git', 'node_modules', 'dist', '.next', 'build'],
      (progress) => {
        console.log('Прогресс индексации:', progress);
      }
    );

    res.json(result);
  } catch (error) {
    console.error('Ошибка при индексации директории:', error);
    res.status(500).json({ error: error.message });
  }
});

// Индексация текста
app.post('/api/documents/index/text', async (req, res) => {
  try {
    const { text, metadata } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'text обязателен' });
    }

    const indexer = await getDocumentIndexer();
    const result = await indexer.indexText(text, metadata || {}, (progress) => {
      console.log('Прогресс индексации:', progress);
    });

    res.json(result);
  } catch (error) {
    console.error('Ошибка при индексации текста:', error);
    res.status(500).json({ error: error.message });
  }
});

// Поиск по индексу
app.post('/api/documents/search', async (req, res) => {
  try {
    const { query, topK = 5, minScore = 0.5 } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'query обязателен' });
    }

    const indexer = await getDocumentIndexer();
    const results = await indexer.search(query, topK, minScore);

    res.json({
      query,
      results: results.map(r => ({
        text: r.chunk.text,
        score: r.score,
        metadata: r.chunk.metadata,
        document: r.document,
      })),
    });
  } catch (error) {
    console.error('Ошибка при поиске:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получение всех документов
app.get('/api/documents', async (req, res) => {
  try {
    const indexer = await getDocumentIndexer();
    const documents = indexer.index.getAllDocuments();
    res.json(documents);
  } catch (error) {
    console.error('Ошибка при получении документов:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получение чанков документа
app.get('/api/documents/:documentId/chunks', async (req, res) => {
  try {
    const { documentId } = req.params;
    const indexer = await getDocumentIndexer();
    const chunks = indexer.index.getChunksByDocument(documentId);
    res.json(chunks.map(chunk => ({
      id: chunk.id,
      text: chunk.text,
      metadata: chunk.metadata,
      // Не отправляем эмбеддинги для экономии трафика
    })));
  } catch (error) {
    console.error('Ошибка при получении чанков:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получение содержимого документа по имени файла
app.get('/api/documents/content/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const indexer = await getDocumentIndexer();
    const documents = indexer.index.getAllDocuments();
    
    // Находим документ по имени файла
    const document = documents.find(doc => doc.fileName === fileName);
    
    if (!document) {
      return res.status(404).json({ error: 'Документ не найден' });
    }
    
    // Читаем содержимое файла
    const fs = await import('fs/promises');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    // Путь к файлу документа
    const documentsDir = path.join(__dirname, 'data', 'documents');
    const filePath = path.join(documentsDir, fileName);
    
    // Проверяем существование файла
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Файл не найден' });
    }
    
    // Читаем содержимое файла
    const content = await fs.readFile(filePath, 'utf-8');
    
    res.json({
      fileName: document.fileName,
      content: content,
      type: document.type,
      filePath: document.filePath,
      addedAt: document.addedAt,
    });
  } catch (error) {
    console.error('Ошибка при получении содержимого документа:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удаление документа из индекса
app.delete('/api/documents/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const indexer = await getDocumentIndexer();
    const success = indexer.index.removeDocument(documentId);
    
    if (success) {
      await indexer.index.save();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Документ не найден' });
    }
  } catch (error) {
    console.error('Ошибка при удалении документа:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для сравнения ответов с RAG и без RAG
app.post('/api/rag/compare', async (req, res) => {
  try {
    const { question, modelType, messages = [], topK = 5, minScore = 0.3, model, temperature, max_tokens, system_prompt } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'question обязателен' });
    }

    if (!modelType) {
      return res.status(400).json({ error: 'modelType обязателен (deepseek, yandex, chatgpt, huggingface)' });
    }

    // Получаем RAG сервис
    const rag = await getRAGService();

    // Создаем функцию для вызова LLM в зависимости от типа модели
    const llmCaller = async (prompt, historyMessages) => {
      const requestBody = {
        messages: historyMessages.length > 0 
          ? historyMessages 
          : [{ role: 'user', content: prompt }],
        system_prompt: system_prompt || '',
        model: model || undefined,
        temperature: temperature || 0.3,
        max_tokens: max_tokens || 2000,
      };

      let handler;
      let apiUrl;

      switch (modelType.toLowerCase()) {
        case 'deepseek':
          handler = handleDeepSeek;
          apiUrl = '/api/deepseek';
          break;
        case 'yandex':
        case 'yandexgpt':
          handler = handleYandexGPT;
          apiUrl = '/api/yandex-gpt';
          break;
        case 'chatgpt':
        case 'openai':
          handler = handleChatGPT;
          apiUrl = '/api/chatgpt';
          break;
        case 'huggingface':
          handler = handleHuggingFace;
          apiUrl = '/api/huggingface';
          break;
        case 'lmstudio':
          handler = handleLMStudio;
          apiUrl = '/api/lmstudio';
          break;
        case 'ollama':
          handler = handleOllama;
          apiUrl = '/api/ollama';
          break;
        default:
          throw new Error(`Неподдерживаемый тип модели: ${modelType}`);
      }

      // Вызываем обработчик через внутренний запрос
      return new Promise((resolve, reject) => {
        const mockReq = { body: requestBody };
        const mockRes = {
          json: (data) => resolve(data),
          status: (code) => ({
            json: (data) => reject(new Error(data.error || `HTTP ${code}`)),
          }),
        };

        handler(mockReq, mockRes).catch(reject);
      });
    };

    // Выполняем сравнение
    const comparison = await rag.compareRAGvsNoRAG(question, llmCaller, {
      messages,
      topK,
      minScore,
    });

    res.json(comparison);
  } catch (error) {
    console.error('Ошибка при сравнении RAG:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для запроса с RAG
app.post('/api/rag/query', async (req, res) => {
  try {
    const { 
      question, 
      modelType, 
      messages = [], 
      topK = 5, 
      minScore = 0.3, 
      model, 
      temperature, 
      max_tokens, 
      system_prompt,
      useReranker = false,
      reranker = {},
    } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'question обязателен' });
    }

    if (!modelType) {
      return res.status(400).json({ error: 'modelType обязателен' });
    }

    // Создаем конфигурацию reranker, если нужно
    let rerankerConfig = null;
    if (useReranker) {
      rerankerConfig = {
        strategy: reranker.strategy || 'threshold',
        relevanceThreshold: reranker.threshold ?? 0.5,
        topKAfterRerank: reranker.topKAfterRerank || topK,
        llmCaller: null, // Будет установлен позже, если нужен LLM-based reranking
      };
    }

    const rag = await getRAGService(rerankerConfig);

    const llmCaller = async (prompt, historyMessages) => {
      const requestBody = {
        messages: historyMessages.length > 0 
          ? historyMessages 
          : [{ role: 'user', content: prompt }],
        system_prompt: system_prompt || '',
        model: model || undefined,
        temperature: temperature || 0.3,
        max_tokens: max_tokens || 2000,
      };

      let handler;
      switch (modelType.toLowerCase()) {
        case 'deepseek':
          handler = handleDeepSeek;
          break;
        case 'yandex':
        case 'yandexgpt':
          handler = handleYandexGPT;
          break;
        case 'chatgpt':
        case 'openai':
          handler = handleChatGPT;
          break;
        case 'huggingface':
          handler = handleHuggingFace;
          break;
        case 'lmstudio':
          handler = handleLMStudio;
          break;
        default:
          throw new Error(`Неподдерживаемый тип модели: ${modelType}`);
      }

      return new Promise((resolve, reject) => {
        const mockReq = { body: requestBody };
        const mockRes = {
          json: (data) => resolve(data),
          status: (code) => ({
            json: (data) => reject(new Error(data.error || `HTTP ${code}`)),
          }),
        };

        handler(mockReq, mockRes).catch(reject);
      });
    };

    // Если нужен LLM-based reranking, устанавливаем llmCaller в reranker
    if (useReranker && rerankerConfig && (rerankerConfig.strategy === 'llm_score' || rerankerConfig.strategy === 'hybrid')) {
      rerankerConfig.llmCaller = llmCaller;
      // Пересоздаем RAGService с обновленной конфигурацией
      const indexer = await getDocumentIndexer();
      rag.reranker = new (await import('./rag/reranker/relevanceReranker.js')).RelevanceReranker(rerankerConfig);
    }

    const result = await rag.queryWithRAG(question, llmCaller, {
      messages,
      topK,
      minScore,
      useReranker,
      reranker: rerankerConfig,
    });

    res.json(result);
  } catch (error) {
    console.error('Ошибка при RAG запросе:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для сравнения качества с фильтром reranker и без фильтра
app.post('/api/rag/compare-reranker', async (req, res) => {
  try {
    const { 
      question, 
      modelType, 
      messages = [], 
      topK = 5, 
      minScore = 0.3, 
      model, 
      temperature, 
      max_tokens, 
      system_prompt,
      reranker = {},
    } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'question обязателен' });
    }

    if (!modelType) {
      return res.status(400).json({ error: 'modelType обязателен' });
    }

    // Создаем конфигурацию reranker
    const rerankerConfig = {
      strategy: reranker.strategy || 'threshold',
      relevanceThreshold: reranker.threshold ?? 0.5,
      topKAfterRerank: reranker.topKAfterRerank || topK,
      llmCaller: null,
    };

    const rag = await getRAGService(rerankerConfig);

    const llmCaller = async (prompt, historyMessages) => {
      const requestBody = {
        messages: historyMessages.length > 0 
          ? historyMessages 
          : [{ role: 'user', content: prompt }],
        system_prompt: system_prompt || '',
        model: model || undefined,
        temperature: temperature || 0.3,
        max_tokens: max_tokens || 2000,
      };

      let handler;
      switch (modelType.toLowerCase()) {
        case 'deepseek':
          handler = handleDeepSeek;
          break;
        case 'yandex':
        case 'yandexgpt':
          handler = handleYandexGPT;
          break;
        case 'chatgpt':
        case 'openai':
          handler = handleChatGPT;
          break;
        case 'huggingface':
          handler = handleHuggingFace;
          break;
        case 'lmstudio':
          handler = handleLMStudio;
          break;
        default:
          throw new Error(`Неподдерживаемый тип модели: ${modelType}`);
      }

      return new Promise((resolve, reject) => {
        const mockReq = { body: requestBody };
        const mockRes = {
          json: (data) => resolve(data),
          status: (code) => ({
            json: (data) => reject(new Error(data.error || `HTTP ${code}`)),
          }),
        };

        handler(mockReq, mockRes).catch(reject);
      });
    };

    // Если нужен LLM-based reranking, устанавливаем llmCaller
    if (rerankerConfig.strategy === 'llm_score' || rerankerConfig.strategy === 'hybrid') {
      rerankerConfig.llmCaller = llmCaller;
      const indexer = await getDocumentIndexer();
      rag.reranker = new (await import('./rag/reranker/relevanceReranker.js')).RelevanceReranker(rerankerConfig);
    }

    const comparison = await rag.compareWithAndWithoutReranker(question, llmCaller, {
      messages,
      topK,
      minScore,
      reranker: rerankerConfig,
    });

    res.json(comparison);
  } catch (error) {
    console.error('Ошибка при сравнении с reranker:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для поддержки пользователей (требует авторизации)
app.post('/api/support/query', authenticateToken, async (req, res) => {
  try {
    const {
      question,
      modelType,
      userName,
      userEmail,
      ticketId: providedTicketId,
      messages = [],
      topK = 5,
      minScore = 0.3,
      model,
      temperature,
      max_tokens,
      system_prompt,
    } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'question обязателен' });
    }

    if (!modelType) {
      return res.status(400).json({ error: 'modelType обязателен' });
    }

    // Получаем информацию о пользователе из токена
    const user = await findUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Используем данные авторизованного пользователя
    const finalUserName = userName || user.name;
    const finalUserEmail = userEmail || user.email;

    // Используем переданный ticketId или создаем новый тикет
    let createdTicketId = providedTicketId || null;
    if (!createdTicketId) {
      try {
        const { callTool } = await import('./mcp/orchestrator.js');
        
        console.log('Создание нового тикета для пользователя:', {
          userId: req.userId,
          userEmail: finalUserEmail,
          userName: finalUserName,
          subject: question.substring(0, 100),
        });
        
        // Создаем тикет с вопросом пользователя
        const ticketResult = await callTool('createTicket', {
          userEmail: finalUserEmail,
          userId: req.userId,
          subject: question.substring(0, 100), // Первые 100 символов как тема
          description: question,
          priority: 'medium',
          category: 'general',
        }, 'crm-mcp-server', true);

        console.log('Результат создания тикета (полный):', JSON.stringify(ticketResult, null, 2));
        
        // Извлекаем результат из обертки, если используется returnMetadata
        const actualTicketResult = ticketResult?.result !== undefined ? ticketResult.result : ticketResult;
        
        console.log('Результат создания тикета (извлеченный):', JSON.stringify(actualTicketResult, null, 2));
        
        if (actualTicketResult && actualTicketResult.success && actualTicketResult.ticket) {
          createdTicketId = actualTicketResult.ticket.id;
          console.log('Тикет создан успешно:', createdTicketId);
        } else {
          console.warn('Тикет не был создан. Результат:', JSON.stringify(actualTicketResult, null, 2));
        }
      } catch (error) {
        console.error('Ошибка при создании тикета:', error);
        console.error('Детали ошибки:', error.message);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
        // Продолжаем выполнение даже если не удалось создать
      }
    } else {
      console.log('Используется существующий тикет:', createdTicketId);
    }

    // Получаем сервис поддержки
    const support = await getSupportService();

    // Создаем функцию для вызова LLM
    const llmCaller = async (prompt, historyMessages) => {
      const requestBody = {
        messages: historyMessages.length > 0
          ? historyMessages
          : [{ role: 'user', content: prompt }],
        system_prompt: system_prompt || '',
        model: model || undefined,
        temperature: temperature || 0.3,
        max_tokens: max_tokens || 2000,
      };

      let handler;
      switch (modelType.toLowerCase()) {
        case 'deepseek':
          handler = handleDeepSeek;
          break;
        case 'yandex':
        case 'yandexgpt':
          handler = handleYandexGPT;
          break;
        case 'chatgpt':
        case 'openai':
          handler = handleChatGPT;
          break;
        case 'huggingface':
          handler = handleHuggingFace;
          break;
        case 'lmstudio':
          handler = handleLMStudio;
          break;
        default:
          throw new Error(`Неподдерживаемый тип модели: ${modelType}`);
      }

      return new Promise((resolve, reject) => {
        const mockReq = { body: requestBody };
        const mockRes = {
          json: (data) => resolve(data),
          status: (code) => ({
            json: (data) => reject(new Error(data.error || `HTTP ${code}`)),
          }),
        };

        handler(mockReq, mockRes).catch(reject);
      });
    };

    // Обрабатываем вопрос поддержки
    let result;
    try {
      result = await support.processSupportQuestion(question, llmCaller, {
        userEmail: finalUserEmail,
        ticketId: createdTicketId,
        messages,
        topK,
        minScore,
      });
    } catch (error) {
      console.error('Ошибка при обработке вопроса поддержки:', error);
      // Продолжаем выполнение, даже если была ошибка
      result = { answer: 'Извините, произошла ошибка при обработке вашего вопроса.' };
    }

    // Если тикет был создан, добавляем ответ ИИ в тикет
    console.log('=== ПРОВЕРКА УСЛОВИЙ ДЛЯ ДОБАВЛЕНИЯ ОТВЕТА ИИ ===');
    console.log('createdTicketId:', createdTicketId);
    console.log('result:', result ? JSON.stringify(result, null, 2) : 'null');
    console.log('result.answer:', result?.answer ? `"${result.answer.substring(0, 100)}..."` : 'undefined/null');
    console.log('hasAnswer:', !!result?.answer);
    console.log('answerLength:', result?.answer?.length);
    console.log('==================================================');
    
    if (createdTicketId && result?.answer) {
      console.log('✓ Условия выполнены, начинаем добавление ответа ИИ');
      try {
        const { callTool } = await import('./mcp/orchestrator.js');
        console.log('Добавление ответа ИИ в созданный тикет:', {
          ticketId: createdTicketId,
          answerLength: result.answer.length,
          answerPreview: result.answer.substring(0, 100)
        });
        
        const addMessageResult = await callTool('addTicketMessage', {
          ticketId: createdTicketId,
          author: 'assistant',
          text: result.answer,
        }, 'crm-mcp-server', true);
        
        // Извлекаем результат из обертки, если используется returnMetadata
        const actualResult = addMessageResult?.result !== undefined ? addMessageResult.result : addMessageResult;
        
        console.log('Результат добавления сообщения:', JSON.stringify(actualResult, null, 2));
        
        if (actualResult && actualResult.success) {
          console.log('Ответ ИИ успешно добавлен в тикет:', createdTicketId);
          
          // Проверяем, что сообщение действительно добавлено
          const verifyResult = await callTool('getTicket', {
            ticketId: createdTicketId,
          }, 'crm-mcp-server', true);
          
          const verifyActualResult = verifyResult?.result !== undefined ? verifyResult.result : verifyResult;
          if (verifyActualResult && verifyActualResult.found && verifyActualResult.ticket) {
            const messagesCount = verifyActualResult.ticket.messages?.length || 0;
            console.log(`Тикет содержит ${messagesCount} сообщений после добавления ответа ИИ`);
            if (messagesCount >= 2) {
              const lastMessage = verifyActualResult.ticket.messages[messagesCount - 1];
              console.log('Последнее сообщение:', {
                author: lastMessage.author,
                textPreview: lastMessage.text?.substring(0, 50)
              });
            } else {
              console.error('ОШИБКА: Сообщение не было добавлено! Тикет содержит только', messagesCount, 'сообщений');
            }
          }
        } else {
          console.error('ОШИБКА: Ответ ИИ не был добавлен в тикет. Результат:', JSON.stringify(actualResult, null, 2));
        }
      } catch (error) {
        console.error('КРИТИЧЕСКАЯ ОШИБКА при добавлении ответа ИИ в тикет:', error);
        console.error('Детали ошибки:', error.message);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
        // Не прерываем выполнение, просто логируем ошибку
      }
    } else {
      console.log('✗ Условия НЕ выполнены для добавления ответа ИИ');
      if (!createdTicketId) {
        console.log('  → Причина: Тикет не был создан (createdTicketId =', createdTicketId, ')');
      }
      if (!result?.answer) {
        console.log('  → Причина: Ответ ИИ пустой или отсутствует (result.answer =', result?.answer, ')');
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Ошибка при обработке вопроса поддержки:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для получения тикетов текущего пользователя
app.get('/api/support/tickets', authenticateToken, async (req, res) => {
  try {
    const { callTool } = await import('./mcp/orchestrator.js');
    
    // Получаем информацию о пользователе
    const user = await findUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Получаем тикеты пользователя
    console.log('Запрос тикетов для пользователя:', { userId: req.userId, email: user.email });
    
    const result = await callTool('getUserTickets', {
      userId: req.userId,
      email: user.email,
    }, 'crm-mcp-server', true);

    console.log('Результат getUserTickets (полный):', JSON.stringify(result, null, 2));
    
    // callTool с returnMetadata=true возвращает { result: ..., serverId: ..., ... }
    // getUserTickets возвращает { count: X, tickets: [...] }
    let tickets = [];
    
    // Извлекаем результат из обертки
    const actualResult = result?.result !== undefined ? result.result : result;
    
    console.log('actualResult:', JSON.stringify(actualResult, null, 2));
    
    // getUserTickets возвращает объект с полями count и tickets
    if (actualResult && actualResult.tickets && Array.isArray(actualResult.tickets)) {
      tickets = actualResult.tickets;
    } else if (actualResult && actualResult.content && Array.isArray(actualResult.content)) {
      // Если результат в формате MCP
      const content = actualResult.content[0];
      if (content && content.text) {
        try {
          const parsed = JSON.parse(content.text);
          tickets = parsed.tickets || parsed || [];
        } catch (e) {
          console.error('Ошибка парсинга результата MCP:', e);
        }
      }
    } else if (Array.isArray(actualResult)) {
      // Если результат - массив тикетов напрямую
      tickets = actualResult;
    }

    console.log('Тикеты для отправки:', tickets.length, tickets);
    res.json(tickets);
  } catch (error) {
    console.error('Ошибка при получении тикетов:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для получения тикета по ID
app.get('/api/support/tickets/:ticketId', authenticateToken, async (req, res) => {
  try {
    const { callTool } = await import('./mcp/orchestrator.js');
    const { ticketId } = req.params;
    
    // Получаем информацию о пользователе
    const user = await findUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Получаем тикет по ID
    console.log('Запрос тикета по ID:', { ticketId, userId: req.userId, email: user.email });
    
    const result = await callTool('getTicket', {
      ticketId: ticketId,
    }, 'crm-mcp-server', true);

    // Извлекаем результат из обертки
    const actualResult = result?.result !== undefined ? result.result : result;
    
    // getTicket возвращает объект с полями found и ticket
    if (actualResult && actualResult.found && actualResult.ticket) {
      const ticket = actualResult.ticket;
      
      // Проверяем, что тикет принадлежит текущему пользователю
      if (ticket.userId !== req.userId && ticket.userEmail !== user.email) {
        return res.status(403).json({ error: 'Доступ запрещен' });
      }
      
      res.json(ticket);
    } else {
      res.status(404).json({ error: 'Тикет не найден' });
    }
  } catch (error) {
    console.error('Ошибка при получении тикета:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для добавления сообщения в тикет
app.post('/api/support/tickets/:ticketId/messages', authenticateToken, async (req, res) => {
  try {
    const { callTool } = await import('./mcp/orchestrator.js');
    const { ticketId } = req.params;
    const { author, text } = req.body;
    
    if (!author || !text) {
      return res.status(400).json({ error: 'author и text обязательны' });
    }
    
    // Получаем информацию о пользователе
    const user = await findUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем, что тикет принадлежит пользователю
    const ticketResult = await callTool('getTicket', {
      ticketId: ticketId,
    }, 'crm-mcp-server', true);

    const actualResult = ticketResult?.result !== undefined ? ticketResult.result : ticketResult;
    
    if (!actualResult || !actualResult.found || !actualResult.ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }

    const ticket = actualResult.ticket;
    
    if (ticket.userId !== req.userId && ticket.userEmail !== user.email) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    // Добавляем сообщение в тикет
    console.log('Добавление сообщения в тикет:', { ticketId, author, text });
    
    const result = await callTool('addTicketMessage', {
      ticketId: ticketId,
      author: author,
      text: text,
    }, 'crm-mcp-server', true);

    // Извлекаем результат из обертки
    const actualMessageResult = result?.result !== undefined ? result.result : result;
    
    if (actualMessageResult && actualMessageResult.success) {
      // Возвращаем обновленный тикет
      const updatedTicketResult = await callTool('getTicket', {
        ticketId: ticketId,
      }, 'crm-mcp-server', true);

      const updatedActualResult = updatedTicketResult?.result !== undefined ? updatedTicketResult.result : updatedTicketResult;
      
      if (updatedActualResult && updatedActualResult.found && updatedActualResult.ticket) {
        res.json(updatedActualResult.ticket);
      } else {
        res.json({ success: true });
      }
    } else {
      res.status(500).json({ error: 'Не удалось добавить сообщение' });
    }
  } catch (error) {
    console.error('Ошибка при добавлении сообщения в тикет:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для удаления тикета
app.delete('/api/support/tickets/:ticketId', authenticateToken, async (req, res) => {
  try {
    const { callTool } = await import('./mcp/orchestrator.js');
    const { ticketId } = req.params;
    
    // Получаем информацию о пользователе
    const user = await findUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем, что тикет принадлежит пользователю
    const ticketResult = await callTool('getTicket', {
      ticketId: ticketId,
    }, 'crm-mcp-server', true);

    const actualResult = ticketResult?.result !== undefined ? ticketResult.result : ticketResult;
    
    if (!actualResult || !actualResult.found || !actualResult.ticket) {
      return res.status(404).json({ error: 'Тикет не найден' });
    }

    const ticket = actualResult.ticket;
    
    if (ticket.userId !== req.userId && ticket.userEmail !== user.email) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    // Удаляем тикет
    console.log('Удаление тикета:', { ticketId, userId: req.userId, email: user.email });
    
    const result = await callTool('deleteTicket', {
      ticketId: ticketId,
    }, 'crm-mcp-server', true);

    // Извлекаем результат из обертки
    const actualDeleteResult = result?.result !== undefined ? result.result : result;
    
    if (actualDeleteResult && actualDeleteResult.success) {
      res.json({ success: true, ticketId });
    } else {
      res.status(500).json({ error: 'Не удалось удалить тикет' });
    }
  } catch (error) {
    console.error('Ошибка при удалении тикета:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Analytics API ====================

// Загрузка и парсинг файла данных
app.post('/api/analytics/upload', authenticateToken, async (req, res) => {
  try {
    const { fileData, fileName } = req.body;

    if (!fileData || !fileName) {
      return res.status(400).json({ error: 'fileData и fileName обязательны' });
    }

    // Декодируем base64
    let fileBuffer;
    try {
      // Убираем префикс data:... если есть
      const base64Data = fileData.includes(',') 
        ? fileData.split(',')[1] 
        : fileData;
      fileBuffer = Buffer.from(base64Data, 'base64');
    } catch (error) {
      return res.status(400).json({ error: 'Неверный формат файла (ожидается base64)' });
    }

    // Сохраняем файл
    const filePath = await DataParser.saveUploadedFile(fileBuffer, fileName);

    // Парсим файл
    const parsedData = await DataParser.parseFile(filePath);

    // Возвращаем результат
    res.json({
      success: true,
      data: parsedData.data,
      summary: parsedData.summary,
      type: parsedData.type,
      fileName: parsedData.fileName,
      filePath: filePath, // Для последующего использования
    });
  } catch (error) {
    console.error('Ошибка при загрузке файла:', error);
    res.status(500).json({ error: error.message });
  }
});

// Анализ данных
app.post('/api/analytics/analyze', authenticateToken, async (req, res) => {
  try {
    const { data, summary, question, modelType, model, temperature, maxTokens } = req.body;

    if (!data || !summary || !question) {
      return res.status(400).json({ error: 'data, summary и question обязательны' });
    }

    const modelTypeValue = modelType || 'ollama';
    const options = {
      model,
      temperature,
      maxTokens: maxTokens || 4000,
    };

    // Анализируем данные
    const answer = await AnalyticsService.analyzeData(
      data,
      summary,
      question,
      modelTypeValue,
      options
    );

    res.json({
      success: true,
      answer,
    });
  } catch (error) {
    console.error('Ошибка при анализе данных:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получение быстрой статистики
app.post('/api/analytics/stats', authenticateToken, async (req, res) => {
  try {
    const { data, summary } = req.body;

    if (!data || !summary) {
      return res.status(400).json({ error: 'data и summary обязательны' });
    }

    const stats = AnalyticsService.getQuickStats(data, summary);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== End Analytics API ====================

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Инициализируем все MCP серверы
  initializeAllMCPServers();
  
  // Запускаем Telegram бота
  await startTelegramBot();
});


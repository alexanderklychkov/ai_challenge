import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import { handleYandexGPT } from './handlers/yandexGPT.js';
import { handleDeepSeek } from './handlers/deepSeek.js';
import { handleChatGPT } from './handlers/chatGPT.js';
import { handleHuggingFace } from './handlers/huggingFace.js';
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
} from './utils/learningStorage.js';
import { registerConnection } from './utils/statusEmitter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env из корня проекта
dotenv.config({ path: resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Эндпоинты для различных AI моделей
app.post('/api/yandex-gpt', handleYandexGPT);
app.post('/api/deepseek', handleDeepSeek);
app.post('/api/chatgpt', handleChatGPT);
app.post('/api/huggingface', handleHuggingFace);

// Эндпоинты для работы с чатами
app.get('/api/chats', async (req, res) => {
  try {
    const chats = await loadChats();
    res.json(chats);
  } catch (error) {
    console.error('Ошибка при загрузке чатов:', error);
    res.status(500).json({ error: 'Не удалось загрузить чаты' });
  }
});

app.post('/api/chats', async (req, res) => {
  try {
    const { title } = req.body;
    const chat = await createChat(title);
    res.json(chat);
  } catch (error) {
    console.error('Ошибка при создании чата:', error);
    res.status(500).json({ error: 'Не удалось создать чат' });
  }
});

app.patch('/api/chats/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { title } = req.body;
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

app.put('/api/chats/:chatId/settings', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { settings } = req.body;
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

app.delete('/api/chats/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
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
app.get('/api/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await loadChatMessages(chatId);
    res.json(messages);
  } catch (error) {
    console.error('Ошибка при загрузке сообщений:', error);
    res.status(500).json({ error: 'Не удалось загрузить сообщения' });
  }
});

app.post('/api/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { messages } = req.body;
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

app.delete('/api/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    await clearChatMessages(chatId);
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при очистке сообщений:', error);
    res.status(500).json({ error: 'Не удалось очистить сообщения' });
  }
});

// Старые эндпоинты для обратной совместимости (используют первый чат или создают его)
app.get('/api/messages', async (req, res) => {
  try {
    const chats = await loadChats();
    if (chats.length === 0) {
      const newChat = await createChat('Новый чат');
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

app.post('/api/messages', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages должен быть массивом' });
    }
    const chats = await loadChats();
    let chatId;
    if (chats.length === 0) {
      const newChat = await createChat('Новый чат');
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

app.delete('/api/messages', async (req, res) => {
  try {
    const chats = await loadChats();
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

// SSE эндпоинт для получения статусов выполнения инструментов
app.get('/api/status/:requestId', (req, res) => {
  const { requestId } = req.params;
  
  if (!requestId) {
    return res.status(400).json({ error: 'requestId обязателен' });
  }

  // Регистрируем соединение для отправки статусов
  registerConnection(requestId, res);
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Инициализируем все MCP серверы
  initializeAllMCPServers();
  
  // Запускаем Telegram бота
  await startTelegramBot();
});


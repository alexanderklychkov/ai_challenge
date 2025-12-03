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
import { DocumentIndexer } from './rag/indexer.js';
import { RAGService } from './rag/ragService.js';
import { SupportService } from './support/supportService.js';
import { register, login, getCurrentUser } from './auth/authController.js';
import { authenticateToken } from './auth/middleware.js';
import { findUserById } from './utils/userStorage.js';

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

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Инициализируем все MCP серверы
  initializeAllMCPServers();
  
  // Запускаем Telegram бота
  await startTelegramBot();
});


import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { handleDeepSeek } from '../handlers/deepSeek.js';
import { handleChatGPT } from '../handlers/chatGPT.js';
import { handleYandexGPT } from '../handlers/yandexGPT.js';
import { handleHuggingFace } from '../handlers/huggingFace.js';
import { handleLMStudio } from '../handlers/lmStudio.js';
import { loadUserMessages, saveUserMessages, clearUserMessages } from '../utils/telegramStorage.js';
import { getUserModel, setUserModel, getUserMCP } from '../utils/telegramUserSettings.js';
import { subscribeUser, unsubscribeUser, isUserSubscribed, getSubscribedUsers } from '../utils/telegramReminders.js';
import { callTool as orchestratorCallTool } from '../mcp/orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем .env
dotenv.config({ path: resolve(__dirname, '..', '..', '.env') });

// Конфигурация моделей по умолчанию
const DEFAULT_MODEL = process.env.TELEGRAM_DEFAULT_MODEL || 'deepseek';
const DEFAULT_ENABLE_MCP = process.env.TELEGRAM_ENABLE_MCP === 'true';

/**
 * Преобразует сообщения из формата Telegram в формат для обработчиков ИИ
 */
function convertTelegramMessagesToAIFormat(telegramMessages) {
  return telegramMessages.map(msg => ({
    role: msg.type === 'assistant' ? 'assistant' : 'user',
    text: msg.content,
    content: msg.content,
  }));
}

/**
 * Преобразует сообщения для Yandex GPT (использует другой формат)
 */
function convertTelegramMessagesToYandexFormat(telegramMessages) {
  return telegramMessages.map(msg => ({
    role: msg.type === 'assistant' ? 'assistant' : 'user',
    text: msg.content,
  }));
}

/**
 * Вызывает обработчик ИИ модели
 */
async function callAIHandler(handler, reqBody) {
  return new Promise((resolve, reject) => {
    // Создаем mock request и response объекты
    let responseData = null;
    let error = null;
    let resolved = false;
    
    const mockReq = {
      body: reqBody,
    };
    
    const mockRes = {
      json: (data) => {
        if (!resolved) {
          resolved = true;
          responseData = data;
          resolve(data);
        }
      },
      status: (code) => ({
        json: (data) => {
          if (!resolved) {
            resolved = true;
            error = { code, ...data };
            reject(new Error(error.error || `HTTP ${code}: Unknown error`));
          }
        },
      }),
    };
    
    // Вызываем обработчик
    const handlerResult = handler(mockReq, mockRes);
    
    // Если обработчик возвращает промис, обрабатываем его
    if (handlerResult && typeof handlerResult.then === 'function') {
      handlerResult.catch((err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
    }
    
    // Таймаут на случай, если обработчик не вызвал res.json()
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (responseData) {
          resolve(responseData);
        } else if (error) {
          reject(new Error(error.error || 'Unknown error'));
        } else {
          reject(new Error('Handler did not respond'));
        }
      }
    }, 30000); // 30 секунд таймаут
  });
}

/**
 * Получает ответ от ИИ модели
 */
async function getAIResponse(userId, userMessage, modelName = DEFAULT_MODEL, enableMCP = DEFAULT_ENABLE_MCP) {
  // Загружаем историю сообщений пользователя
  const userMessages = await loadUserMessages(userId);
  
  // Добавляем новое сообщение пользователя
  const newUserMessage = {
    id: `tg_${userId}_${Date.now()}`,
    type: 'user',
    content: userMessage,
    timestamp: new Date(),
  };
  
  // Выбираем обработчик в зависимости от модели
  let handler;
  let aiMessages;
  const requestBody = {
    system_prompt: process.env.TELEGRAM_SYSTEM_PROMPT || 'Ты полезный AI-ассистент. Отвечай на русском языке.',
    enableMCP,
  };
  
  switch (modelName.toLowerCase()) {
    case 'deepseek':
      handler = handleDeepSeek;
      aiMessages = convertTelegramMessagesToAIFormat([...userMessages, newUserMessage]);
      requestBody.messages = aiMessages;
      requestBody.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
      break;
    case 'chatgpt':
    case 'openai':
      handler = handleChatGPT;
      aiMessages = convertTelegramMessagesToAIFormat([...userMessages, newUserMessage]);
      requestBody.messages = aiMessages;
      requestBody.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
      break;
    case 'yandex':
    case 'yandexgpt':
      handler = handleYandexGPT;
      aiMessages = convertTelegramMessagesToYandexFormat([...userMessages, newUserMessage]);
      requestBody.messages = aiMessages;
      requestBody.model = process.env.YANDEX_MODEL || 'yandexgpt-lite';
      break;
    case 'huggingface':
      handler = handleHuggingFace;
      aiMessages = convertTelegramMessagesToAIFormat([...userMessages, newUserMessage]);
      requestBody.messages = aiMessages;
      requestBody.model = process.env.HUGGINGFACE_MODEL;
      break;
    case 'lmstudio':
      handler = handleLMStudio;
      aiMessages = convertTelegramMessagesToAIFormat([...userMessages, newUserMessage]);
      requestBody.messages = aiMessages;
      requestBody.model = process.env.LM_STUDIO_MODEL || 'mistralai/ministral-3-3b';
      break;
    default:
      handler = handleDeepSeek;
      aiMessages = convertTelegramMessagesToAIFormat([...userMessages, newUserMessage]);
      requestBody.messages = aiMessages;
      requestBody.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  }
  
  // Вызываем обработчик
  const response = await callAIHandler(handler, requestBody);
  
  // Сохраняем сообщения пользователя и ответ ИИ
  const assistantMessage = {
    id: `tg_${userId}_${Date.now()}_assistant`,
    type: 'assistant',
    content: response.text || response.content || 'Не удалось получить ответ',
    timestamp: new Date(),
    aiResponse: {
      content: response.text || response.content || '',
      tokens: response.tokens,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    },
    modelName: modelName,
  };
  
  const updatedMessages = [...userMessages, newUserMessage, assistantMessage];
  await saveUserMessages(userId, updatedMessages);
  
  return assistantMessage.content;
}

/**
 * Обрабатывает сводку задач через AI, добавляя summary и мотивационную цитату
 */
async function processReminderWithAI(tasksSummary) {
  try {
    // Используем модель для обработки напоминаний (можно настроить через переменную окружения)
    const modelName = process.env.TELEGRAM_REMINDER_AI_MODEL || DEFAULT_MODEL;
    const enableMCP = false; // Не используем MCP для обработки напоминаний
    
    // Формируем промпт для AI
    const aiPrompt = `Ты мотивационный помощник. Проанализируй следующую сводку задач и:

1. Создай краткое резюме (summary) - что нужно сделать, какие приоритеты
2. Добавь мотивационную цитату или фразу для вдохновения

Сводка задач:
${tasksSummary}

Ответь в следующем формате:
📋 РЕЗЮМЕ:
[твое резюме]

💪 МОТИВАЦИЯ:
[мотивационная цитата или фраза]

Отвечай на русском языке, будь позитивным и вдохновляющим.`;

    // Выбираем обработчик
    let handler;
    const requestBody = {
      messages: convertTelegramMessagesToAIFormat([
        { type: 'user', content: aiPrompt }
      ]),
      system_prompt: 'Ты мотивационный помощник. Помогай людям быть продуктивными и вдохновляй их.',
      enableMCP,
    };
    
    switch (modelName.toLowerCase()) {
      case 'deepseek':
        handler = handleDeepSeek;
        requestBody.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
        break;
      case 'chatgpt':
      case 'openai':
        handler = handleChatGPT;
        requestBody.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
        break;
      case 'yandex':
      case 'yandexgpt':
        handler = handleYandexGPT;
        requestBody.messages = convertTelegramMessagesToYandexFormat([
          { type: 'user', content: aiPrompt }
        ]);
        requestBody.model = process.env.YANDEX_MODEL || 'yandexgpt-lite';
        break;
      case 'huggingface':
        handler = handleHuggingFace;
        requestBody.model = process.env.HUGGINGFACE_MODEL;
        break;
      case 'lmstudio':
        handler = handleLMStudio;
        requestBody.model = process.env.LM_STUDIO_MODEL || 'mistralai/ministral-3-3b';
        break;
      default:
        handler = handleDeepSeek;
        requestBody.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    }
    
    // Вызываем обработчик
    const response = await callAIHandler(handler, requestBody);
    const aiProcessedText = response.text || response.content || '';
    
    // Формируем финальное сообщение: сводка + AI обработка
    return `${tasksSummary}\n\n━━━━━━━━━━━━━━━━━━━━\n\n${aiProcessedText}`;
  } catch (error) {
    console.error('Ошибка при обработке сводки через AI:', error);
    // Если AI обработка не удалась, возвращаем просто сводку
    return `${tasksSummary}\n\n💪 Помни: каждый шаг приближает тебя к цели!`;
  }
}

/**
 * Создает основную клавиатуру с кнопками команд
 */
function getMainKeyboard() {
  return {
    keyboard: [
      [
        { text: '📋 Модели ИИ' },
        { text: '🔔 Напоминания' }
      ],
      [
        { text: '❌ Очистить историю' },
        { text: 'ℹ️ Помощь' }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

/**
 * Создает клавиатуру для выбора модели ИИ
 */
function getModelKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🤖 DeepSeek', callback_data: 'model_deepseek' },
        { text: '💬 ChatGPT', callback_data: 'model_chatgpt' }
      ],
      [
        { text: '🔵 Yandex GPT', callback_data: 'model_yandex' },
        { text: '🤗 HuggingFace', callback_data: 'model_huggingface' }
      ],
      [
        { text: '◀️ Назад', callback_data: 'back_to_main' }
      ]
    ]
  };
}

/**
 * Создает клавиатуру для управления напоминаниями
 */
function getReminderKeyboard(isSubscribed) {
  return {
    inline_keyboard: [
      [
        { 
          text: isSubscribed ? '❌ Отписаться от напоминаний' : '✅ Подписаться на напоминания',
          callback_data: isSubscribed ? 'unremind' : 'remind'
        }
      ],
      [
        { text: '◀️ Назад', callback_data: 'back_to_main' }
      ]
    ]
  };
}

/**
 * Инициализирует и запускает Telegram бота
 */
export async function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN не установлен. Telegram бот не будет запущен.');
    return null;
  }
  
  const bot = new TelegramBot(token, { polling: true });
  
  // Команда /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `Привет! Я AI-ассистент. Задавайте вопросы, и я постараюсь помочь.\n\n` +
      `Используйте кнопки ниже для быстрого доступа к командам или отправьте сообщение для общения с ИИ.`;
    
    await bot.sendMessage(chatId, welcomeMessage, {
      reply_markup: getMainKeyboard()
    });
  });
  
  // Команда /help
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const helpMessage = `Доступные команды:\n\n` +
      `/start - начать работу с ботом\n` +
      `/model [название] - выбрать модель ИИ (deepseek, chatgpt, yandex, huggingface)\n` +
      `/remind - подписаться на напоминания о задачах (каждые 30 секунд)\n` +
      `/unremind - отписаться от напоминаний\n` +
      `/clear - очистить историю сообщений\n` +
      `/help - показать эту справку\n\n` +
      `Используйте кнопки для быстрого доступа к командам или просто отправьте сообщение для общения с ИИ.`;
    
    await bot.sendMessage(chatId, helpMessage, {
      reply_markup: getMainKeyboard()
    });
  });
  
  // Обработка текстовых кнопок
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Обработка кнопки "📋 Модели ИИ"
    if (text === '📋 Модели ИИ') {
      const currentModel = await getUserModel(chatId, DEFAULT_MODEL);
      await bot.sendMessage(
        chatId,
        `Текущая модель: ${currentModel}\n\nВыберите модель ИИ:`,
        { reply_markup: getModelKeyboard() }
      );
      return;
    }
    
    // Обработка кнопки "🔔 Напоминания"
    if (text === '🔔 Напоминания') {
      const isSubscribed = await isUserSubscribed(chatId);
      const statusText = isSubscribed 
        ? 'Вы подписаны на напоминания о задачах.\nБот отправляет сводку каждые 30 секунд.'
        : 'Вы не подписаны на напоминания.\nПодпишитесь, чтобы получать сводку о задачах каждые 30 секунд.';
      
      await bot.sendMessage(
        chatId,
        `🔔 Управление напоминаниями\n\n${statusText}`,
        { reply_markup: getReminderKeyboard(isSubscribed) }
      );
      return;
    }
    
    // Обработка кнопки "❌ Очистить историю"
    if (text === '❌ Очистить историю') {
      try {
        await clearUserMessages(chatId);
        await bot.sendMessage(chatId, '✅ История сообщений очищена.', {
          reply_markup: getMainKeyboard()
        });
      } catch (error) {
        console.error('Ошибка при очистке сообщений:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка при очистке истории.');
      }
      return;
    }
    
    // Обработка кнопки "ℹ️ Помощь"
    if (text === 'ℹ️ Помощь') {
      const helpMessage = `Доступные команды:\n\n` +
        `/start - начать работу с ботом\n` +
        `/model [название] - выбрать модель ИИ\n` +
        `/remind - подписаться на напоминания о задачах\n` +
        `/unremind - отписаться от напоминаний\n` +
        `/clear - очистить историю сообщений\n` +
        `/help - показать эту справку\n\n` +
        `Используйте кнопки для быстрого доступа или просто отправьте сообщение для общения с ИИ.`;
      
      await bot.sendMessage(chatId, helpMessage, {
        reply_markup: getMainKeyboard()
      });
      return;
    }
    
    // Пропускаем команды (они обрабатываются отдельными обработчиками)
    if (text && text.startsWith('/')) {
      return;
    }
    
    // Обработка обычных сообщений (не команд и не кнопок)
    const userMessage = text || msg.caption || '';
    
    if (!userMessage.trim()) {
      await bot.sendMessage(chatId, 'Пожалуйста, отправьте текстовое сообщение.');
      return;
    }
    
    // Показываем индикатор печати
    await bot.sendChatAction(chatId, 'typing');
    
    try {
      // Получаем модель для пользователя
      const userModel = await getUserModel(chatId, DEFAULT_MODEL);
      const enableMCP = await getUserMCP(chatId, DEFAULT_ENABLE_MCP);
      
      // Получаем ответ от ИИ
      const response = await getAIResponse(chatId, userMessage, userModel, enableMCP);
      
      // Отправляем ответ пользователю
      // Разбиваем длинные сообщения на части (Telegram ограничение ~4096 символов)
      if (response.length > 4000) {
        const chunks = response.match(/[\s\S]{1,4000}/g) || [];
        for (const chunk of chunks) {
          await bot.sendMessage(chatId, chunk);
        }
      } else {
        await bot.sendMessage(chatId, response);
      }
    } catch (error) {
      console.error('Ошибка при обработке сообщения:', error);
      await bot.sendMessage(
        chatId,
        `Произошла ошибка: ${error.message || 'Неизвестная ошибка'}`
      );
    }
  });
  
  // Обработка callback-запросов (inline кнопки)
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    // Отвечаем на callback, чтобы убрать индикатор загрузки
    await bot.answerCallbackQuery(query.id);
    
    // Обработка выбора модели
    if (data.startsWith('model_')) {
      const modelName = data.replace('model_', '');
      const modelMap = {
        'deepseek': 'deepseek',
        'chatgpt': 'chatgpt',
        'yandex': 'yandex',
        'huggingface': 'huggingface'
      };
      
      const selectedModel = modelMap[modelName];
      if (selectedModel) {
        await setUserModel(chatId, selectedModel);
        await bot.editMessageText(
          `✅ Модель изменена на: ${modelName}`,
          {
            chat_id: chatId,
            message_id: query.message.message_id
          }
        );
        
        // Показываем главное меню через секунду
        setTimeout(async () => {
          await bot.sendMessage(chatId, 'Выберите действие:', {
            reply_markup: getMainKeyboard()
          });
        }, 1000);
      }
      return;
    }
    
    // Обработка подписки/отписки от напоминаний
    if (data === 'remind') {
      try {
        await subscribeUser(chatId);
        await bot.editMessageText(
          '✅ Вы подписаны на напоминания о задачах!\n\nБот будет отправлять вам сводку о задачах каждые 30 секунд.',
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: getReminderKeyboard(true)
          }
        );
      } catch (error) {
        console.error('Ошибка при подписке на напоминания:', error);
        await bot.answerCallbackQuery(query.id, { text: 'Ошибка при подписке', show_alert: true });
      }
      return;
    }
    
    if (data === 'unremind') {
      try {
        await unsubscribeUser(chatId);
        await bot.editMessageText(
          '❌ Вы отписаны от напоминаний о задачах.',
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: getReminderKeyboard(false)
          }
        );
      } catch (error) {
        console.error('Ошибка при отписке от напоминаний:', error);
        await bot.answerCallbackQuery(query.id, { text: 'Ошибка при отписке', show_alert: true });
      }
      return;
    }
    
    // Обработка возврата в главное меню
    if (data === 'back_to_main') {
      await bot.editMessageText(
        'Выберите действие:',
        {
          chat_id: chatId,
          message_id: query.message.message_id
        }
      );
      
      await bot.sendMessage(chatId, 'Главное меню:', {
        reply_markup: getMainKeyboard()
      });
      return;
    }
  });
  
  // Команда /model
  bot.onText(/\/model(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const modelName = match[1]?.trim();
    
    if (!modelName) {
      const currentModel = await getUserModel(chatId, DEFAULT_MODEL);
      await bot.sendMessage(
        chatId,
        `Текущая модель: ${currentModel}\n\nВыберите модель ИИ:`,
        { reply_markup: getModelKeyboard() }
      );
      return;
    }
    
    const validModels = ['deepseek', 'chatgpt', 'openai', 'yandex', 'yandexgpt', 'huggingface'];
    if (!validModels.includes(modelName.toLowerCase())) {
      await bot.sendMessage(
        chatId,
        `Неизвестная модель: ${modelName}\n\n` +
        `Доступные модели: ${validModels.join(', ')}`
      );
      return;
    }
    
    // Сохраняем выбор модели для пользователя
    await setUserModel(chatId, modelName.toLowerCase());
    
    await bot.sendMessage(chatId, `Модель изменена на: ${modelName}`, {
      reply_markup: getMainKeyboard()
    });
  });
  
  // Команда /remind - подписаться на напоминания о задачах
  bot.onText(/\/remind/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      await subscribeUser(chatId);
      await bot.sendMessage(
        chatId,
        '✅ Вы подписаны на напоминания о задачах!\n\n' +
        'Бот будет отправлять вам сводку о задачах каждые 30 секунд.\n' +
        'Используйте /unremind чтобы отписаться.',
        { reply_markup: getMainKeyboard() }
      );
    } catch (error) {
      console.error('Ошибка при подписке на напоминания:', error);
      await bot.sendMessage(chatId, 'Произошла ошибка при подписке на напоминания.');
    }
  });
  
  // Команда /unremind - отписаться от напоминаний
  bot.onText(/\/unremind/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      await unsubscribeUser(chatId);
      await bot.sendMessage(chatId, '❌ Вы отписаны от напоминаний о задачах.', {
        reply_markup: getMainKeyboard()
      });
    } catch (error) {
      console.error('Ошибка при отписке от напоминаний:', error);
      await bot.sendMessage(chatId, 'Произошла ошибка при отписке от напоминаний.');
    }
  });
  
  // Команда /clear
  bot.onText(/\/clear/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      await clearUserMessages(chatId);
      await bot.sendMessage(chatId, '✅ История сообщений очищена.', {
        reply_markup: getMainKeyboard()
      });
    } catch (error) {
      console.error('Ошибка при очистке сообщений:', error);
      await bot.sendMessage(chatId, 'Произошла ошибка при очистке истории.');
    }
  });
  
  
  /**
   * Отправляет напоминания о задачах подписанным пользователям
   */
  async function sendReminders() {
    try {
      const subscribedUsers = await getSubscribedUsers();
      
      if (subscribedUsers.length === 0) {
        return; // Нет подписанных пользователей
      }
      
      // Получаем сводку задач через MCP инструмент reminder
      let tasksSummary;
      try {
        const reminderResult = await orchestratorCallTool('reminder', {
          filter: '',
          limit: 20,
        });
        
        // orchestratorCallTool уже извлекает текст из content массива,
        // поэтому результат должен быть строкой
        if (typeof reminderResult === 'string') {
          tasksSummary = reminderResult;
        } else {
          tasksSummary = JSON.stringify(reminderResult, null, 2);
        }
      } catch (error) {
        console.error('Ошибка при получении сводки задач:', error);
        tasksSummary = `⚠️ Не удалось получить сводку задач: ${error.message}`;
      }
      
      // Обрабатываем сводку через AI для добавления summary и мотивации
      let finalReminderText;
      try {
        finalReminderText = await processReminderWithAI(tasksSummary);
      } catch (error) {
        console.error('Ошибка при обработке сводки через AI:', error);
        // Если AI обработка не удалась, используем просто сводку
        finalReminderText = `${tasksSummary}\n\n💪 Помни: каждый шаг приближает тебя к цели!`;
      }
      
      // Отправляем напоминания всем подписанным пользователям
      for (const userId of subscribedUsers) {
        try {
          // Разбиваем длинные сообщения на части
          if (finalReminderText.length > 4000) {
            const chunks = finalReminderText.match(/[\s\S]{1,4000}/g) || [];
            for (const chunk of chunks) {
              await bot.sendMessage(userId, chunk);
            }
          } else {
            await bot.sendMessage(userId, finalReminderText);
          }
        } catch (error) {
          console.error(`Ошибка при отправке напоминания пользователю ${userId}:`, error);
          // Если пользователь заблокировал бота или произошла другая ошибка,
          // отписываем его от напоминаний
          if (error.response?.statusCode === 403 || error.response?.statusCode === 400) {
            await unsubscribeUser(userId);
            console.log(`Пользователь ${userId} отписан от напоминаний из-за ошибки`);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при отправке напоминаний:', error);
    }
  }
  
  // Запускаем периодическую проверку задач каждые 30 секунд
  const REMINDER_INTERVAL = parseInt(process.env.TELEGRAM_REMINDER_INTERVAL || '30', 10) * 1000; // 30 секунд по умолчанию
  
  console.log(`Запуск периодических напоминаний (интервал: ${REMINDER_INTERVAL / 1000} секунд)`);
  
  // Первая проверка через 5 секунд после запуска
  setTimeout(() => {
    sendReminders();
  }, 5000);
  
  // Затем каждые REMINDER_INTERVAL миллисекунд
  const reminderIntervalId = setInterval(() => {
    sendReminders();
  }, REMINDER_INTERVAL);
  
  // Сохраняем ID интервала для возможной остановки в будущем
  bot.reminderIntervalId = reminderIntervalId;
  
  console.log('Telegram бот запущен и готов к работе');
  return bot;
}


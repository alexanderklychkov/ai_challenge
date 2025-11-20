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

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  
  // Запускаем Telegram бота
  await startTelegramBot();
});


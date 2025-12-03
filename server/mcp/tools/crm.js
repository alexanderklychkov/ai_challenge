/**
 * Регистрирует инструменты для работы с CRM (тикеты и пользователи)
 * @param {McpServer} server - Экземпляр MCP сервера
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../../data/crm');
const USERS_FILE = join(DATA_DIR, 'users.json');
const TICKETS_FILE = join(DATA_DIR, 'tickets.json');

/**
 * Инициализирует директорию для данных, если её нет
 */
async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Загружает пользователей из файла
 */
async function loadUsers() {
  try {
    await ensureDataDir();
    if (!existsSync(USERS_FILE)) {
      // Создаем пустой файл, если его нет
      await writeFile(USERS_FILE, '[]', 'utf-8');
      return [];
    }
    const data = await readFile(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Ошибка при загрузке пользователей:', error);
    return [];
  }
}

/**
 * Сохраняет пользователей в файл
 */
async function saveUsers(users) {
  try {
    await writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Ошибка при сохранении пользователей:', error);
    throw error;
  }
}

/**
 * Загружает тикеты из файла
 */
async function loadTickets() {
  try {
    await ensureDataDir();
    
    if (!existsSync(TICKETS_FILE)) {
      return [];
    }
    
    const data = await readFile(TICKETS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Ошибка при загрузке тикетов:', error);
    return [];
  }
}

/**
 * Сохраняет тикеты в файл
 */
async function saveTickets(tickets) {
  try {
    await ensureDataDir();
    await writeFile(TICKETS_FILE, JSON.stringify(tickets, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Ошибка при сохранении тикетов:', error);
    throw error;
  }
}

/**
 * Регистрирует все инструменты для CRM
 */
export function registerCRMTools(server) {
  /**
   * Создает нового пользователя
   */
  server.registerTool('createUser', {
    description: 'Создает нового пользователя в системе. Используется при первом обращении пользователя в поддержку.',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email пользователя',
        },
        name: {
          type: 'string',
          description: 'Имя пользователя',
        },
        role: {
          type: 'string',
          enum: ['free', 'premium'],
          description: 'Роль пользователя',
          default: 'free',
        },
      },
      required: ['email', 'name'],
    },
  }, async (args) => {
    try {
      const { email, name, role = 'free' } = args;
      
      if (!email || !name) {
        throw new Error('email и name обязательны');
      }

      const users = await loadUsers();
      
      // Проверяем, существует ли пользователь с таким email
      const existingUser = users.find(u => u.email === email);
      if (existingUser) {
        return {
          success: true,
          user: existingUser,
          created: false,
        };
      }

      // Создаем нового пользователя
      const userId = `user-${Date.now()}`;
      const now = new Date().toISOString();

      const newUser = {
        id: userId,
        email,
        name,
        role,
        createdAt: now,
        lastLogin: now,
        status: 'active',
        metadata: {},
      };

      users.push(newUser);
      await saveUsers(users);

      return {
        success: true,
        user: newUser,
        created: true,
      };
    } catch (error) {
      console.error('Ошибка при создании пользователя:', error);
      throw error;
    }
  });

  /**
   * Получает информацию о пользователе по email или ID
   */
  server.registerTool('getUser', {
    description: 'Получает информацию о пользователе по email или ID. Полезно для понимания контекста тикета поддержки.',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email пользователя',
        },
        userId: {
          type: 'string',
          description: 'ID пользователя',
        },
      },
    },
  }, async (args) => {
    try {
      const { email, userId } = args;
      
      if (!email && !userId) {
        throw new Error('Необходимо указать email или userId');
      }

      const users = await loadUsers();
      const user = users.find(u => 
        (email && u.email === email) || 
        (userId && u.id === userId)
      );

      if (!user) {
        return {
          found: false,
          message: 'Пользователь не найден',
        };
      }

      return {
        found: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          metadata: user.metadata,
        },
      };
    } catch (error) {
      console.error('Ошибка при получении пользователя:', error);
      throw error;
    }
  });

  /**
   * Получает тикеты пользователя
   */
  server.registerTool('getUserTickets', {
    description: 'Получает все тикеты пользователя по email или userId. Полезно для понимания истории обращений и текущих проблем пользователя.',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Email пользователя',
        },
        userId: {
          type: 'string',
          description: 'ID пользователя',
        },
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'resolved', 'closed'],
          description: 'Фильтр по статусу тикета (опционально)',
        },
      },
    },
  }, async (args) => {
    try {
      const { email, userId, status } = args;
      
      if (!email && !userId) {
        throw new Error('Необходимо указать email или userId');
      }

      const tickets = await loadTickets();
      console.log('Все тикеты:', tickets.length);
      console.log('Тикеты в файле:', tickets.map(t => ({ id: t.id, userId: t.userId, userEmail: t.userEmail })));
      console.log('Поиск тикетов для:', { email, userId });
      
      let userTickets = tickets.filter(t => {
        const matchesEmail = email && t.userEmail === email;
        const matchesUserId = userId && t.userId === userId;
        const match = matchesEmail || matchesUserId;
        
        console.log(`Тикет ${t.id}:`, {
          ticketUserId: t.userId,
          ticketEmail: t.userEmail,
          searchUserId: userId,
          searchEmail: email,
          matchesEmail,
          matchesUserId,
          match
        });
        
        return match;
      });

      console.log('Найдено тикетов:', userTickets.length);

      if (status) {
        userTickets = userTickets.filter(t => t.status === status);
      }

      // Сортируем по дате создания (новые первыми)
      userTickets.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      return {
        count: userTickets.length,
        tickets: userTickets.map(t => ({
          id: t.id,
          subject: t.subject,
          description: t.description,
          status: t.status,
          priority: t.priority,
          category: t.category,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          tags: t.tags,
          messagesCount: t.messages?.length || 0,
        })),
      };
    } catch (error) {
      console.error('Ошибка при получении тикетов пользователя:', error);
      throw error;
    }
  });

  /**
   * Получает тикет по ID
   */
  server.registerTool('getTicket', {
    description: 'Получает полную информацию о тикете по его ID, включая все сообщения. Полезно для понимания контекста проблемы пользователя.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'ID тикета',
        },
      },
      required: ['ticketId'],
    },
  }, async (args) => {
    try {
      const { ticketId } = args;
      
      if (!ticketId) {
        throw new Error('ticketId обязателен');
      }

      const tickets = await loadTickets();
      const ticket = tickets.find(t => t.id === ticketId);

      if (!ticket) {
        return {
          found: false,
          message: 'Тикет не найден',
        };
      }

      return {
        found: true,
        ticket: {
          id: ticket.id,
          userId: ticket.userId,
          userEmail: ticket.userEmail,
          subject: ticket.subject,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          category: ticket.category,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          tags: ticket.tags,
          messages: ticket.messages || [],
        },
      };
    } catch (error) {
      console.error('Ошибка при получении тикета:', error);
      throw error;
    }
  });

  /**
   * Ищет тикеты по ключевым словам или категории
   */
  server.registerTool('searchTickets', {
    description: 'Ищет тикеты по ключевым словам в описании, категории или тегам. Полезно для поиска похожих проблем и их решений.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Поисковый запрос (ключевые слова)',
        },
        category: {
          type: 'string',
          description: 'Категория тикета (authentication, billing, technical и т.д.)',
        },
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'resolved', 'closed'],
          description: 'Статус тикета',
        },
        limit: {
          type: 'number',
          description: 'Максимальное количество результатов',
          default: 10,
        },
      },
    },
  }, async (args) => {
    try {
      const { query, category, status, limit = 10 } = args;
      
      const tickets = await loadTickets();
      let results = tickets;

      // Фильтр по категории
      if (category) {
        results = results.filter(t => 
          t.category?.toLowerCase() === category.toLowerCase()
        );
      }

      // Фильтр по статусу
      if (status) {
        results = results.filter(t => t.status === status);
      }

      // Поиск по запросу
      if (query) {
        const queryLower = query.toLowerCase();
        results = results.filter(t => {
          const searchText = [
            t.subject,
            t.description,
            ...(t.tags || []),
          ].join(' ').toLowerCase();
          return searchText.includes(queryLower);
        });
      }

      // Сортируем по дате создания (новые первыми)
      results.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      // Ограничиваем количество результатов
      results = results.slice(0, limit);

      return {
        count: results.length,
        tickets: results.map(t => ({
          id: t.id,
          userEmail: t.userEmail,
          subject: t.subject,
          description: t.description,
          status: t.status,
          priority: t.priority,
          category: t.category,
          createdAt: t.createdAt,
          tags: t.tags,
        })),
      };
    } catch (error) {
      console.error('Ошибка при поиске тикетов:', error);
      throw error;
    }
  });

  /**
   * Создает новый тикет
   */
  server.registerTool('createTicket', {
    description: 'Создает новый тикет поддержки. Используется для регистрации новых обращений пользователей.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'ID пользователя',
        },
        userEmail: {
          type: 'string',
          description: 'Email пользователя',
        },
        subject: {
          type: 'string',
          description: 'Тема тикета',
        },
        description: {
          type: 'string',
          description: 'Описание проблемы',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Приоритет тикета',
          default: 'medium',
        },
        category: {
          type: 'string',
          description: 'Категория тикета (authentication, billing, technical и т.д.)',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Теги для тикета',
        },
      },
      required: ['userEmail', 'subject', 'description'],
    },
  }, async (args) => {
    try {
      const { 
        userId, 
        userEmail, 
        subject, 
        description, 
        priority = 'medium',
        category,
        tags = [],
      } = args;

      if (!userEmail || !subject || !description) {
        throw new Error('userEmail, subject и description обязательны');
      }

      const tickets = await loadTickets();
      
      // Генерируем ID для нового тикета
      const ticketId = `ticket-${Date.now()}`;
      const now = new Date().toISOString();

      const newTicket = {
        id: ticketId,
        userId: userId || null,
        userEmail,
        subject,
        description,
        status: 'open',
        priority,
        category: category || 'general',
        createdAt: now,
        updatedAt: now,
        messages: [
          {
            id: `msg-${Date.now()}`,
            author: 'user',
            text: description,
            timestamp: now,
          },
        ],
        tags,
      };

      console.log('Создание нового тикета:', {
        id: newTicket.id,
        userId: newTicket.userId,
        userEmail: newTicket.userEmail,
        subject: newTicket.subject,
      });

      tickets.push(newTicket);
      await saveTickets(tickets);
      
      console.log('Тикет сохранен. Всего тикетов:', tickets.length);

      return {
        success: true,
        ticket: {
          id: newTicket.id,
          subject: newTicket.subject,
          status: newTicket.status,
          createdAt: newTicket.createdAt,
        },
      };
    } catch (error) {
      console.error('Ошибка при создании тикета:', error);
      throw error;
    }
  });

  /**
   * Добавляет сообщение в тикет
   */
  server.registerTool('addTicketMessage', {
    description: 'Добавляет сообщение в существующий тикет. Используется для обновления тикета новыми сообщениями от пользователя или поддержки.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'ID тикета',
        },
        author: {
          type: 'string',
          enum: ['user', 'support', 'assistant'],
          description: 'Автор сообщения (user - пользователь, support - поддержка, assistant - AI ассистент)',
        },
        text: {
          type: 'string',
          description: 'Текст сообщения',
        },
      },
      required: ['ticketId', 'author', 'text'],
    },
  }, async (args) => {
    try {
      const { ticketId, author, text } = args;

      if (!ticketId || !author || !text) {
        throw new Error('ticketId, author и text обязательны');
      }

      const tickets = await loadTickets();
      const ticket = tickets.find(t => t.id === ticketId);

      if (!ticket) {
        throw new Error('Тикет не найден');
      }

      const message = {
        id: `msg-${Date.now()}`,
        author,
        text,
        timestamp: new Date().toISOString(),
      };

      ticket.messages = ticket.messages || [];
      ticket.messages.push(message);
      ticket.updatedAt = new Date().toISOString();

      await saveTickets(tickets);

      return {
        success: true,
        message: {
          id: message.id,
          author: message.author,
          timestamp: message.timestamp,
        },
      };
    } catch (error) {
      console.error('Ошибка при добавлении сообщения:', error);
      throw error;
    }
  });

  /**
   * Обновляет статус тикета
   */
  server.registerTool('updateTicketStatus', {
    description: 'Обновляет статус тикета (open, in_progress, resolved, closed). Используется для отслеживания прогресса решения проблемы.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'ID тикета',
        },
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'resolved', 'closed'],
          description: 'Новый статус тикета',
        },
      },
      required: ['ticketId', 'status'],
    },
  }, async (args) => {
    try {
      const { ticketId, status } = args;

      if (!ticketId || !status) {
        throw new Error('ticketId и status обязательны');
      }

      const tickets = await loadTickets();
      const ticket = tickets.find(t => t.id === ticketId);

      if (!ticket) {
        throw new Error('Тикет не найден');
      }

      ticket.status = status;
      ticket.updatedAt = new Date().toISOString();

      await saveTickets(tickets);

      return {
        success: true,
        ticket: {
          id: ticket.id,
          status: ticket.status,
          updatedAt: ticket.updatedAt,
        },
      };
    } catch (error) {
      console.error('Ошибка при обновлении статуса тикета:', error);
      throw error;
    }
  });

  /**
   * Удаляет тикет
   */
  server.registerTool('deleteTicket', {
    description: 'Удаляет тикет по его ID. Используется для удаления ненужных или ошибочно созданных тикетов.',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: {
          type: 'string',
          description: 'ID тикета для удаления',
        },
      },
      required: ['ticketId'],
    },
  }, async (args) => {
    try {
      const { ticketId } = args;

      if (!ticketId) {
        throw new Error('ticketId обязателен');
      }

      const tickets = await loadTickets();
      const ticketIndex = tickets.findIndex(t => t.id === ticketId);

      if (ticketIndex === -1) {
        throw new Error('Тикет не найден');
      }

      const deletedTicket = tickets[ticketIndex];
      tickets.splice(ticketIndex, 1);

      await saveTickets(tickets);

      console.log('Тикет удален:', ticketId);

      return {
        success: true,
        ticketId: deletedTicket.id,
      };
    } catch (error) {
      console.error('Ошибка при удалении тикета:', error);
      throw error;
    }
  });
}


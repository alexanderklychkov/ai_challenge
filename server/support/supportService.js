/**
 * Сервис поддержки пользователей
 * Интегрирует RAG для поиска в документации/FAQ и MCP для работы с CRM (тикеты и пользователи)
 */

import { RAGService } from '../rag/ragService.js';
import { DocumentIndexer } from '../rag/indexer.js';
import { callCRMMCPTool } from '../mcp/servers/crmMCP.js';

/**
 * Сервис поддержки пользователей
 */
export class SupportService {
  /**
   * @param {RAGService} ragService - RAG сервис для поиска в документации
   */
  constructor(ragService) {
    this.ragService = ragService;
  }

  /**
   * Извлекает email пользователя из вопроса или контекста
   * @param {string} question - Вопрос пользователя
   * @param {object} context - Дополнительный контекст (может содержать userEmail)
   * @returns {string|null} Email пользователя или null
   */
  extractUserEmail(question, context = {}) {
    // Если email указан в контексте
    if (context.userEmail) {
      return context.userEmail;
    }

    // Пытаемся найти email в тексте вопроса
    const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
    const matches = question.match(emailRegex);
    if (matches && matches.length > 0) {
      return matches[0];
    }

    return null;
  }

  /**
   * Извлекает информацию о тикете из вопроса
   * @param {string} question - Вопрос пользователя
   * @returns {object} Информация о тикете (ticketId, если найден)
   */
  extractTicketInfo(question) {
    // Пытаемся найти упоминание тикета
    const ticketIdRegex = /ticket[-\s]?(\d+|[a-z0-9-]+)/i;
    const match = question.match(ticketIdRegex);
    if (match) {
      return { ticketId: match[1] };
    }

    return {};
  }

  /**
   * Получает контекст пользователя из CRM
   * @param {string} userEmail - Email пользователя
   * @returns {Promise<object>} Контекст пользователя
   */
  async getUserContext(userEmail) {
    try {
      // Получаем информацию о пользователе
      const userInfo = await callCRMMCPTool('getUser', { email: userEmail });
      
      if (!userInfo.found) {
        return {
          userFound: false,
          user: null,
          tickets: [],
        };
      }

      // Получаем открытые тикеты пользователя
      const userTickets = await callCRMMCPTool('getUserTickets', { 
        email: userEmail,
        status: 'open',
      });

      return {
        userFound: true,
        user: userInfo.user,
        tickets: userTickets.tickets || [],
      };
    } catch (error) {
      console.error('Ошибка при получении контекста пользователя:', error);
      return {
        userFound: false,
        user: null,
        tickets: [],
        error: error.message,
      };
    }
  }

  /**
   * Получает контекст тикета
   * @param {string} ticketId - ID тикета
   * @returns {Promise<object>} Контекст тикета
   */
  async getTicketContext(ticketId) {
    try {
      const ticketInfo = await callCRMMCPTool('getTicket', { ticketId });
      
      if (!ticketInfo.found) {
        return {
          ticketFound: false,
          ticket: null,
        };
      }

      return {
        ticketFound: true,
        ticket: ticketInfo.ticket,
      };
    } catch (error) {
      console.error('Ошибка при получении контекста тикета:', error);
      return {
        ticketFound: false,
        ticket: null,
        error: error.message,
      };
    }
  }

  /**
   * Ищет похожие тикеты для контекста
   * @param {string} query - Поисковый запрос
   * @param {string} category - Категория (опционально)
   * @returns {Promise<Array>} Массив похожих тикетов
   */
  async searchSimilarTickets(query, category = null) {
    try {
      const searchResult = await callCRMMCPTool('searchTickets', {
        query,
        category,
        status: 'resolved', // Ищем только решенные тикеты для примеров решений
        limit: 5,
      });

      return searchResult.tickets || [];
    } catch (error) {
      console.error('Ошибка при поиске похожих тикетов:', error);
      return [];
    }
  }

  /**
   * Формирует промпт с контекстом для поддержки
   * @param {string} question - Вопрос пользователя
   * @param {object} userContext - Контекст пользователя
   * @param {object} ticketContext - Контекст тикета (если есть)
   * @param {Array} similarTickets - Похожие тикеты
   * @param {Array} ragChunks - Чанки из RAG
   * @returns {string} Промпт с контекстом
   */
  buildSupportPrompt(question, userContext, ticketContext, similarTickets, ragChunks) {
    let prompt = `Ты - AI ассистент поддержки пользователей продукта AI Mentor. Твоя задача - помочь пользователю решить его проблему, используя документацию продукта и информацию о его тикетах.\n\n`;

    // Добавляем информацию о пользователе
    if (userContext.userFound && userContext.user) {
      prompt += `Информация о пользователе:\n`;
      prompt += `- Имя: ${userContext.user.name}\n`;
      prompt += `- Email: ${userContext.user.email}\n`;
      prompt += `- Тариф: ${userContext.user.role}\n`;
      prompt += `- Статус: ${userContext.user.status}\n\n`;

      // Добавляем информацию об открытых тикетах
      if (userContext.tickets && userContext.tickets.length > 0) {
        prompt += `Открытые тикеты пользователя:\n`;
        userContext.tickets.forEach((ticket, index) => {
          prompt += `${index + 1}. [${ticket.id}] ${ticket.subject} (${ticket.status}, ${ticket.priority})\n`;
          prompt += `   Описание: ${ticket.description.substring(0, 200)}...\n`;
        });
        prompt += `\n`;
      }
    }

    // Добавляем информацию о текущем тикете
    if (ticketContext.ticketFound && ticketContext.ticket) {
      prompt += `Контекст текущего тикета:\n`;
      prompt += `- ID: ${ticketContext.ticket.id}\n`;
      prompt += `- Тема: ${ticketContext.ticket.subject}\n`;
      prompt += `- Статус: ${ticketContext.ticket.status}\n`;
      prompt += `- Приоритет: ${ticketContext.ticket.priority}\n`;
      prompt += `- Описание: ${ticketContext.ticket.description}\n`;
      
      if (ticketContext.ticket.messages && ticketContext.ticket.messages.length > 0) {
        prompt += `- История сообщений:\n`;
        ticketContext.ticket.messages.forEach((msg, index) => {
          prompt += `  ${index + 1}. [${msg.author}]: ${msg.text.substring(0, 150)}...\n`;
        });
      }
      prompt += `\n`;
    }

    // Добавляем похожие решенные тикеты
    if (similarTickets && similarTickets.length > 0) {
      prompt += `Похожие решенные проблемы:\n`;
      similarTickets.forEach((ticket, index) => {
        prompt += `${index + 1}. [${ticket.id}] ${ticket.subject}\n`;
        prompt += `   Описание: ${ticket.description.substring(0, 200)}...\n`;
      });
      prompt += `\n`;
    }

    // Добавляем информацию из документации (RAG)
    if (ragChunks && ragChunks.length > 0) {
      prompt += `Релевантная информация из документации:\n`;
      ragChunks.forEach((chunk, index) => {
        prompt += `[Источник ${index + 1}: ${chunk.source}]\n${chunk.text}\n\n`;
      });
    }

    prompt += `Вопрос пользователя: ${question}\n\n`;
    prompt += `Ответ: Дай подробный и полезный ответ, учитывая всю предоставленную информацию. Если проблема связана с тикетом пользователя, используй контекст тикета. Если есть похожие решенные проблемы, упомяни их. Используй информацию из документации для точных ответов.`;

    return prompt;
  }

  /**
   * Обрабатывает вопрос поддержки
   * @param {string} question - Вопрос пользователя
   * @param {Function} llmCaller - Функция для вызова LLM
   * @param {object} options - Опции
   * @param {string} options.userEmail - Email пользователя (опционально)
   * @param {string} options.ticketId - ID тикета (опционально)
   * @param {Array} options.messages - История сообщений
   * @param {number} options.topK - Количество чанков для RAG
   * @param {number} options.minScore - Минимальный score для RAG
   * @returns {Promise<object>} Результат обработки вопроса
   */
  async processSupportQuestion(question, llmCaller, options = {}) {
    const {
      userEmail: providedEmail,
      ticketId: providedTicketId,
      messages = [],
      topK = 5,
      minScore = 0.3,
    } = options;

    // Извлекаем email и ticketId из вопроса, если не предоставлены
    const extractedEmail = this.extractUserEmail(question);
    const extractedTicketInfo = this.extractTicketInfo(question);
    
    const userEmail = providedEmail || extractedEmail;
    const ticketId = providedTicketId || extractedTicketInfo.ticketId;

    // Получаем контекст пользователя
    let userContext = { userFound: false, user: null, tickets: [] };
    if (userEmail) {
      userContext = await this.getUserContext(userEmail);
    }

    // Получаем контекст тикета
    let ticketContext = { ticketFound: false, ticket: null };
    if (ticketId) {
      ticketContext = await this.getTicketContext(ticketId);
      // Если тикет найден, используем email из тикета
      if (ticketContext.ticketFound && !userEmail) {
        userContext = await this.getUserContext(ticketContext.ticket.userEmail);
      }
    }

    // Ищем похожие тикеты
    const similarTickets = await this.searchSimilarTickets(
      question,
      ticketContext.ticketFound ? ticketContext.ticket.category : null
    );

    // Получаем релевантные чанки из документации через RAG
    const ragResult = await this.ragService.searchRelevantChunks(
      question,
      topK,
      minScore
    );
    const ragChunks = ragResult.chunks || [];

    // Формируем промпт с контекстом
    const supportPrompt = this.buildSupportPrompt(
      question,
      userContext,
      ticketContext,
      similarTickets,
      ragChunks
    );

    // Вызываем LLM
    const ragMessages = [
      ...messages.slice(0, -1),
      { role: 'user', content: supportPrompt },
    ];

    const response = await llmCaller(supportPrompt, ragMessages);
    
    let answer = response.text || response.content || response;

    return {
      answer,
      userContext: {
        userFound: userContext.userFound,
        userEmail: userContext.user?.email || userEmail,
        userName: userContext.user?.name,
        openTicketsCount: userContext.tickets?.length || 0,
      },
      ticketContext: {
        ticketFound: ticketContext.ticketFound,
        ticketId: ticketContext.ticket?.id || ticketId,
        ticketStatus: ticketContext.ticket?.status,
      },
      similarTickets: similarTickets.map(t => ({
        id: t.id,
        subject: t.subject,
        description: t.description.substring(0, 200),
      })),
      ragChunks: ragChunks.map(chunk => ({
        text: chunk.text.substring(0, 200) + '...',
        source: chunk.document?.fileName || chunk.document?.id || 'Неизвестный источник',
        score: chunk.score,
      })),
      metadata: {
        tokens: response.tokens,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
    };
  }
}


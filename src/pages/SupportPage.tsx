import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Message } from '../types/message';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getMarkdownComponents } from '../utils/markdownComponents';
import { Send, HelpCircle, Ticket, User, FileText, Sparkles, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { querySupport, SupportQueryResult } from '../services/support';
import { generateId } from '../utils/generateId';
import { useAuth } from '../contexts/AuthContext';
import { getAuthHeader } from '../services/auth';
import { getTicketById, Ticket as TicketType } from '../services/tickets';

export function SupportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const ticketId = searchParams.get('ticket');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<SupportQueryResult | null>(null);
  const [currentTicket, setCurrentTicket] = useState<TicketType | null>(null);
  const [isLoadingTicket, setIsLoadingTicket] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Загружаем тикет при изменении ticketId в URL
  useEffect(() => {
    const loadTicket = async () => {
      if (ticketId && user) {
        setIsLoadingTicket(true);
        try {
          const ticket = await getTicketById(ticketId);
          setCurrentTicket(ticket);
          
          // Преобразуем сообщения тикета в формат Message
          const ticketMessages: Message[] = ticket.messages.map((msg) => ({
            id: msg.id,
            type: msg.author === 'user' ? 'user' : 'assistant',
            content: msg.text,
            timestamp: new Date(msg.timestamp),
          }));
          
          setMessages(ticketMessages);
        } catch (error) {
          console.error('Ошибка при загрузке тикета:', error);
          setMessages([]);
          setCurrentTicket(null);
        } finally {
          setIsLoadingTicket(false);
        }
      } else {
        // Если нет ticketId, очищаем сообщения
        setMessages([]);
        setCurrentTicket(null);
        setCurrentResult(null);
      }
    };

    loadTicket();
  }, [ticketId, user]);

  const handleSend = useCallback(async () => {
    if (inputValue.trim() && !isLoading && user) {
      const question = inputValue.trim();
      setInputValue('');
      
      // Добавляем сообщение пользователя
      const userMessage: Message = {
        id: generateId(),
        type: 'user',
        content: question,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // Если есть текущий тикет, добавляем сообщение в тикет
        if (currentTicket) {
          try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/support/tickets/${currentTicket.id}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader(),
              },
              body: JSON.stringify({
                author: 'user',
                text: question,
              }),
            });

            if (!response.ok) {
              console.error('Ошибка при добавлении сообщения в тикет');
            }
          } catch (error) {
            console.error('Ошибка при добавлении сообщения в тикет:', error);
          }
        }

        // Отправляем запрос в поддержку с данными авторизованного пользователя
        const result = await querySupport(question, 'deepseek', {
          userName: user.name,
          userEmail: user.email,
          ticketId: currentTicket?.id,
          messages: messages.map(m => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        });

        setCurrentResult(result);

        // Добавляем ответ ассистента
        const assistantMessage: Message = {
          id: generateId(),
          type: 'assistant',
          content: result.answer,
          timestamp: new Date(),
          aiResponse: {
            content: result.answer,
            references: result.ragChunks.map(chunk => ({
              title: chunk.source,
              url: `#chunk-${chunk.source}`,
            })),
            tokens: result.metadata.tokens,
            inputTokens: result.metadata.inputTokens,
            outputTokens: result.metadata.outputTokens,
          },
          ragChunks: result.ragChunks.map(chunk => ({
            text: chunk.text,
            score: chunk.score,
            source: chunk.source,
          })),
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Если есть текущий тикет, добавляем ответ ассистента в тикет
        if (currentTicket) {
          try {
            console.log('Добавление ответа ассистента в тикет:', currentTicket.id);
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/support/tickets/${currentTicket.id}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader(),
              },
              body: JSON.stringify({
                author: 'assistant',
                text: result.answer,
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Неизвестная ошибка' }));
              console.error('Ошибка при добавлении ответа в тикет:', errorData);
            } else {
              // Обновляем текущий тикет
              const updatedTicket = await getTicketById(currentTicket.id);
              setCurrentTicket(updatedTicket);
              console.log('Ответ ассистента успешно добавлен в тикет');
            }
          } catch (error) {
            console.error('Ошибка при добавлении ответа в тикет:', error);
          }
        }
        
        // Всегда обновляем список тикетов после отправки вопроса (тикет создается всегда)
        window.dispatchEvent(new CustomEvent('ticketCreated'));
      } catch (error) {
        console.error('Ошибка при запросе поддержки:', error);
        const errorMessage: Message = {
          id: generateId(),
          type: 'assistant',
          content: `Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [inputValue, isLoading, user, messages, currentTicket]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleNewTicket = useCallback(() => {
    setSearchParams({});
    setMessages([]);
    setCurrentTicket(null);
    setCurrentResult(null);
    setInputValue('');
  }, [setSearchParams]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] text-[#e0e0e8] relative">
      {/* Заголовок */}
      <div className="h-16 border-b border-[#2a2a3a] bg-[#151520]/80 backdrop-blur-xl px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#0066ff] to-[#8000cc]">
            <HelpCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">
              {currentTicket ? currentTicket.subject : 'Поддержка'}
            </h1>
            <p className="text-sm text-[#a0a0b0]">
              {currentTicket 
                ? `Тикет #${currentTicket.id.split('-')[1]?.slice(0, 8) || currentTicket.id.slice(-8)} • ${currentTicket.status === 'open' ? 'Открыт' : currentTicket.status === 'closed' ? 'Закрыт' : 'В работе'}`
                : 'AI ассистент для решения ваших вопросов'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {currentTicket && (
            <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
              currentTicket.status === 'open' 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : currentTicket.status === 'closed'
                ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            }`}>
              {currentTicket.status === 'open' ? 'Открыт' : currentTicket.status === 'closed' ? 'Закрыт' : 'В работе'}
            </span>
          )}
          <button
            onClick={handleNewTicket}
            className="px-3 py-1.5 rounded-lg bg-[#1e1e2e] border border-[#2a2a3a] hover:bg-[#2a2a3a] text-white text-sm font-medium flex items-center gap-2 transition-colors"
            title="Создать новый тикет"
          >
            <Plus className="w-4 h-4" />
            Новый тикет
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Основная область чата */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Область сообщений */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0 relative">
            {isLoadingTicket && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <div className="p-4 rounded-full bg-gradient-to-br from-[#0066ff]/20 to-[#8000cc]/20 mb-4">
                  <Sparkles className="w-12 h-12 text-[#00f0ff] animate-pulse" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Загрузка тикета...
                </h2>
              </div>
            )}
            {!isLoadingTicket && messages.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                <div className="p-4 rounded-full bg-gradient-to-br from-[#0066ff]/20 to-[#8000cc]/20 mb-4">
                  <Sparkles className="w-12 h-12 text-[#00f0ff]" />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Добро пожаловать в поддержку!
                </h2>
                <p className="text-[#a0a0b0] max-w-md">
                  Задайте ваш вопрос, и я помогу вам решить проблему, используя документацию и историю ваших тикетов.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.type === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0066ff] to-[#8000cc] flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.type === 'user'
                      ? 'bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white'
                      : 'bg-[#1e1e2e] border border-[#2a2a3a] text-[#e0e0e8]'
                  }`}
                >
                  <div className="prose prose-invert max-w-none">
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={getMarkdownComponents()}
                    >
                      {message.content}
                    </Markdown>
                  </div>
                  {message.ragChunks && message.ragChunks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#2a2a3a]">
                      <div className="text-xs text-[#a0a0b0] mb-2">Источники:</div>
                      <div className="flex flex-wrap gap-2">
                        {message.ragChunks.map((chunk, idx) => (
                          <div
                            key={idx}
                            className="text-xs px-2 py-1 rounded bg-[#2a2a3a] text-[#a0a0b0]"
                          >
                            {chunk.source} ({Math.round(chunk.score * 100)}%)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {message.type === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#2a2a3a] flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-[#a0a0b0]" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4 justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0066ff] to-[#8000cc] flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                </div>
                <div className="bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-bounce" style={{ animationDelay: '0s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Поле ввода */}
          <div className="h-16 border-t border-[#2a2a3a] bg-[#151520]/80 backdrop-blur-xl px-6 flex items-center">
            <div className="flex gap-3 items-center w-full">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Задайте ваш вопрос..."
                  className="w-full bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white placeholder-[#666] outline-none focus:border-[#00f0ff] transition-colors h-11"
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                className="h-11 w-11 rounded-lg bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white hover:from-[#0055ff] hover:to-[#7000bb] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Боковая панель с контекстом */}
        {currentResult && (
          <div className="w-80 border-l border-[#2a2a3a] bg-[#151520]/80 backdrop-blur-xl overflow-y-auto">
            <div className="p-4 space-y-4">
              {/* Информация о пользователе */}
              {currentResult.userContext.userFound && (
                <div className="p-4 rounded-lg bg-[#1e1e2e] border border-[#2a2a3a]">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-[#00f0ff]" />
                    <h3 className="text-sm font-semibold text-white">Пользователь</h3>
                  </div>
                  <div className="text-sm text-[#a0a0b0] space-y-1">
                    <div>{currentResult.userContext.userName || currentResult.userContext.userEmail}</div>
                    {currentResult.userContext.openTicketsCount > 0 && (
                      <div className="text-xs text-[#00f0ff]">
                        Открытых тикетов: {currentResult.userContext.openTicketsCount}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Информация о тикете */}
              {currentResult.ticketContext.ticketFound && (
                <div className="p-4 rounded-lg bg-[#1e1e2e] border border-[#2a2a3a]">
                  <div className="flex items-center gap-2 mb-2">
                    <Ticket className="w-4 h-4 text-[#00f0ff]" />
                    <h3 className="text-sm font-semibold text-white">Тикет</h3>
                  </div>
                  <div className="text-sm text-[#a0a0b0] space-y-1">
                    <div>ID: {currentResult.ticketContext.ticketId}</div>
                    <div className="text-xs">
                      Статус: <span className="text-[#00f0ff]">{currentResult.ticketContext.ticketStatus}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Похожие тикеты */}
              {currentResult.similarTickets.length > 0 && (
                <div className="p-4 rounded-lg bg-[#1e1e2e] border border-[#2a2a3a]">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-[#00f0ff]" />
                    <h3 className="text-sm font-semibold text-white">Похожие проблемы</h3>
                  </div>
                  <div className="space-y-2">
                    {currentResult.similarTickets.map((ticket) => (
                      <div key={ticket.id} className="text-xs text-[#a0a0b0] p-2 rounded bg-[#2a2a3a]">
                        <div className="font-medium text-white mb-1">{ticket.subject}</div>
                        <div className="line-clamp-2">{ticket.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Источники из RAG */}
              {currentResult.ragChunks.length > 0 && (
                <div className="p-4 rounded-lg bg-[#1e1e2e] border border-[#2a2a3a]">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-[#00f0ff]" />
                    <h3 className="text-sm font-semibold text-white">Источники</h3>
                  </div>
                  <div className="space-y-2">
                    {currentResult.ragChunks.map((chunk, idx) => (
                      <div key={idx} className="text-xs text-[#a0a0b0] p-2 rounded bg-[#2a2a3a]">
                        <div className="font-medium text-white mb-1">{chunk.source}</div>
                        <div className="text-[#00f0ff] mb-1">
                          Релевантность: {Math.round(chunk.score * 100)}%
                        </div>
                        <div className="line-clamp-3">{chunk.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


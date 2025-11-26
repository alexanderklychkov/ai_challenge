import { useState, useRef, useEffect, useCallback } from 'react';
import { Message } from '../types/message';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getMarkdownComponents } from '../utils/markdownComponents';
import { Zap, Package, Send, Code, Sparkles, Settings, Wrench, FileText, CreditCard, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parseLearningContent } from '../utils/parseLearningContent';
import { RAGComparison } from './RAGComparison';

interface ChatAreaProps {
  messages: Message[]
  isLoading?: boolean
  isLoadingMessages?: boolean
  onSendMessage: (content: string) => void
  onClearMessages: () => void
  onOpenSettings?: () => void
}

const DOT_STYLES = [
  { animationDelay: '0s' },
  { animationDelay: '0.2s' },
  { animationDelay: '0.4s' },
] as const;

const TEXTAREA_MAX_HEIGHT = { maxHeight: '200px' } as const;

const TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
} as const;

const ChatArea = ({ 
  messages, 
  isLoading = false,
  isLoadingMessages = false,
  onSendMessage, 
  onClearMessages,
  onOpenSettings,
}: ChatAreaProps) => {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(44, Math.min(textareaRef.current.scrollHeight, 200));
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [inputValue]);

  const handleSend = useCallback(() => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  }, [inputValue, isLoading, onSendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  }, []);

  const toggleToolsExpanded = useCallback((messageId: string) => {
    setExpandedTools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  return (
    <main className="flex-1 flex flex-col bg-[#0a0a0f]/50 backdrop-blur-sm overflow-hidden relative">
      {/* Заголовок */}
      <header className="h-16 border-b border-[#2a2a3a] px-4 md:px-6 bg-[#151520]/80 backdrop-blur-xl relative flex items-center">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>
        <div className="flex items-center justify-between relative z-10 w-full">
          <div className="flex-1 flex items-center gap-3">
            <div className="relative flex items-center gap-2">
              <Code className="w-6 h-6 md:w-7 md:h-7 text-[#00f0ff] drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
              <Sparkles className="w-3 h-3 absolute -top-0.5 -right-0.5 text-[#b026ff] animate-pulse" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold gradient-text">
              Frontend Mentor AI
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                onClick={onClearMessages}
                disabled={isLoading}
                className="flex-shrink-0 px-4 py-2 cursor-pointer text-sm font-medium text-[#e0e0e8] bg-[#1e1e2e] rounded-lg border border-[#2a2a3a] hover:bg-[#2a2a3a] hover:border-[#00f0ff]/50 hover:text-[#00f0ff] focus:outline-none focus:ring-2 focus:ring-[#00f0ff] focus:ring-offset-2 focus:ring-offset-[#0a0a0f] disabled:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:text-[#505050] disabled:border-[#1a1a1a] transition-all duration-300"
                aria-label="Очистить чат"
                title="Очистить историю чата"
              >
                Очистить чат
              </button>
            )}
            {/* Кнопка настроек */}
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="flex-shrink-0 p-2 text-[#a0a0b0] hover:text-[#00f0ff] hover:bg-[#1e1e2e] rounded-lg transition-all duration-300 cursor-pointer"
                title="Настройки чата"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Область сообщений */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-[#a0a0b0]">
              <div className="flex justify-center space-x-2 mb-4">
                {DOT_STYLES.map((style, index) => (
                  <div
                    key={index}
                    className="w-3 h-3 bg-gradient-to-br from-[#00f0ff] to-[#b026ff] rounded-full animate-bounce shadow-[0_0_10px_rgba(0,240,255,0.5)]"
                    style={style}
                  />
                ))}
              </div>
              <p className="text-lg gradient-text">Загрузка истории сообщений...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-[#a0a0b0]">
              <Zap className="w-16 h-16 mx-auto mb-4 opacity-50 text-[#00f0ff]" />
              <p className="text-lg gradient-text">Начните диалог</p>
              <p className="text-sm mt-2">Задайте вопрос о фронтенд-разработке</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              // Специальный рендеринг для статусных сообщений
              if (message.type === 'status' && message.statusMessage) {
                const status = message.statusMessage;
                const statusColors = {
                  'pending': 'text-[#a0a0b0]',
                  'in_progress': 'text-[#00f0ff]',
                  'completed': 'text-[#00ff88]',
                  'error': 'text-[#ff4444]',
                };
                
                const statusIcons = {
                  'pending': '⏳',
                  'in_progress': '⚙️',
                  'completed': '✓',
                  'error': '✗',
                };
                
                return (
                  <div
                    key={message.id}
                    className="flex justify-start animate-[slide-in_0.3s_ease-out]"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className={`max-w-[85%] md:max-w-[70%] rounded-xl p-3 backdrop-blur-sm bg-[#1e1e2e]/60 text-[#e0e0e8] border border-[#2a2a3a] shadow-[0_0_10px_rgba(0,240,255,0.2)] transition-all duration-300 ${
                      status.status === 'in_progress' ? 'animate-pulse' : ''
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg ${statusColors[status.status]} ${
                          status.status === 'in_progress' ? 'animate-spin' : ''
                        }`}>
                          {statusIcons[status.status]}
                        </span>
                        <span className={`text-sm font-medium ${statusColors[status.status]}`}>
                          {status.message}
                        </span>
                        {status.serverName && (
                          <span className="ml-auto text-xs text-[#a0a0b0] px-2 py-0.5 rounded bg-[#2a2a3a]">
                            {status.serverName}
                          </span>
                        )}
                      </div>
                      {status.error && (
                        <div className="mt-2 text-xs text-[#ff4444]">
                          {status.error}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              
              return (
                <div
                  key={message.id}
                  className={`flex ${
                    message.type === 'user' ? 'justify-end' : 'justify-start'
                  } animate-[slide-in_0.3s_ease-out]`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                <div
                  className={`max-w-[85%] md:max-w-[70%] rounded-xl p-4 backdrop-blur-sm ${
                    message.type === 'user'
                      ? 'bg-gradient-to-br from-[#b026ff] to-[#8000cc] text-white shadow-[0_0_20px_rgba(176,38,255,0.4)] border border-[#b026ff]/40'
                      : 'bg-[#1e1e2e]/80 text-[#e0e0e8] border border-[#2a2a3a] shadow-[0_0_15px_rgba(176,38,255,0.1)]'
                  } ${message.compressedBy ? 'opacity-60 border-2 border-[#b026ff]/50' : ''} transition-all duration-300`}
                >
                  {/* Индикатор сжатого сообщения */}
                  {message.compressedBy && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-[#b026ff]/20 text-[#b026ff] border border-[#b026ff]/50 shadow-[0_0_10px_rgba(176,38,255,0.3)]">
                        <Package className="w-3 h-3" />
                        Сжато (не отправляется в AI)
                      </span>
                    </div>
                  )}
                  {/* Model name и Difficulty badge для assistant сообщений */}
                  {message.type === 'assistant' && (
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                      {message.isSummary && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#b026ff]/20 text-[#b026ff] border border-[#b026ff]/50 shadow-[0_0_10px_rgba(176,38,255,0.3)]">
                          <Package className="w-3 h-3" />
                          Сжатие истории
                        </span>
                      )}
                      {message.modelName && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 shadow-[0_0_10px_rgba(0,240,255,0.3)]">
                          {message.modelName}
                        </span>
                      )}
                      {message.aiResponse?.difficulty && (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-[0_0_10px_currentColor] ${
                            message.aiResponse.difficulty === 'beginner'
                              ? 'bg-[#00ff88]/20 text-[#00ff88] border-[#00ff88]/50'
                              : message.aiResponse.difficulty === 'intermediate'
                              ? 'bg-[#ffaa00]/20 text-[#ffaa00] border-[#ffaa00]/50'
                              : 'bg-[#ff4444]/20 text-[#ff4444] border-[#ff4444]/50'
                          }`}
                        >
                          {message.aiResponse.difficulty === 'beginner'
                            ? 'Начинающий'
                            : message.aiResponse.difficulty === 'intermediate'
                            ? 'Средний'
                            : 'Продвинутый'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* RAG Comparison */}
                  {message.ragComparison && (
                    <div className="mb-4">
                      <RAGComparison comparison={message.ragComparison} />
                    </div>
                  )}

                  {/* RAG Warning */}
                  {message.ragWarning && (
                    <div className="mb-4 p-3 bg-[#2a1a1a] rounded-lg border border-[#ff4444]/50">
                      <div className="flex items-start gap-2">
                        <div className="text-[#ff4444] text-sm">⚠️</div>
                        <div className="flex-1">
                          <div className="text-xs font-medium text-[#ff4444] mb-1">
                            Предупреждение
                          </div>
                          <div className="text-xs text-[#ffaaaa]">
                            {message.ragWarning}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* RAG Chunks */}
                  {message.ragChunks && message.ragChunks.length > 0 && (
                    <div className="mb-4 p-3 bg-[#151520] rounded-lg border border-[#2a2a3a]">
                      <div className="text-xs font-medium text-[#00f0ff] mb-2">
                        Использовано {message.ragChunks.length} релевантных чанков:
                      </div>
                      <div className="space-y-2">
                        {message.ragChunks.slice(0, 3).map((chunk, idx) => (
                          <div key={idx} className="text-xs text-[#a0a0b0] line-clamp-2">
                            <span className="text-[#00f0ff]">{chunk.source}</span>: {chunk.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="break-words max-w-none">
                    <Markdown 
                      remarkPlugins={[remarkGfm]}
                      components={getMarkdownComponents(message.type === 'user')}
                    >
                      {message.content}
                    </Markdown>
                  </div>

                  {/* Ссылки на элементы обучения */}
                  {message.type === 'assistant' && (() => {
                    // Парсим контент сообщения для поиска ID элементов обучения
                    const contentLearning = parseLearningContent(message.content);
                    
                    // Также проверяем использованные инструменты
                    let learningContent = contentLearning;
                    
                    // Если не нашли в контенте, пытаемся найти в использованных инструментах
                    if (!learningContent && message.aiResponse?.usedTools) {
                      const hasTestTool = message.aiResponse.usedTools.some(t => t.name === 'createTest');
                      const hasFlashcardTool = message.aiResponse.usedTools.some(t => t.name === 'createFlashcards');
                      const hasPlanTool = message.aiResponse.usedTools.some(t => t.name === 'createStudyPlan');
                      
                      if (hasTestTool || hasFlashcardTool || hasPlanTool) {
                        // Парсим контент еще раз
                        learningContent = parseLearningContent(message.content);
                      }
                    }
                    
                    if (!learningContent) return null;

                    return (
                      <div className="mt-4 pt-4 border-t border-[#2a2a3a]">
                        <div className="flex flex-wrap gap-2">
                          {learningContent.testId && (
                            <button
                              onClick={() => navigate(`/learning/test/${learningContent.testId}`)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#00f0ff]/10 border border-[#00f0ff]/50 rounded-lg text-sm text-[#00f0ff] hover:bg-[#00f0ff]/20 hover:border-[#00f0ff] transition-all cursor-pointer"
                            >
                              <FileText className="w-4 h-4" />
                              Открыть тест
                            </button>
                          )}
                          {learningContent.flashcardSetId && (
                            <button
                              onClick={() => navigate(`/learning/flashcards/${learningContent.flashcardSetId}`)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#b026ff]/10 border border-[#b026ff]/50 rounded-lg text-sm text-[#b026ff] hover:bg-[#b026ff]/20 hover:border-[#b026ff] transition-all cursor-pointer"
                            >
                              <CreditCard className="w-4 h-4" />
                              Открыть карточки
                            </button>
                          )}
                          {learningContent.studyPlanId && (
                            <button
                              onClick={() => navigate(`/learning/plan/${learningContent.studyPlanId}`)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#00ff88]/10 border border-[#00ff88]/50 rounded-lg text-sm text-[#00ff88] hover:bg-[#00ff88]/20 hover:border-[#00ff88] transition-all cursor-pointer"
                            >
                              <Calendar className="w-4 h-4" />
                              Открыть план изучения
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-[#a0a0b0] mt-2">
                          Перейдите в раздел "Обучение" для просмотра и прохождения
                        </p>
                      </div>
                    );
                  })()}

                  {/* Used Tools для assistant сообщений */}
                  {message.type === 'assistant' && message.aiResponse?.usedTools && message.aiResponse.usedTools.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#2a2a3a]">
                      <button
                        onClick={() => toggleToolsExpanded(message.id)}
                        className="w-full text-left text-sm font-semibold text-[#00f0ff] mb-2 flex items-center gap-2 hover:text-[#b026ff] transition-colors cursor-pointer"
                      >
                        {expandedTools.has(message.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        <Wrench className="w-4 h-4" />
                        <span>Использованные инструменты MCP:</span>
                        <span className="text-xs text-[#a0a0b0] ml-auto">
                          ({message.aiResponse.usedTools.length})
                        </span>
                      </button>
                      {expandedTools.has(message.id) && (
                        <div className="space-y-2 animate-[slide-in_0.2s_ease-out]">
                          {message.aiResponse.usedTools.map((tool, index) => (
                            <div
                              key={index}
                              className={`text-xs p-2 rounded border ${
                                tool.error
                                  ? 'bg-[#ff4444]/10 border-[#ff4444]/50 text-[#ff4444]'
                                  : 'bg-[#00f0ff]/10 border-[#00f0ff]/50 text-[#00f0ff]'
                              }`}
                            >
                              <div className="font-medium flex items-center gap-2 flex-wrap">
                                <Wrench className="w-3 h-3" />
                                <span>{tool.name}</span>
                                {tool.serverName && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-[#8000cc]/30 text-[#b026ff] border border-[#8000cc]/50">
                                    {tool.serverName}
                                  </span>
                                )}
                                {tool.error && (
                                  <span className="text-[#ff4444] ml-auto">Ошибка</span>
                                )}
                              </div>
                              {tool.serverCategory && (
                                <div className="mt-1 text-[10px] text-[#a0a0b0]">
                                  Категория: <span className="text-[#00f0ff]">{tool.serverCategory}</span>
                                </div>
                              )}
                              {tool.args && Object.keys(tool.args).length > 0 && (
                                <div className="mt-1 text-[#a0a0b0] font-mono text-[10px]">
                                  {JSON.stringify(tool.args, null, 2)}
                                </div>
                              )}
                              {tool.error && (
                                <div className="mt-1 text-[#ff4444] text-[10px]">
                                  {tool.error}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* References для assistant сообщений */}
                  {message.type === 'assistant' && message.aiResponse?.references && message.aiResponse.references.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#2a2a3a]">
                      <h4 className="text-sm font-semibold text-[#00f0ff] mb-2">Полезные ссылки:</h4>
                      <ul className="space-y-1.5">
                        {message.aiResponse.references.map((ref, index) => (
                          <li key={index}>
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#00f0ff] hover:text-[#b026ff] underline break-all transition-colors duration-200 cursor-pointer"
                            >
                              {ref.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <div
                      className={`text-xs ${
                        message.type === 'user'
                          ? 'text-white/80'
                          : 'text-[#a0a0b0]'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString('ru-RU', TIME_FORMAT_OPTIONS)}
                    </div>
                    {message.type === 'assistant' && message.aiResponse && (
                      <div className="flex items-center gap-3 text-xs text-[#a0a0b0]">
                        {message.aiResponse.responseTime !== undefined && (
                          <span className="text-[#00f0ff]">
                            {(message.aiResponse.responseTime / 1000).toFixed(2)}с
                          </span>
                        )}
                        {message.aiResponse.tokens !== undefined && (
                          <span className="relative group">
                            <span className="text-[#b026ff]">{message.aiResponse.tokens.toLocaleString('ru-RU')}</span> токенов
                            {message.aiResponse.inputTokens !== undefined && message.aiResponse.outputTokens !== undefined && (
                              <>
                                <span className="text-[#a0a0b0] ml-1">
                                  ({message.aiResponse.inputTokens.toLocaleString('ru-RU')}/{message.aiResponse.outputTokens.toLocaleString('ru-RU')})
                                </span>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-[#1e1e2e] text-[#e0e0e8] text-xs rounded-lg border border-[#2a2a3a] shadow-[0_0_20px_rgba(0,240,255,0.3)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                  <div className="flex flex-col gap-1">
                                    <div>Входные токены: {message.aiResponse.inputTokens.toLocaleString('ru-RU')}</div>
                                    <div>Выходные токены: {message.aiResponse.outputTokens.toLocaleString('ru-RU')}</div>
                                  </div>
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                    <div className="border-4 border-transparent border-t-[#1e1e2e]"></div>
                                  </div>
                                </div>
                              </>
                            )}
                          </span>
                        )}
                        {message.aiResponse.cost !== undefined && message.aiResponse.cost > 0 && (
                          <span className="text-[#00ff88] font-medium">
                            ${message.aiResponse.cost.toFixed(6)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-start animate-[slide-in_0.3s_ease-out]">
                <div className="bg-[#1e1e2e]/80 backdrop-blur-sm text-[#e0e0e8] rounded-xl p-4 border border-[#2a2a3a] shadow-[0_0_15px_rgba(176,38,255,0.1)] max-w-[85%] md:max-w-[70%]">
                  <div className="flex space-x-2">
                    {DOT_STYLES.map((style, index) => (
                      <div
                        key={index}
                        className="w-2 h-2 bg-gradient-to-br from-[#00f0ff] to-[#b026ff] rounded-full animate-bounce shadow-[0_0_10px_rgba(0,240,255,0.5)]"
                        style={style}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Поле ввода */}
      <div className="border-t border-[#2a2a3a] px-4 md:px-6 py-4 bg-[#151520]/80 backdrop-blur-xl relative">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#b026ff] to-transparent"></div>
        <div className="flex space-x-3 relative z-10">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Спроси о фронтенд-разработке... (команды: /analyze, /help)"
              className="w-full px-4 py-2.5 pr-12 border border-[#2a2a3a] rounded-lg bg-[#1e1e2e]/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#00f0ff] focus:border-[#00f0ff]/50 focus:shadow-[0_0_20px_rgba(0,240,255,0.3)] resize-none overflow-hidden text-[#e0e0e8] placeholder-[#505060] transition-all duration-300"
              rows={1}
              style={TEXTAREA_MAX_HEIGHT}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="flex-shrink-0 w-11 h-11 bg-gradient-to-r from-[#0066ff] to-[#8000cc] text-white rounded-lg hover:from-[#0055ff] hover:to-[#7000bb] focus:outline-none focus:ring-2 focus:ring-[#0066ff] focus:ring-offset-2 focus:ring-offset-[#151520] disabled:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:text-[#505050] transition-all duration-300 flex items-center justify-center shadow-[0_0_10px_rgba(0,102,255,0.2)] hover:shadow-[0_0_15px_rgba(0,102,255,0.3)] disabled:shadow-none cursor-pointer"
            aria-label="Отправить сообщение"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </main>
  )
}

export default ChatArea;

import { useState, useRef, useEffect, useCallback } from 'react';
import { Message } from '../types/message';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getMarkdownComponents } from '../utils/markdownComponents';
import { Zap, Package, Send, Code, Sparkles, Settings, Wrench } from 'lucide-react';

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
  const [inputValue, setInputValue] = useState('');
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
                className="flex-shrink-0 p-2 text-[#a0a0b0] hover:text-[#00f0ff] hover:bg-[#1e1e2e] rounded-lg transition-all duration-300"
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
            {messages.map((message, index) => (
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
                  } ${message.compressedBy ? 'opacity-60 border-2 border-[#b026ff]/50' : ''} transition-all duration-300 hover:scale-[1.02]`}
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

                  <div className="break-words max-w-none">
                    <Markdown 
                      remarkPlugins={[remarkGfm]}
                      components={getMarkdownComponents(message.type === 'user')}
                    >
                      {message.content}
                    </Markdown>
                  </div>

                  {/* Used Tools для assistant сообщений */}
                  {message.type === 'assistant' && message.aiResponse?.usedTools && message.aiResponse.usedTools.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#2a2a3a]">
                      <h4 className="text-sm font-semibold text-[#00f0ff] mb-2 flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        Использованные инструменты MCP:
                      </h4>
                      <div className="space-y-2">
                        {message.aiResponse.usedTools.map((tool, index) => (
                          <div
                            key={index}
                            className={`text-xs p-2 rounded border ${
                              tool.error
                                ? 'bg-[#ff4444]/10 border-[#ff4444]/50 text-[#ff4444]'
                                : 'bg-[#00f0ff]/10 border-[#00f0ff]/50 text-[#00f0ff]'
                            }`}
                          >
                            <div className="font-medium flex items-center gap-2">
                              <Wrench className="w-3 h-3" />
                              {tool.name}
                              {tool.error && (
                                <span className="text-[#ff4444] ml-auto">Ошибка</span>
                              )}
                            </div>
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
                              className="text-sm text-[#00f0ff] hover:text-[#b026ff] underline break-all transition-colors duration-200"
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
            ))}
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

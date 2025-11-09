import { useState, useRef, useEffect, useCallback } from 'react';
import { Message } from '../types/message';
import Markdown from 'react-markdown';
import { getMarkdownComponents } from '../utils/markdownComponents';

interface ChatAreaProps {
  messages: Message[]
  isLoading?: boolean
  onSendMessage: (content: string) => void
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

const ChatArea = ({ messages, isLoading = false, onSendMessage }: ChatAreaProps) => {
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
    <main className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Заголовок */}
      <header className="border-b border-gray-200 px-4 md:px-6 py-4 bg-white">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">
          Frontend Mentor AI
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Ваш помощник в изучении фронтенд-разработки
        </p>
      </header>

      {/* Область сообщений */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <p className="text-lg">Начните диалог</p>
              <p className="text-sm mt-2">Задайте вопрос о фронтенд-разработке</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] rounded-xl p-4 shadow-sm ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {/* Model name и Difficulty badge для assistant сообщений */}
                  {message.type === 'assistant' && (
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                      {message.modelName && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {message.modelName}
                        </span>
                      )}
                      {message.aiResponse?.difficulty && (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            message.aiResponse.difficulty === 'beginner'
                              ? 'bg-green-100 text-green-800'
                              : message.aiResponse.difficulty === 'intermediate'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
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
                    <Markdown components={getMarkdownComponents(message.type === 'user')}>
                      {message.content}
                    </Markdown>
                  </div>

                  {/* References для assistant сообщений */}
                  {message.type === 'assistant' && message.aiResponse?.references && message.aiResponse.references.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Полезные ссылки:</h4>
                      <ul className="space-y-1.5">
                        {message.aiResponse.references.map((ref, index) => (
                          <li key={index}>
                            <a
                              href={ref.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:text-blue-700 underline break-all"
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
                          ? 'text-blue-100'
                          : 'text-gray-500'
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString('ru-RU', TIME_FORMAT_OPTIONS)}
                    </div>
                    {message.type === 'assistant' && message.aiResponse?.tokens && (
                      <div className="text-xs text-gray-400">
                        {message.aiResponse.tokens.toLocaleString('ru-RU')} токенов
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 rounded-xl p-4 shadow-sm max-w-[85%] md:max-w-[70%]">
                  <div className="flex space-x-2">
                    {DOT_STYLES.map((style, index) => (
                      <div
                        key={index}
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
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
      <div className="border-t border-gray-200 px-4 md:px-6 py-4 bg-white">
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder="Спроси о фронтенд-разработке..."
              className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-hidden text-gray-800 placeholder-gray-400"
              rows={1}
              style={TEXTAREA_MAX_HEIGHT}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="flex-shrink-0 w-11 h-11 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            aria-label="Отправить сообщение"
          >
            <span className="text-xl">↗</span>
          </button>
        </div>
      </div>
    </main>
  )
}

export default ChatArea;

import { TokenStatistics } from '../hooks/useChat';
import { Message } from '../types/message';
import { Lightbulb } from 'lucide-react';

interface ContextPanelProps {
  messages?: Message[];
  tokenStatistics?: TokenStatistics;
  modelName?: string;
}

const ContextPanel = ({ messages = [], tokenStatistics, modelName }: ContextPanelProps) => {
  const userMessagesCount = messages.filter(m => m.type === 'user').length;
  const assistantMessagesCount = messages.filter(m => m.type === 'assistant').length;
  
  return (
    <aside className="hidden lg:flex flex-col w-[300px] border-l border-[#2a2a3a] bg-[#151520]/80 backdrop-blur-xl relative">
      {/* Градиентная линия сверху */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#b026ff] to-transparent"></div>
      
      <div className="h-16 flex items-center px-4 border-b border-[#2a2a3a] relative">
        <h2 className="text-lg font-semibold gradient-text">Контекстная панель</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Информация о модели */}
        {modelName && (
          <div className="bg-[#1e1e2e]/60 backdrop-blur-sm rounded-lg p-3 border border-[#2a2a3a]">
            <h3 className="text-xs font-semibold text-[#00f0ff] mb-2 uppercase tracking-wider">Модель</h3>
            <p className="text-sm text-[#e0e0e8]">{modelName}</p>
          </div>
        )}
        
        {/* Статистика сессии */}
        {messages.length > 0 && (
          <div className="bg-[#1e1e2e]/60 backdrop-blur-sm rounded-lg p-3 border border-[#2a2a3a]">
            <h3 className="text-xs font-semibold text-[#00f0ff] mb-2 uppercase tracking-wider">Сессия</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#a0a0b0]">Сообщений:</span>
                <span className="text-[#e0e0e8] font-medium">{messages.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a0a0b0]">Вопросов:</span>
                <span className="text-[#00f0ff] font-medium">{userMessagesCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a0a0b0]">Ответов:</span>
                <span className="text-[#b026ff] font-medium">{assistantMessagesCount}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Детальная статистика токенов */}
        {tokenStatistics && messages.length > 0 && (
          <div className="bg-[#1e1e2e]/60 backdrop-blur-sm rounded-lg p-3 border border-[#2a2a3a]">
            <h3 className="text-xs font-semibold text-[#00f0ff] mb-2 uppercase tracking-wider">Токены</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#a0a0b0]">Всего:</span>
                <span className="text-[#e0e0e8] font-medium">{tokenStatistics.totalTokens.toLocaleString('ru-RU')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a0a0b0]">Входные:</span>
                <span className="text-[#00f0ff]">{tokenStatistics.totalInputTokens.toLocaleString('ru-RU')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a0a0b0]">Выходные:</span>
                <span className="text-[#b026ff]">{tokenStatistics.totalOutputTokens.toLocaleString('ru-RU')}</span>
              </div>
              {tokenStatistics.summaryTokens > 0 && (
                <div className="flex justify-between pt-1 border-t border-[#2a2a3a]">
                  <span className="text-[#a0a0b0]">Сжатие:</span>
                  <span className="text-[#ffaa00]">{tokenStatistics.summaryTokens.toLocaleString('ru-RU')}</span>
                </div>
              )}
              {tokenStatistics.totalCost > 0 && (
                <div className="flex justify-between pt-1 border-t border-[#2a2a3a]">
                  <span className="text-[#a0a0b0]">Стоимость:</span>
                  <span className="text-[#00ff88] font-medium">${tokenStatistics.totalCost.toFixed(6)}</span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Полезные команды */}
        <div className="bg-[#1e1e2e]/60 backdrop-blur-sm rounded-lg p-3 border border-[#2a2a3a]">
          <h3 className="text-xs font-semibold text-[#00f0ff] mb-2 uppercase tracking-wider">Команды</h3>
          <div className="space-y-2 text-sm">
            <div>
              <code className="text-[#00f0ff] bg-[#00f0ff]/10 px-1.5 py-0.5 rounded text-xs">/analyze</code>
              <p className="text-[#a0a0b0] text-xs mt-1">Анализ ответов AI</p>
            </div>
            <div>
              <code className="text-[#b026ff] bg-[#b026ff]/10 px-1.5 py-0.5 rounded text-xs">/help</code>
              <p className="text-[#a0a0b0] text-xs mt-1">Справка по командам</p>
            </div>
          </div>
        </div>
        
        {/* Подсказка для пустого состояния */}
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[#a0a0b0]">
              <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-30 text-[#00f0ff]" />
              <p className="text-sm">Начните диалог</p>
              <p className="text-xs mt-2">Статистика появится здесь</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Градиентная линия снизу */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>
    </aside>
  );
};

export default ContextPanel;

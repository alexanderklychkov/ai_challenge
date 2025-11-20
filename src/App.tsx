import { useState, useMemo, useEffect } from 'react';
import ChatArea from './components/ChatArea.tsx';
import ContextPanel from './components/ContextPanel.tsx';
import ChatList from './components/ChatList.tsx';
import ChatSettings from './components/ChatSettings.tsx';
import { useChat } from './hooks/useChat';
import { createYandexGPTModel } from './services/yandexGPT';
import { createHuggingFaceModel } from './services/huggingFace';
import { createDeepSeekModel } from './services/deepSeek';
import { createChatGPTModel } from './services/chatGPT';
import { loadChats, createChat, updateChatSettings } from './services/storage';
import { Chat, ChatSettings as ChatSettingsType, AgentConfig } from './types/chat';
import { generateId } from './utils/generateId';
import { Code, Sparkles, Zap } from 'lucide-react';

function App() {
  const [enableCompression, setEnableCompression] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>('');
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [chatListRefreshTrigger, setChatListRefreshTrigger] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Инициализация: загружаем чаты или создаем первый
  useEffect(() => {
    const initializeChat = async () => {
      const chats = await loadChats();
      if (chats.length > 0) {
        setCurrentChatId(chats[0].id);
        setCurrentChat(chats[0]);
      } else {
        const newChat = await createChat('Новый чат');
        if (newChat) {
          setCurrentChatId(newChat.id);
          setCurrentChat(newChat);
        }
      }
      setIsInitializing(false);
    };
    initializeChat();
  }, []);

  // Загружаем текущий чат при изменении currentChatId
  useEffect(() => {
    const loadCurrentChat = async () => {
      if (currentChatId) {
        const chats = await loadChats();
        const chat = chats.find(c => c.id === currentChatId);
        if (chat) {
          setCurrentChat(chat);
        }
      }
    };
    loadCurrentChat();
  }, [currentChatId, chatListRefreshTrigger]);
  
  // Создаем модели из настроек чата или используем дефолтные
  const models = useMemo(() => {
    if (currentChat?.settings?.agents && currentChat.settings.agents.length > 0) {
      return currentChat.settings.agents.map((agent: AgentConfig) => {
        const config = {
          model: agent.model,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          ...(agent.type === 'deepseek' && { enableMCP: agent.enableMCP }),
          ...(agent.type === 'huggingface' && { provider: agent.provider }),
        };

        let model;
        switch (agent.type) {
          case 'deepseek':
            model = createDeepSeekModel(config);
            break;
          case 'huggingface':
            model = createHuggingFaceModel(config);
            break;
          case 'yandex':
            model = createYandexGPTModel(config);
            break;
          case 'chatgpt':
            model = createChatGPTModel(config);
            break;
          default:
            model = createDeepSeekModel(config);
        }

        return { model, name: agent.name };
      });
    }

    // Дефолтные модели
    return [
      { model: createDeepSeekModel({ model: 'deepseek-chat', enableMCP: true }), name: 'DeepSeek (с MCP)' },
    ];
  }, [currentChat?.settings?.agents]);

  // Режим работы из настроек чата или дефолтный
  const chatMode = currentChat?.settings?.mode || 'chain-fast';
  const chatEnableCompression = currentChat?.settings?.enableCompression || false;
  const chatCompressionInterval = currentChat?.settings?.compressionInterval || 6;

  // Модель-анализатор для команды /analyze
  const analyzerModel = useMemo(() => ({
    model: createHuggingFaceModel({ 
      model: 'openai/gpt-oss-120b', 
      provider: 'auto', 
      temperature: 0.3 
    }),
    name: 'Анализатор (GPT-OSS-120b)'
  }), []);
  
  // Режим работы: 'parallel' - параллельно, 'chain' - цепочкой
  const { messages, isLoading, isLoadingMessages, sendMessage, clearMessages, tokenStatistics } = useChat({ 
    chatId: currentChatId || 'temp', // Используем временный ID если еще не загрузили
    models, 
    mode: chatMode,
    analyzerModel, // Модель для анализа ответов (команда /analyze)
    enableCompression: chatEnableCompression || enableCompression, // Включить сжатие истории
    compressionInterval: chatCompressionInterval, // Сжимать каждые N сообщений
    compressionModel: models[0], // Модель для создания summary (используем первую модель)
  });

  const handleSaveSettings = async (settings: ChatSettingsType) => {
    if (currentChatId) {
      const success = await updateChatSettings(currentChatId, settings);
      if (success) {
        setChatListRefreshTrigger(prev => prev + 1);
        setShowSettings(false);
      }
    }
  };

  // Обновляем список чатов при изменении количества сообщений (с задержкой для сохранения на сервере)
  useEffect(() => {
    if (messages.length > 0 && !isLoadingMessages && !isLoading) {
      // Даем время на сохранение сообщений на сервере (debounce 500ms + запас для ответа AI)
      const timeout = setTimeout(() => {
        setChatListRefreshTrigger(prev => prev + 1);
      }, 1500);
      
      return () => clearTimeout(timeout);
    }
  }, [messages.length, isLoadingMessages, isLoading]);

  if (isInitializing || !currentChatId) {
    return (
      <div className="flex h-screen bg-[#0a0a0f] text-[#e0e0e8] items-center justify-center">
        <div className="text-[#a0a0b0]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-[#e0e0e8] overflow-hidden relative">
      {/* Фоновые эффекты */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00f0ff] opacity-10 rounded-full blur-3xl animate-slow-pulse" style={{ transform: 'translateZ(0)' }}></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#b026ff] opacity-10 rounded-full blur-3xl animate-slow-pulse" style={{ animationDelay: '1.5s', transform: 'translateZ(0)' }}></div>
      </div>
      
      <div className="relative z-10 flex w-full">
        {/* Панель с чатами слева */}
        <aside className="hidden md:flex flex-col w-[280px] border-r border-[#2a2a3a] bg-[#151520]/80 backdrop-blur-xl relative">
          {/* Градиентная линия сверху */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent"></div>
          
          {/* Список чатов */}
          <div className="flex-1 overflow-hidden">
            <ChatList 
              currentChatId={currentChatId}
              onChatSelect={setCurrentChatId}
              onChatCreated={(chatId) => setCurrentChatId(chatId)}
              refreshTrigger={chatListRefreshTrigger}
            />
          </div>
          
          {/* Градиентная линия снизу */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#b026ff] to-transparent"></div>
        </aside>
        
        <ChatArea 
          messages={messages} 
          isLoading={isLoading}
          isLoadingMessages={isLoadingMessages}
          onSendMessage={sendMessage} 
          onClearMessages={clearMessages}
          onOpenSettings={() => setShowSettings(true)}
        />
        <ContextPanel 
          messages={messages}
          tokenStatistics={tokenStatistics}
          modelName={models[0]?.name}
        />
      </div>

      {/* Модальное окно настроек */}
      {currentChat && (
        <ChatSettings
          chat={currentChat}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
          open={showSettings}
        />
      )}
    </div>
  );
}

export default App;

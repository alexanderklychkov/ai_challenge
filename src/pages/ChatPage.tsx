import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatArea from '../components/ChatArea.tsx';
import ContextPanel from '../components/ContextPanel.tsx';
import ChatSettings from '../components/ChatSettings.tsx';
import { useChat } from '../hooks/useChat';
import { createYandexGPTModel } from '../services/yandexGPT';
import { createHuggingFaceModel } from '../services/huggingFace';
import { createDeepSeekModel } from '../services/deepSeek';
import { createChatGPTModel } from '../services/chatGPT';
import { createLMStudioModel } from '../services/lmStudio';
import { createOllamaModel } from '../services/ollama';
import { loadChats, createChat, updateChatSettings } from '../services/storage';
import { Chat, ChatSettings as ChatSettingsType, AgentConfig } from '../types/chat';

interface ChatPageProps {
  chatListRefreshTrigger: number;
  onChatListRefresh: () => void;
}

export function ChatPage({ chatListRefreshTrigger, onChatListRefresh }: ChatPageProps) {
  const { chatId } = useParams<{ chatId?: string }>();
  const navigate = useNavigate();
  const [currentChatId, setCurrentChatId] = useState<string>('');
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Инициализация: загружаем чаты или создаем первый
  useEffect(() => {
    const initializeChat = async () => {
      const chats = await loadChats();
      if (chatId) {
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
          setCurrentChatId(chatId);
          setCurrentChat(chat);
          // Сохраняем выбранный чат
          sessionStorage.setItem('lastSelectedChatId', chatId);
        } else {
          // Если чат не найден, перенаправляем на первый чат или создаем новый
          if (chats.length > 0) {
            navigate(`/chat/${chats[0].id}`, { replace: true });
          } else {
            const newChat = await createChat('Новый чат');
            if (newChat) {
              navigate(`/chat/${newChat.id}`, { replace: true });
            }
          }
        }
      } else if (chatId === 'new') {
        // Создаем новый чат
        const newChat = await createChat('Новый чат');
        if (newChat) {
          navigate(`/chat/${newChat.id}`, { replace: true });
        }
      } else {
        // Если нет chatId в URL, пытаемся восстановить последний выбранный чат
        const lastSelectedChatId = sessionStorage.getItem('lastSelectedChatId');
        if (lastSelectedChatId) {
          const lastChat = chats.find(c => c.id === lastSelectedChatId);
          if (lastChat) {
            navigate(`/chat/${lastSelectedChatId}`, { replace: true });
            setIsInitializing(false);
            return;
          }
        }
        
        // Если нет сохранённого чата, перенаправляем на первый чат или создаем новый
        if (chats.length > 0) {
          navigate(`/chat/${chats[0].id}`, { replace: true });
        } else {
          navigate('/chat/new', { replace: true });
        }
      }
      setIsInitializing(false);
    };
    initializeChat();
  }, [chatId, navigate]);

  // Загружаем текущий чат при изменении chatId
  useEffect(() => {
    const loadCurrentChat = async () => {
      if (chatId) {
        const chats = await loadChats();
        const chat = chats.find(c => c.id === chatId);
        if (chat) {
          setCurrentChatId(chatId);
          setCurrentChat(chat);
          // Сохраняем выбранный чат
          sessionStorage.setItem('lastSelectedChatId', chatId);
        }
      }
    };
    loadCurrentChat();
  }, [chatId, chatListRefreshTrigger]);

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
          case 'lmstudio':
            model = createLMStudioModel(config);
            break;
          case 'ollama':
            model = createOllamaModel(config);
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
  const ragMode = currentChat?.settings?.ragMode || 'none';
  const ragTopK = currentChat?.settings?.ragTopK || 5;
  const ragMinScore = currentChat?.settings?.ragMinScore || 0.3;
  const ragUseReranker = currentChat?.settings?.ragUseReranker || false;
  const ragRerankerStrategy = currentChat?.settings?.ragRerankerStrategy || 'threshold';
  const ragRerankerThreshold = currentChat?.settings?.ragRerankerThreshold || 0.5;
  const ragRerankerTopK = currentChat?.settings?.ragRerankerTopK;

  // Модель-анализатор для команды /analyze
  const analyzerModel = useMemo(() => ({
    model: createHuggingFaceModel({ 
      model: 'openai/gpt-oss-120b', 
      provider: 'auto', 
      temperature: 0.3 
    }),
    name: 'Анализатор (GPT-OSS-120b)'
  }), []);
  
  // Определяем тип модели для RAG (из первого агента)
  const modelType = useMemo(() => {
    if (currentChat?.settings?.agents && currentChat.settings.agents.length > 0) {
      return currentChat.settings.agents[0].type as 'deepseek' | 'yandex' | 'chatgpt' | 'huggingface';
    }
    return 'deepseek' as const;
  }, [currentChat?.settings?.agents]);

  // Режим работы: 'parallel' - параллельно, 'chain' - цепочкой
  const { messages, isLoading, isLoadingMessages, sendMessage, clearMessages, tokenStatistics } = useChat({ 
    chatId: currentChatId,
    models, 
    mode: chatMode,
    analyzerModel,
    enableCompression: chatEnableCompression,
    compressionInterval: chatCompressionInterval,
    compressionModel: models[0],
    ragMode,
    ragTopK,
    ragMinScore,
    modelType,
    ragUseReranker,
    ragRerankerStrategy,
    ragRerankerThreshold,
    ragRerankerTopK,
  });

  const handleSaveSettings = async (settings: ChatSettingsType) => {
    if (currentChatId) {
      const success = await updateChatSettings(currentChatId, settings);
      if (success) {
        onChatListRefresh();
        setShowSettings(false);
      }
    }
  };

  // Обновляем список чатов при изменении количества сообщений (только когда загрузка завершена)
  const prevMessagesLengthRef = useRef(messages.length);
  useEffect(() => {
    // Обновляем только если количество сообщений изменилось И загрузка завершена
    if (messages.length !== prevMessagesLengthRef.current && !isLoadingMessages && !isLoading) {
      prevMessagesLengthRef.current = messages.length;
      const timeout = setTimeout(() => {
        onChatListRefresh();
      }, 2000); // Увеличиваем задержку для уменьшения частоты обновлений
      
      return () => clearTimeout(timeout);
    }
  }, [messages.length, isLoadingMessages, isLoading, onChatListRefresh]);

  if (isInitializing || !currentChatId) {
    return (
      <div className="flex h-screen bg-[#0a0a0f] text-[#e0e0e8] items-center justify-center">
        <div className="text-[#a0a0b0]">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full">
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


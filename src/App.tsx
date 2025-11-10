import { useState, useMemo } from 'react';
import Sidebar from './components/Sidebar.tsx';
import ChatArea from './components/ChatArea.tsx';
import ContextPanel from './components/ContextPanel.tsx';
import { useChat } from './hooks/useChat';
import { createYandexGPTModel } from './services/yandexGPT';
import { createDeepSeekModel } from './services/deepSeek';

export type ActiveTab = 'chat' | 'knowledge' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  
  const models = useMemo(() => [
    { model: createYandexGPTModel({ model: 'yandexgpt', temperature: 0 }), name: 'Yandex GPT. Температура: 0' },
    { model: createYandexGPTModel({ model: 'yandexgpt', temperature: 0.5 }), name: 'Yandex GPT. Температура: 0.5' },
    { model: createYandexGPTModel({ model: 'yandexgpt', temperature: 1 }), name: 'Yandex GPT. Температура: 1' },

    // { model: createDeepSeekModel({ model: 'deepseek-chat', temperature: 0 }), name: 'DeepSeek. Температура: 0' },
    // { model: createDeepSeekModel({ model: 'deepseek-chat', temperature: 1 }), name: 'DeepSeek. Температура: 1' },
    // { model: createDeepSeekModel({ model: 'deepseek-chat', temperature: 1.5 }), name: 'DeepSeek. Температура: 1.5' },
  ], []);
  
  // Режим работы: 'parallel' - параллельно, 'chain' - цепочкой
  const { messages, isLoading, sendMessage, clearMessages } = useChat({ 
    models, 
    mode: 'parallel' // или 'parallel' для параллельного режима
  });

  return (
    <div className="flex h-screen bg-white text-gray-800 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <ChatArea messages={messages} isLoading={isLoading} onSendMessage={sendMessage} onClearMessages={clearMessages} />
      <ContextPanel />
    </div>
  );
}

export default App;

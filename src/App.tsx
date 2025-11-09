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
    // Прямой ответ:
    // { model: createYandexGPTModel({ model: 'yandexgpt', systemPrompt: 'Задаю тебе логическую задачу. Твой цель дать прямой ответ!' }), name: 'Yandex GPT' },

    // Пошаговый ответ:
    // { model: createYandexGPTModel({ model: 'yandexgpt', systemPrompt: 'Задаю тебе логическую задачу. Твой цель решать пошагово!' }), name: 'Yandex GPT' },

    // ИИ задаёт промпт для решения задачи:
    // { model: createYandexGPTModel({ model: 'yandexgpt', systemPrompt: 'Задаю логическую задачу. Твоя задача написать промпт DeepSeek, чтобы он решил эту задачу!' }), name: 'Yandex GPT' },
    // { model: createDeepSeekModel({ model: 'deepseek-chat' }), name: 'DeepSeek' }

    // ИИ является группой экспертов:
//     { model: createYandexGPTModel({ model: 'yandexgpt', systemPrompt: `
// Ты - группа экспертов, работающих вместе над решением логической задачи. Каждый эксперт имеет свою специализацию и точку зрения. 

// При решении задачи: 
// 1. Представь, что в группе 3 эксперта с разными подходами
// 2. Каждый эксперт высказывает свое мнение и аргументирует его
// 3. Эксперты обсуждают различные подходы и взвешивают варианты
// 4. В конце группа приходит к консенсусу и дает финальный ответ
// 5. Формат ответа: сначала мнения каждого эксперта, затем обсуждение, затем финальное решение от имени группы` }), name: 'Yandex GPT' },

    // Несклько разных моделей отвечают на одну задачу:
    { model: createYandexGPTModel({ model: 'yandexgpt' }), name: 'Yandex GPT' },
    { model: createYandexGPTModel({ model: 'yandexgpt-lite' }), name: 'Yandex GPT Lite' },
    { model: createDeepSeekModel({ model: 'deepseek-chat' }), name: 'DeepSeek' }
  ], []);
  
  // Режим работы: 'parallel' - параллельно, 'chain' - цепочкой
  const { messages, isLoading, sendMessage } = useChat({ 
    models, 
    mode: 'chain' // или 'parallel' для параллельного режима
  });

  return (
    <div className="flex h-screen bg-white text-gray-800 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <ChatArea messages={messages} isLoading={isLoading} onSendMessage={sendMessage} />
      <ContextPanel />
    </div>
  );
}

export default App;
